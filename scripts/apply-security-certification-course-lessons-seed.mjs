import postgres from "postgres";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_NAME,
  SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_VALUE,
  generateSecurityCertificationCourseLessonSeedSql,
  getSecurityCertificationCourseLessonSeedStats,
  officialSecurityCertificationCourseLessons,
} from "../lib/data/security-certification-course-lessons.mjs";

const CONFIRM_FLAG = "--confirm-production-seed";
const VALID_TARGETS = new Set(["d1-local", "postgres", "stats"]);

const target = process.argv[2] ?? "stats";

if (!VALID_TARGETS.has(target)) {
  fail("SECURITY_CERTIFICATION_COURSE_LESSON_SEED_TARGET_INVALID");
}

if (target === "stats") {
  console.log(
    JSON.stringify({
      status: "SECURITY_CERTIFICATION_COURSE_LESSON_SEED_STATS",
      ...getSecurityCertificationCourseLessonSeedStats(),
    }),
  );
  process.exit(0);
}

if (target === "d1-local") {
  await runD1LocalSeed();
  process.exit(0);
}

assertProductionSeedApproval();
await runPostgresSeed();

async function runD1LocalSeed() {
  const sql = generateSecurityCertificationCourseLessonSeedSql({ dialect: "d1" });
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  const tempDir = await mkdtemp(join(tmpdir(), "securium-course-lessons-"));
  const tempSqlPath = join(tempDir, "security-certification-course-lessons.d1.sql");

  try {
    await writeFile(tempSqlPath, sql, "utf8");
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

  console.log("SECURITY_CERTIFICATION_COURSE_LESSON_SEED_D1_LOCAL_APPLIED");
}

async function runPostgresSeed() {
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
      application_name: "securium-security-certification-course-lessons-seed",
    },
  });

  try {
    await assertPostgresPrerequisites(sql);
    await sql.unsafe(
      generateSecurityCertificationCourseLessonSeedSql({ dialect: "postgres" }),
    );
  } catch (error) {
    fail(
      "SECURITY_CERTIFICATION_COURSE_LESSON_SEED_POSTGRES_FAILED",
      safeErrorCode(error),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("SECURITY_CERTIFICATION_COURSE_LESSON_SEED_POSTGRES_APPLIED");
}

async function assertPostgresPrerequisites(sql) {
  const requiredTables = [
    "contents",
    "course_lessons",
    "curriculum_nodes",
    "curriculum_trees",
    "courses",
  ];
  const tableRows = await sql`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ${sql(requiredTables)}
  `;
  const existingTables = new Set(tableRows.map((row) => row.tablename));
  const missingTables = requiredTables.filter((table) => !existingTables.has(table));
  if (missingTables.length) {
    fail(
      `SECURITY_CERTIFICATION_COURSE_LESSON_SCHEMA_MISSING:${missingTables.join(",")}`,
      "Apply the base PostgreSQL migrations before running this seed.",
    );
  }

  const requiredTrees = [
    "curriculum-ise-2027-2029-official",
    "curriculum-isie-2027-2029-official",
  ];
  const treeRows = await sql`
    SELECT id
    FROM curriculum_trees
    WHERE id IN ${sql(requiredTrees)}
  `;
  const existingTrees = new Set(treeRows.map((row) => row.id));
  const missingTrees = requiredTrees.filter((id) => !existingTrees.has(id));
  if (missingTrees.length) {
    fail(
      `SECURITY_CERTIFICATION_CURRICULUM_TREE_MISSING:${missingTrees.join(",")}`,
      "Apply the official security certification curriculum seed first.",
    );
  }

  const requiredNodeIds = [
    ...new Set(
      officialSecurityCertificationCourseLessons.map(
        (lesson) => lesson.curriculumNodeId,
      ),
    ),
  ];
  const nodeRows = await sql`
    SELECT id
    FROM curriculum_nodes
    WHERE id IN ${sql(requiredNodeIds)}
  `;
  const existingNodeIds = new Set(nodeRows.map((row) => row.id));
  const missingNodeIds = requiredNodeIds.filter((id) => !existingNodeIds.has(id));
  if (missingNodeIds.length) {
    fail(
      `SECURITY_CERTIFICATION_CURRICULUM_NODE_MISSING:${missingNodeIds.join(",")}`,
      "Verify the official curriculum node seed before running this seed.",
    );
  }
}

function assertProductionSeedApproval() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    fail(
      "CONFIRM_FLAG_REQUIRED",
      `Run with ${CONFIRM_FLAG} only after approving the production data change.`,
    );
  }

  if (
    process.env[SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_NAME] !==
    SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_VALUE
  ) {
    fail(
      "CONFIRM_ENV_REQUIRED",
      `Set ${SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_NAME}=${SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_VALUE} before running.`,
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

function runProcess(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    });

    child.on("error", () => {
      fail("SECURITY_CERTIFICATION_COURSE_LESSON_SEED_PROCESS_FAILED");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        fail("SECURITY_CERTIFICATION_COURSE_LESSON_SEED_PROCESS_FAILED");
      }
      resolvePromise();
    });
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
