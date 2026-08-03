import postgres from "postgres";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { officialSecurityCertificationCourseLessons } from "../lib/data/security-certification-course-lessons.mjs";

const CONFIRM_FLAG = "--confirm-production-seed";
const CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_SECURITY_CERTIFICATION_LINKED_CONTENT_BACKFILL";
const CONFIRM_ENV_VALUE =
  "APPLY_SECURITY_CERTIFICATION_LINKED_CONTENT_BACKFILL";
const VALID_TARGETS = new Set(["stats", "d1-local", "postgres"]);

const target = process.argv[2] ?? "stats";
if (!VALID_TARGETS.has(target)) {
  fail("SECURITY_CERTIFICATION_LINKED_CONTENT_TARGET_INVALID");
}

const nodeContentLinks = buildNodeContentLinks();

if (target === "stats") {
  printStats();
  process.exit(0);
}

if (target === "d1-local") {
  await runD1LocalBackfill();
  process.exit(0);
}

assertProductionSeedApproval();
await runPostgresBackfill();

function printStats() {
  console.log(
    JSON.stringify(
      {
        status: "SECURITY_CERTIFICATION_LINKED_CONTENT_STATS",
        nodeCount: nodeContentLinks.length,
        linkedContentCount: nodeContentLinks.reduce(
          (count, item) => count + item.linkedContent.length,
          0,
        ),
        courseLessonSourceCount: officialSecurityCertificationCourseLessons.length,
      },
      null,
      2,
    ),
  );
}

async function runD1LocalBackfill() {
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  const rows = await d1Query(configPath, buildSelectSql());
  const updates = buildMergedUpdateStatements(rows, "d1");
  const tempDir = await mkdtemp(join(tmpdir(), "securium-linked-content-"));
  const tempSqlPath = join(tempDir, "security-certification-linked-content.d1.sql");

  try {
    await writeFile(tempSqlPath, `${updates.join("\n\n")}\n`, "utf8");
    await runProcess(process.execPath, [
      "scripts/run-wrangler.mjs",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      configPath,
      "--file",
      tempSqlPath,
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  console.log("SECURITY_CERTIFICATION_LINKED_CONTENT_D1_LOCAL_APPLIED");
}

async function runPostgresBackfill() {
  const connectionUrl = resolvePostgresSeedUrl();
  const sql = postgres(connectionUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
    ssl: "require",
    onnotice: false,
    debug: false,
    connection: {
      application_name: "securium-security-certification-linked-content-backfill",
    },
  });

  try {
    const rows = await sql.unsafe(buildSelectSql());
    const updates = buildMergedUpdateStatements(rows, "postgres");
    await sql.begin(async (tx) => {
      for (const statement of updates) {
        await tx.unsafe(statement);
      }
    });
  } catch (error) {
    fail("SECURITY_CERTIFICATION_LINKED_CONTENT_POSTGRES_FAILED", safeErrorCode(error));
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("SECURITY_CERTIFICATION_LINKED_CONTENT_POSTGRES_APPLIED");
}

function buildNodeContentLinks() {
  const byNodeId = new Map();

  for (const lesson of officialSecurityCertificationCourseLessons) {
    const existing = byNodeId.get(lesson.curriculumNodeId) ?? [];
    byNodeId.set(lesson.curriculumNodeId, [
      ...existing,
      { type: "CONTENT", id: lesson.contentId },
    ]);
  }

  return [...byNodeId.entries()]
    .map(([curriculumNodeId, links]) => ({
      curriculumNodeId,
      linkedContent: uniqueLinks(links),
    }))
    .sort((a, b) => a.curriculumNodeId.localeCompare(b.curriculumNodeId));
}

function buildSelectSql() {
  const ids = nodeContentLinks
    .map((item) => sqlString(item.curriculumNodeId))
    .join(",");

  return `
SELECT id, metadata
FROM curriculum_nodes
WHERE id IN (${ids})
ORDER BY id;`.trim();
}

function buildMergedUpdateStatements(rows, dialect) {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const missingNodeIds = nodeContentLinks
    .map((item) => item.curriculumNodeId)
    .filter((id) => !rowById.has(id));

  if (missingNodeIds.length) {
    fail(
      `SECURITY_CERTIFICATION_LINKED_CONTENT_NODE_MISSING:${missingNodeIds.join(",")}`,
      "Apply the official curriculum seed before running linkedContent backfill.",
    );
  }

  return nodeContentLinks.map((item) => {
    const row = rowById.get(item.curriculumNodeId);
    const metadata = mergeMetadata(row?.metadata, item.linkedContent);
    return `
UPDATE "curriculum_nodes"
SET "metadata" = ${sqlString(JSON.stringify(metadata))},
    "updated_at" = ${nowExpression(dialect)}
WHERE "id" = ${sqlString(item.curriculumNodeId)};`.trim();
  });
}

function mergeMetadata(rawMetadata, linkedContent) {
  const metadata = parseMetadata(rawMetadata);
  return {
    ...metadata,
    linkedContent: uniqueLinks([
      ...(Array.isArray(metadata.linkedContent) ? metadata.linkedContent : []),
      ...linkedContent,
    ]),
  };
}

function parseMetadata(rawMetadata) {
  if (!rawMetadata) return {};
  try {
    const parsed = JSON.parse(String(rawMetadata));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function uniqueLinks(links) {
  const byKey = new Map();

  for (const link of links) {
    if (!link || typeof link !== "object") continue;
    if (typeof link.type !== "string" || typeof link.id !== "string") continue;
    const normalized = { type: link.type, id: link.id };
    byKey.set(`${normalized.type}:${normalized.id}`, normalized);
  }

  return [...byKey.values()].sort(
    (a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id),
  );
}

async function d1Query(configPath, statement) {
  const result = await runCapturedProcess(process.execPath, [
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    configPath,
    "--command",
    statement,
  ]);

  if (result.code !== 0) {
    fail("SECURITY_CERTIFICATION_LINKED_CONTENT_D1_QUERY_FAILED");
  }

  return parseWranglerResults(result.stdout);
}

function parseWranglerResults(stdout) {
  const clean = stdout.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end < start) {
    fail("SECURITY_CERTIFICATION_LINKED_CONTENT_D1_JSON_MISSING");
  }

  try {
    const payload = JSON.parse(clean.slice(start, end + 1));
    return payload[0]?.results ?? [];
  } catch {
    fail("SECURITY_CERTIFICATION_LINKED_CONTENT_D1_JSON_INVALID");
  }
}

function assertProductionSeedApproval() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    fail(
      "CONFIRM_FLAG_REQUIRED",
      `Run with ${CONFIRM_FLAG} only after approving the production data change.`,
    );
  }

  if (process.env[CONFIRM_ENV_NAME] !== CONFIRM_ENV_VALUE) {
    fail(
      "CONFIRM_ENV_REQUIRED",
      `Set ${CONFIRM_ENV_NAME}=${CONFIRM_ENV_VALUE} before running.`,
    );
  }
}

function resolvePostgresSeedUrl() {
  const connectionUrl =
    process.env.POSTGRES_SEED_URL?.trim() ||
    process.env.POSTGRES_MIGRATION_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!connectionUrl) {
    fail(
      "POSTGRES_SEED_URL_REQUIRED",
      "Set POSTGRES_SEED_URL, POSTGRES_MIGRATION_URL, DIRECT_URL, or DATABASE_URL.",
    );
  }

  return connectionUrl;
}

function argValue(prefix) {
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function nowExpression(dialect) {
  return dialect === "postgres" ? "CURRENT_TIMESTAMP" : "datetime('now')";
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function runProcess(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    });

    child.on("error", () => {
      fail("SECURITY_CERTIFICATION_LINKED_CONTENT_PROCESS_FAILED");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        fail("SECURITY_CERTIFICATION_LINKED_CONTENT_PROCESS_FAILED");
      }
      resolvePromise();
    });
  });
}

function runCapturedProcess(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", () => resolvePromise({ code: 1, stdout: "" }));
    child.on("close", (code) => resolvePromise({ code: code ?? 1, stdout }));
  });
}

function safeErrorCode(error) {
  if (!error || typeof error !== "object") return "UNKNOWN";
  const code = "code" in error ? error.code : undefined;
  if (typeof code === "string" && /^[A-Z0-9_]+$/.test(code)) return code;
  const name = "name" in error ? error.name : undefined;
  if (typeof name === "string" && /^[A-Za-z0-9_]+$/.test(name)) return name;
  return "UNKNOWN";
}

function fail(code, message) {
  console.error(message ? `${code}:${message}` : code);
  process.exit(1);
}
