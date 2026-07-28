import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";
import {
  assertFirstSuperAdminCanBeCreated,
  validateAdminBootstrapIdentity,
} from "../lib/services/admin-bootstrap-service.ts";

const CONFIRMATION = "CREATE_FIRST_SUPER_ADMIN";

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (process.env.ADMIN_BOOTSTRAP_CONFIRM !== CONFIRMATION) {
    fail(
      "ADMIN_BOOTSTRAP_CONFIRM must equal CREATE_FIRST_SUPER_ADMIN.",
      "ADMIN_BOOTSTRAP_CONFIRMATION_REQUIRED",
    );
  }
  const identity = validateAdminBootstrapIdentity({
    email: process.env.ADMIN_BOOTSTRAP_EMAIL,
    displayName: process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME,
  });
  if ((options.remote || options.provider === "supabase") && !options.confirmRemote) {
    fail(
      "Remote bootstrap requires --confirm-remote.",
      "ADMIN_BOOTSTRAP_REMOTE_CONFIRMATION_REQUIRED",
    );
  }

  const currentCount = await readCount(
    await executeSql(options, activeSuperAdminCountSql()),
    options.provider,
  );
  assertFirstSuperAdminCanBeCreated(currentCount);

  const userId = randomUUID();
  const roleId = randomUUID();
  const grantId = randomUUID();
  const auditId = randomUUID();
  const requestId = randomUUID();
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "shield-admin-bootstrap-"),
  );
  const sqlPath = join(temporaryDirectory, "bootstrap.sql");

  try {
    await writeFile(
      sqlPath,
      createBootstrapSql({
        ...identity,
        userId,
        roleId,
        grantId,
        auditId,
        requestId,
        provider: options.provider,
      }),
      { encoding: "utf8", flag: "wx" },
    );
    await executeSqlFile(options, sqlPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  const grantCount = await readCount(
    await executeSql(
      options,
      `SELECT COUNT(*) AS count FROM user_roles WHERE id = '${sqlText(grantId)}'`,
    ),
    options.provider,
  );
  if (grantCount !== 1) {
    fail(
      "Bootstrap was not applied. Another administrator may have completed it.",
      "ADMIN_BOOTSTRAP_NOT_APPLIED",
    );
  }

  // Deliberately do not print email, credentials, SQL, or provider output.
  console.log("ADMIN_BOOTSTRAP_COMPLETED");
}

function parseOptions(args) {
  if (args.includes("--help")) return { help: true };
  const provider = process.env.DB_PROVIDER?.trim().toLowerCase() || "d1";
  if (!["d1", "supabase"].includes(provider)) {
    fail("DB_PROVIDER must be d1 or supabase.", "ADMIN_BOOTSTRAP_PROVIDER_INVALID");
  }
  const local = args.includes("--local");
  const remote = args.includes("--remote");
  if (provider === "supabase" && (local || remote || args.includes("--config"))) {
    fail(
      "PostgreSQL bootstrap does not accept D1 target options.",
      "ADMIN_BOOTSTRAP_OPTION_INVALID",
    );
  }
  if (provider === "d1" && local === remote) {
    fail(
      "Choose exactly one of --local or --remote.",
      "ADMIN_BOOTSTRAP_TARGET_REQUIRED",
    );
  }
  const configIndex = args.indexOf("--config");
  const config =
    configIndex >= 0 && args[configIndex + 1]
      ? resolve(args[configIndex + 1])
      : null;
  if (provider === "d1" && !config) {
    fail("--config is required.", "ADMIN_BOOTSTRAP_CONFIG_REQUIRED");
  }
  const allowed = new Set([
    "--local",
    "--remote",
    "--confirm-remote",
    "--config",
    configIndex >= 0 ? args[configIndex + 1] : "",
  ]);
  const unknown = args.find((argument) => !allowed.has(argument));
  if (unknown) {
    fail("Unknown bootstrap option.", "ADMIN_BOOTSTRAP_OPTION_INVALID");
  }
  return {
    help: false,
    provider,
    local,
    remote,
    confirmRemote: args.includes("--confirm-remote"),
    config,
  };
}

async function executeSql(options, sql) {
  if (options.provider === "d1") {
    return executeWrangler(options, ["--command", sql]);
  }
  const result = await executePsql(["-At", "-c", sql]);
  return result.stdout;
}

async function executeSqlFile(options, sqlPath) {
  if (options.provider === "d1") {
    await executeWrangler(options, ["--file", sqlPath]);
    return;
  }
  await executePsql(["-v", "ON_ERROR_STOP=1", "-f", sqlPath]);
}

async function executeWrangler(options, operationArguments) {
  const argumentsList = [
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "execute",
    "DB",
    options.local ? "--local" : "--remote",
    "--config",
    options.config,
    ...operationArguments,
    "--json",
  ];
  const result = await spawnCaptured(process.execPath, argumentsList);
  if (result.code !== 0) {
    fail(
      "The D1 bootstrap operation failed. Provider output was suppressed.",
      "ADMIN_BOOTSTRAP_D1_FAILED",
    );
  }
  return result.stdout;
}

function spawnCaptured(command, args, environment = process.env) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...environment,
        WRANGLER_LOG_PATH:
          process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler.log",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", () => {});
    child.on("error", (error) =>
      resolvePromise({
        code: 1,
        stdout: "",
        diagnostic: safeDiagnosticCode(error),
      }),
    );
    child.on("exit", (code) =>
      resolvePromise({ code: code ?? 1, stdout }),
    );
  });
}

function safeDiagnosticCode(error) {
  const code =
    typeof error?.code === "string"
      ? error.code
      : typeof error?.cause?.code === "string"
        ? error.cause.code
        : "FAILED";
  const normalized = code.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return normalized.slice(0, 40) || "FAILED";
}

function readCount(output, provider) {
  if (provider === "supabase") {
    const count = Number(output.trim());
    if (Number.isSafeInteger(count) && count >= 0) return count;
    fail(
      "The PostgreSQL bootstrap result could not be verified.",
      "ADMIN_BOOTSTRAP_RESULT_INVALID",
    );
  }
  try {
    const payload = JSON.parse(output);
    const value = payload?.[0]?.results?.[0]?.count;
    const count = Number(value);
    if (Number.isSafeInteger(count) && count >= 0) return count;
  } catch {
    // Return a safe error below without provider output.
  }
  fail(
    "The D1 bootstrap result could not be verified.",
    "ADMIN_BOOTSTRAP_RESULT_INVALID",
  );
}

async function executePsql(args) {
  const directUrl = process.env.DIRECT_URL?.trim();
  if (!directUrl) {
    fail("DIRECT_URL is required.", "ADMIN_BOOTSTRAP_DIRECT_URL_REQUIRED");
  }
  let url;
  try {
    url = new URL(directUrl);
  } catch {
    fail("DIRECT_URL is invalid.", "ADMIN_BOOTSTRAP_DIRECT_URL_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    fail("DIRECT_URL is invalid.", "ADMIN_BOOTSTRAP_DIRECT_URL_INVALID");
  }
  const candidates =
    process.platform === "win32"
      ? ["psql.exe", "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe"]
      : ["psql"];
  const environment = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: url.searchParams.get("sslmode") ?? "require",
  };
  const diagnostics = [];
  for (const executable of candidates) {
    const result = await spawnCaptured(executable, args, environment);
    if (result.code === 0) return result;
    if (result.diagnostic) diagnostics.push(result.diagnostic);
  }
  const postgresJsResult = await executePostgresJs(args, directUrl);
  if (postgresJsResult.code === 0) return postgresJsResult;
  if (postgresJsResult.diagnostic) diagnostics.push(postgresJsResult.diagnostic);
  const diagnostic = diagnostics.find((value) => value !== "ENOENT");
  if (diagnostic) {
    fail(
      "The PostgreSQL bootstrap operation failed. Provider output was suppressed.",
      `ADMIN_BOOTSTRAP_POSTGRES_${diagnostic}`,
    );
  }
  fail(
    "The PostgreSQL bootstrap operation failed. Provider output was suppressed.",
    "ADMIN_BOOTSTRAP_POSTGRES_FAILED",
  );
}

async function executePostgresJs(args, directUrl) {
  let sql;
  try {
    const mod = await import("postgres");
    sql = mod.default(directUrl, {
      max: 1,
      ssl: "require",
      idle_timeout: 1,
      connect_timeout: 10,
    });
    if (args.includes("-c")) {
      const query = args[args.indexOf("-c") + 1];
      if (!query) return { code: 1, stdout: "" };
      const rows = await sql.unsafe(query);
      return {
        code: 0,
        stdout: rows.length ? `${Object.values(rows[0])[0]}\n` : "",
      };
    }
    if (args.includes("-f")) {
      const sqlPath = args[args.indexOf("-f") + 1];
      if (!sqlPath) return { code: 1, stdout: "" };
      const sqlText = await readFile(sqlPath, "utf8");
      await executeBootstrapSqlText(sql, sqlText);
      return { code: 0, stdout: "" };
    }
  } catch (error) {
    return {
      code: 1,
      stdout: "",
      diagnostic: safeDiagnosticCode(error),
    };
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => {});
  }
  return { code: 1, stdout: "" };
}

async function executeBootstrapSqlText(sql, sqlText) {
  const statements = sqlText
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !/^BEGIN$/i.test(statement))
    .filter((statement) => !/^COMMIT$/i.test(statement));

  await sql.begin(async (transaction) => {
    for (const statement of statements) {
      await transaction.unsafe(statement);
    }
  });
}

function activeSuperAdminCountSql() {
  return [
    "SELECT COUNT(DISTINCT u.id) AS count",
    "FROM users u",
    "JOIN user_roles ur ON ur.user_id = u.id",
    "JOIN roles r ON r.id = ur.role_id",
    "WHERE u.status = 'ACTIVE'",
    "AND r.code = 'SUPER_ADMIN'",
    "AND ur.course_id IS NULL",
  ].join(" ");
}

function activeSuperAdminExistsSql() {
  return [
    "SELECT 1",
    "FROM users u",
    "JOIN user_roles ur ON ur.user_id = u.id",
    "JOIN roles r ON r.id = ur.role_id",
    "WHERE u.status = 'ACTIVE'",
    "AND r.code = 'SUPER_ADMIN'",
    "AND ur.course_id IS NULL",
    "LIMIT 1",
  ].join(" ");
}

function createBootstrapSql(input) {
  const metadata = JSON.stringify({
    assignedRoles: ["SUPER_ADMIN"],
    bootstrapMethod:
      input.provider === "supabase" ? "POSTGRES_CLI" : "D1_CLI",
  });
  const begin =
    input.provider === "supabase"
      ? "BEGIN;\nSELECT pg_advisory_xact_lock(hashtext('shield-admin-bootstrap'));"
      : "";
  const commit = input.provider === "supabase" ? "COMMIT;" : "";
  const roleInsert =
    input.provider === "supabase"
      ? `INSERT INTO roles (id, code, name, description)
VALUES ('${sqlText(input.roleId)}', 'SUPER_ADMIN', 'Super Administrator', 'Production bootstrap role')
ON CONFLICT(code) DO NOTHING;`
      : `INSERT OR IGNORE INTO roles (id, code, name, description)
VALUES ('${sqlText(input.roleId)}', 'SUPER_ADMIN', 'Super Administrator', 'Production bootstrap role');`;
  return `
${begin}
${roleInsert}

INSERT INTO users (id, email, display_name, status)
SELECT '${sqlText(input.userId)}', '${sqlText(input.email)}', '${sqlText(input.displayName)}', 'ACTIVE'
WHERE NOT EXISTS (${activeSuperAdminExistsSql()})
ON CONFLICT(email) DO NOTHING;

INSERT INTO user_roles (id, user_id, role_id, course_id, granted_by)
SELECT
  '${sqlText(input.grantId)}',
  u.id,
  r.id,
  NULL,
  u.id
FROM users u
JOIN roles r ON r.code = 'SUPER_ADMIN'
WHERE u.email = '${sqlText(input.email)}'
  AND u.status = 'ACTIVE'
  AND NOT EXISTS (${activeSuperAdminExistsSql()});

INSERT INTO admin_audit_logs (
  id, actor_user_id, actor_role, action, resource_type, resource_id,
  result, user_agent_summary, request_id, metadata_json
)
SELECT
  '${sqlText(input.auditId)}',
  ur.user_id,
  'SUPER_ADMIN',
  'ADMIN_BOOTSTRAPPED',
  'USER',
  ur.user_id,
  'SUCCESS',
  'CLI/bootstrap',
  '${sqlText(input.requestId)}',
  '${sqlText(metadata)}'
FROM user_roles ur
WHERE ur.id = '${sqlText(input.grantId)}';
${commit}
`;
}

function sqlText(value) {
  return String(value).replaceAll("'", "''");
}

function printHelp() {
  console.log(`Usage:
  ADMIN_BOOTSTRAP_EMAIL=<email> \\
  ADMIN_BOOTSTRAP_CONFIRM=${CONFIRMATION} \\
  node scripts/admin-bootstrap.mjs --local --config wrangler.local.jsonc

Remote execution additionally requires --remote --confirm-remote and a
separately reviewed Wrangler configuration.

For PostgreSQL, set DB_PROVIDER=supabase and DIRECT_URL, then use
--confirm-remote. The script uses local psql when available and falls back to
the installed postgres.js driver. No password is accepted.`);
}

function fail(message, code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

main().catch((error) => {
  console.error(error?.code ?? "ADMIN_BOOTSTRAP_FAILED");
  process.exitCode = 1;
});
