import postgres from "postgres";
import { spawn } from "node:child_process";

const VALID_TARGETS = new Set(["d1-local", "postgres"]);
const target = process.argv[2] ?? "d1-local";

if (!VALID_TARGETS.has(target)) {
  fail("SECURITY_CERTIFICATION_CURRICULUM_VERIFY_TARGET_INVALID");
}

const expectedTrees = [
  {
    id: "curriculum-ise-2027-2029-official",
    courseId: "course-ise",
    version: "2027-2029",
    status: "DRAFT",
    nodeCount: 79,
    writtenSubjects: 5,
    requiresLawSubject: true,
  },
  {
    id: "curriculum-isie-2027-2029-official",
    courseId: "course-isie",
    version: "2027-2029",
    status: "DRAFT",
    nodeCount: 64,
    writtenSubjects: 4,
    requiresLawSubject: false,
  },
];

if (target === "d1-local") {
  await verifyWithD1Local();
} else {
  await verifyWithPostgres();
}

async function verifyWithD1Local() {
  const configPath = argValue("--config=") ?? "wrangler.local.jsonc";
  const treeRows = await d1Query(
    configPath,
    `SELECT id, course_id AS courseId, version, status
     FROM curriculum_trees
     WHERE id IN (${expectedTrees.map((tree) => sqlString(tree.id)).join(",")})
     ORDER BY id;`,
  );
  const countRows = await d1Query(
    configPath,
    `SELECT curriculum_tree_id AS treeId, COUNT(*) AS nodeCount
     FROM curriculum_nodes
     WHERE curriculum_tree_id IN (${expectedTrees.map((tree) => sqlString(tree.id)).join(",")})
     GROUP BY curriculum_tree_id
     ORDER BY curriculum_tree_id;`,
  );
  const subjectRows = await d1Query(
    configPath,
    `SELECT curriculum_tree_id AS treeId, title
     FROM curriculum_nodes
     WHERE node_type = 'SUBJECT'
       AND parent_id IN (
         'curriculum-node-ise-2027-2029-01',
         'curriculum-node-isie-2027-2029-01'
       )
     ORDER BY curriculum_tree_id, sort_order;`,
  );

  verifyRows(treeRows, countRows, subjectRows);
  console.log("SECURITY_CERTIFICATION_CURRICULUM_VERIFY_D1_LOCAL_OK");
}

async function verifyWithPostgres() {
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
      application_name: "securium-security-certification-curriculum-verify",
    },
  });

  try {
    const treeRows = await sql.unsafe(
      `SELECT id, course_id AS "courseId", version, status
       FROM curriculum_trees
       WHERE id IN (${expectedTrees.map((tree) => sqlString(tree.id)).join(",")})
       ORDER BY id;`,
    );
    const countRows = await sql.unsafe(
      `SELECT curriculum_tree_id AS "treeId", COUNT(*)::int AS "nodeCount"
       FROM curriculum_nodes
       WHERE curriculum_tree_id IN (${expectedTrees.map((tree) => sqlString(tree.id)).join(",")})
       GROUP BY curriculum_tree_id
       ORDER BY curriculum_tree_id;`,
    );
    const subjectRows = await sql.unsafe(
      `SELECT curriculum_tree_id AS "treeId", title
       FROM curriculum_nodes
       WHERE node_type = 'SUBJECT'
         AND parent_id IN (
           'curriculum-node-ise-2027-2029-01',
           'curriculum-node-isie-2027-2029-01'
         )
       ORDER BY curriculum_tree_id, sort_order;`,
    );

    verifyRows(treeRows, countRows, subjectRows);
  } catch (error) {
    fail("SECURITY_CERTIFICATION_CURRICULUM_VERIFY_POSTGRES_FAILED", safeErrorCode(error));
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("SECURITY_CERTIFICATION_CURRICULUM_VERIFY_POSTGRES_OK");
}

function verifyRows(treeRows, countRows, subjectRows) {
  for (const expected of expectedTrees) {
    const tree = treeRows.find((row) => row.id === expected.id);
    if (!tree) fail("SECURITY_CERTIFICATION_CURRICULUM_TREE_MISSING", expected.id);
    if (tree.courseId !== expected.courseId) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_TREE_COURSE_MISMATCH", expected.id);
    }
    if (tree.version !== expected.version || tree.status !== expected.status) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_TREE_STATUS_MISMATCH", expected.id);
    }

    const count = countRows.find((row) => row.treeId === expected.id);
    if (Number(count?.nodeCount) !== expected.nodeCount) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_NODE_COUNT_MISMATCH", expected.id);
    }

    const subjects = subjectRows
      .filter((row) => row.treeId === expected.id)
      .map((row) => row.title);
    if (subjects.length !== expected.writtenSubjects) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_SUBJECT_COUNT_MISMATCH", expected.id);
    }
    const hasLawSubject = subjects.includes("정보보안관리 및 법규");
    if (hasLawSubject !== expected.requiresLawSubject) {
      fail("SECURITY_CERTIFICATION_CURRICULUM_LAW_SUBJECT_MISMATCH", expected.id);
    }
  }
}

async function d1Query(configPath, statement) {
  const result = await runProcess(process.execPath, [
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
    fail("SECURITY_CERTIFICATION_CURRICULUM_VERIFY_D1_FAILED");
  }

  return parseWranglerResults(result.stdout);
}

function parseWranglerResults(stdout) {
  const clean = stdout.replace(/\u001b\[[0-9;]*m/g, "");
  const start = clean.indexOf("[\n");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end < start) {
    fail("SECURITY_CERTIFICATION_CURRICULUM_VERIFY_D1_JSON_MISSING");
  }

  try {
    const payload = JSON.parse(clean.slice(start, end + 1));
    return payload[0]?.results ?? [];
  } catch {
    fail("SECURITY_CERTIFICATION_CURRICULUM_VERIFY_D1_JSON_INVALID");
  }
}

function resolvePostgresUrl() {
  const connectionUrl =
    process.env.POSTGRES_VERIFY_URL?.trim() ||
    process.env.POSTGRES_SEED_URL?.trim() ||
    process.env.POSTGRES_MIGRATION_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!connectionUrl) {
    fail("POSTGRES_VERIFY_URL_REQUIRED");
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
