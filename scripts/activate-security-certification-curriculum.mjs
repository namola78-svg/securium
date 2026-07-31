import postgres from "postgres";

const CONFIRM_FLAG = "--confirm-production-activation";
const CONFIRM_ENV_NAME =
  "SECURIUM_CONFIRM_SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION";
const CONFIRM_ENV_VALUE = "ACTIVATE_SECURITY_CERTIFICATION_CURRICULUM";

const targetTreeIds = [
  "curriculum-ise-2027-2029-official",
  "curriculum-isie-2027-2029-official",
];
const targetCourseIds = ["course-ise", "course-isie"];

assertProductionActivationApproval();
await activateWithPostgres();

async function activateWithPostgres() {
  const connectionUrl = resolvePostgresUrl();
  const sql = postgres(connectionUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: false,
    ssl: "require",
    onnotice: false,
    debug: false,
    connection: {
      application_name:
        "securium-security-certification-curriculum-activation",
    },
  });

  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(
        `UPDATE curriculum_trees
         SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP
         WHERE course_id IN (${targetCourseIds.map(sqlString).join(",")})
           AND status = 'ACTIVE'
           AND id NOT IN (${targetTreeIds.map(sqlString).join(",")});`,
      );

      await tx.unsafe(
        `UPDATE curriculum_trees
         SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${targetTreeIds.map(sqlString).join(",")});`,
      );
    });

    const rows = await sql.unsafe(
      `SELECT id, course_id AS "courseId", status
       FROM curriculum_trees
       WHERE id IN (${targetTreeIds.map(sqlString).join(",")})
       ORDER BY id;`,
    );

    for (const treeId of targetTreeIds) {
      const row = rows.find((item) => item.id === treeId);
      if (!row) fail("SECURITY_CERTIFICATION_CURRICULUM_TREE_MISSING", treeId);
      if (row.status !== "ACTIVE") {
        fail("SECURITY_CERTIFICATION_CURRICULUM_TREE_NOT_ACTIVE", treeId);
      }
    }

    console.log("SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_POSTGRES_OK");
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    fail(
      "SECURITY_CERTIFICATION_CURRICULUM_ACTIVATION_POSTGRES_FAILED",
      safeErrorCode(error),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function assertProductionActivationApproval() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    fail(
      "CONFIRM_FLAG_REQUIRED",
      `Run with ${CONFIRM_FLAG} only after approving the production curriculum activation.`,
    );
  }

  if (process.env[CONFIRM_ENV_NAME] !== CONFIRM_ENV_VALUE) {
    fail(
      "CONFIRM_ENV_REQUIRED",
      `Set ${CONFIRM_ENV_NAME}=${CONFIRM_ENV_VALUE} before running.`,
    );
  }
}

function resolvePostgresUrl() {
  const connectionUrl =
    process.env.POSTGRES_ACTIVATION_URL?.trim() ||
    process.env.POSTGRES_SEED_URL?.trim() ||
    process.env.POSTGRES_MIGRATION_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!connectionUrl) {
    fail("POSTGRES_ACTIVATION_URL_REQUIRED");
  }

  return connectionUrl;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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
