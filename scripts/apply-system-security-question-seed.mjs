import postgres from "postgres";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadLocalEnvIfPresent } from "./load-local-env.mjs";
import {
  SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_NAME,
  SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_VALUE,
  SYSTEM_SECURITY_CONTENT_ID,
  generateSystemSecurityQuestionSeedSql,
  getSystemSecurityQuestionBankReadiness,
} from "../lib/data/security-certification-system-security-questions.mjs";

const CONFIRM_FLAG = "--confirm-production-seed";
const QUESTION_SEED_ACTOR_ENV_NAME = "SECURIUM_QUESTION_SEED_ACTOR_USER_ID";
loadLocalEnvIfPresent();
const VALID_TARGETS = new Set(["stats", "d1-local", "postgres"]);

const target = process.argv[2] ?? "stats";

if (!VALID_TARGETS.has(target)) {
  fail("SYSTEM_SECURITY_QUESTION_SEED_TARGET_INVALID");
}

if (target === "stats") {
  console.log(
    JSON.stringify({
      status: "SYSTEM_SECURITY_QUESTION_SEED_STATS",
      ...getSystemSecurityQuestionBankReadiness(),
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
  const sql = generateSystemSecurityQuestionSeedSql({ dialect: "d1" });
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  const tempDir = await mkdtemp(join(tmpdir(), "securium-system-questions-"));
  const tempSqlPath = join(tempDir, "system-security-questions.d1.sql");

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

  console.log("SYSTEM_SECURITY_QUESTION_SEED_D1_LOCAL_APPLIED");
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
      application_name: "securium-system-security-question-seed",
    },
  });

  try {
    const actorIds = await assertPostgresPrerequisites(sql);
    await sql.unsafe(
      applyPostgresActorOverride(
        generateSystemSecurityQuestionSeedSql({ dialect: "postgres" }),
        actorIds,
      ),
    );
  } catch (error) {
    fail("SYSTEM_SECURITY_QUESTION_SEED_POSTGRES_FAILED", safeErrorCode(error));
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("SYSTEM_SECURITY_QUESTION_SEED_POSTGRES_APPLIED");
}

async function assertPostgresPrerequisites(sql) {
  const requiredTables = [
    "questions",
    "question_choices",
    "question_courses",
    "question_subjects",
    "question_topics",
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
      `SYSTEM_SECURITY_QUESTION_SCHEMA_MISSING:${missingTables.join(",")}`,
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
      `SYSTEM_SECURITY_QUESTION_COURSE_MISSING:${missingCourses.join(",")}`,
      "Apply or verify the base course seed before running this seed.",
    );
  }

  const contentRows = await sql`
    SELECT id FROM contents WHERE id = ${SYSTEM_SECURITY_CONTENT_ID}
  `;
  if (contentRows.length !== 1) {
    fail(
      `SYSTEM_SECURITY_CONTENT_MISSING:${SYSTEM_SECURITY_CONTENT_ID}`,
      "Apply the official system security CourseLesson content seed first.",
    );
  }

  const actorIds = resolveQuestionSeedActorIds();
  const requiredUsers = [...new Set([actorIds.createdBy, actorIds.reviewedBy])];
  const userRows = await sql`
    SELECT id FROM users WHERE id IN ${sql(requiredUsers)}
  `;
  const existingUsers = new Set(userRows.map((row) => row.id));
  const missingUsers = requiredUsers.filter((id) => !existingUsers.has(id));
  if (missingUsers.length) {
    fail(
      `SYSTEM_SECURITY_QUESTION_SEED_USER_MISSING:${missingUsers.join(",")}`,
      `Apply or verify the base development administrator seed, or set ${QUESTION_SEED_ACTOR_ENV_NAME} to an existing operating user id.`,
    );
  }

  return actorIds;
}

function resolveQuestionSeedActorIds() {
  const actorUserId = process.env[QUESTION_SEED_ACTOR_ENV_NAME]?.trim();
  if (actorUserId) {
    return {
      createdBy: actorUserId,
      reviewedBy: actorUserId,
    };
  }

  return {
    createdBy: "user-admin",
    reviewedBy: "user-content-reviewer",
  };
}

function applyPostgresActorOverride(seedSql, actorIds) {
  return seedSql
    .replaceAll("'user-admin'", sqlString(actorIds.createdBy))
    .replaceAll("'user-content-reviewer'", sqlString(actorIds.reviewedBy));
}

function assertProductionSeedApproval() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    fail(
      "CONFIRM_FLAG_REQUIRED",
      `Run with ${CONFIRM_FLAG} only after approving the production data change.`,
    );
  }

  if (
    process.env[SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_NAME] !==
    SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_VALUE
  ) {
    fail(
      "CONFIRM_ENV_REQUIRED",
      `Set ${SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_NAME}=${SECURITY_CERTIFICATION_SYSTEM_QUESTION_CONFIRM_ENV_VALUE} before running.`,
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
      fail("SYSTEM_SECURITY_QUESTION_SEED_PROCESS_FAILED");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        fail("SYSTEM_SECURITY_QUESTION_SEED_PROCESS_FAILED");
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
