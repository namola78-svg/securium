import postgres from "postgres";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  NETWORK_SECURITY_CONTENT_IDS,
  SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_NAME,
  SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_VALUE,
  generateNetworkSecurityQuestionSeedSql,
  getNetworkSecurityQuestionBankReadiness,
} from "../lib/data/security-certification-network-security-questions.mjs";

const CONFIRM_FLAG = "--confirm-production-seed";
const VALID_TARGETS = new Set(["stats", "d1-local", "postgres"]);

const target = process.argv[2] ?? "stats";

if (!VALID_TARGETS.has(target)) {
  fail("NETWORK_SECURITY_QUESTION_SEED_TARGET_INVALID");
}

if (target === "stats") {
  console.log(
    JSON.stringify({
      status: "NETWORK_SECURITY_QUESTION_SEED_STATS",
      ...getNetworkSecurityQuestionBankReadiness(),
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
  const sql = generateNetworkSecurityQuestionSeedSql({ dialect: "d1" });
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  const tempDir = await mkdtemp(join(tmpdir(), "securium-network-questions-"));
  const tempSqlPath = join(tempDir, "network-security-questions.d1.sql");

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

  console.log("NETWORK_SECURITY_QUESTION_SEED_D1_LOCAL_APPLIED");
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
      application_name: "securium-network-security-question-seed",
    },
  });

  try {
    await assertPostgresPrerequisites(sql);
    await sql.unsafe(generateNetworkSecurityQuestionSeedSql({ dialect: "postgres" }));
  } catch (error) {
    fail("NETWORK_SECURITY_QUESTION_SEED_POSTGRES_FAILED", safeErrorCode(error));
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("NETWORK_SECURITY_QUESTION_SEED_POSTGRES_APPLIED");
}

async function assertPostgresPrerequisites(sql) {
  const requiredTables = [
    "questions",
    "question_choices",
    "question_courses",
    "question_versions",
    "content_question_links",
    "contents",
    "courses",
    "users",
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
      `NETWORK_SECURITY_QUESTION_SCHEMA_MISSING:${missingTables.join(",")}`,
      "Apply the base PostgreSQL migrations before running this seed.",
    );
  }

  const requiredCourses = ["course-ise", "course-isie"];
  const courseRows = await sql`
    SELECT id FROM courses WHERE id IN ${sql(requiredCourses)}
  `;
  const existingCourses = new Set(courseRows.map((row) => row.id));
  const missingCourses = requiredCourses.filter((id) => !existingCourses.has(id));
  if (missingCourses.length) {
    fail(
      `NETWORK_SECURITY_QUESTION_COURSE_MISSING:${missingCourses.join(",")}`,
      "Apply or verify the base course seed before running this seed.",
    );
  }

  const requiredContentIds = Object.values(NETWORK_SECURITY_CONTENT_IDS);
  const contentRows = await sql`
    SELECT id FROM contents WHERE id IN ${sql(requiredContentIds)}
  `;
  const existingContentIds = new Set(contentRows.map((row) => row.id));
  const missingContentIds = requiredContentIds.filter(
    (id) => !existingContentIds.has(id),
  );
  if (missingContentIds.length) {
    fail(
      `NETWORK_SECURITY_CONTENT_MISSING:${missingContentIds.join(",")}`,
      "Apply the official network security CourseLesson content seed first.",
    );
  }

  const requiredUsers = ["user-admin", "user-content-reviewer"];
  const userRows = await sql`
    SELECT id FROM users WHERE id IN ${sql(requiredUsers)}
  `;
  const existingUsers = new Set(userRows.map((row) => row.id));
  const missingUsers = requiredUsers.filter((id) => !existingUsers.has(id));
  if (missingUsers.length) {
    fail(
      `NETWORK_SECURITY_QUESTION_SEED_USER_MISSING:${missingUsers.join(",")}`,
      "Apply or verify the base development administrator seed before running this seed.",
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
    process.env[SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_NAME] !==
    SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_VALUE
  ) {
    fail(
      "CONFIRM_ENV_REQUIRED",
      `Set ${SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_NAME}=${SECURITY_CERTIFICATION_NETWORK_QUESTION_CONFIRM_ENV_VALUE} before running.`,
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
      fail("NETWORK_SECURITY_QUESTION_SEED_PROCESS_FAILED");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        fail("NETWORK_SECURITY_QUESTION_SEED_PROCESS_FAILED");
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
