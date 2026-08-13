import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import {
  ISMS_P_BATCH1_WRITE_CONFIRMATION,
  applyIsmsPBatch1Materialization,
  planIsmsPBatch1Materialization,
  rollbackIsmsPBatch1Materialization,
  verifyIsmsPBatch1Materialization,
} from "../lib/data/isms-p-theory-batch1-materializer.mjs";

const mode = process.argv[2]?.toUpperCase();
const persistTo = argumentValue("--persist-to=");
if (!new Set(["PLAN", "APPLY", "VERIFY", "ROLLBACK"]).has(mode)) {
  console.error(
    "Usage: node scripts/isms-p-batch1-materializer.mjs <plan|apply|verify|rollback> --persist-to=<isolated-path>",
  );
  process.exit(1);
}
if (!persistTo) {
  console.error("ISMS_P_BATCH1_ISOLATED_PERSIST_PATH_REQUIRED");
  process.exit(1);
}

class WranglerD1Provider {
  kind = "d1";
  fileSequence = 0;

  constructor(persistPath) {
    this.persistPath = persistPath;
  }

  async query(statement) {
    const result = await this.run(["--command", renderStatement(statement)]);
    const rows = result.results ?? [];
    return {
      rows,
      rowCount: rows.length,
      metadata: { provider: this.kind },
    };
  }

  async queryOne(statement) {
    return (await this.query(statement)).rows[0] ?? null;
  }

  async execute(statement) {
    const result = await this.run(["--command", renderStatement(statement)]);
    return {
      affectedRows: Number(result.meta?.changes ?? 0),
      returnedRows: [],
      metadata: { provider: this.kind },
    };
  }

  async transaction(statements) {
    if (!statements.length) return [];
    this.fileSequence += 1;
    const path = join(
      this.persistPath,
      `isms-p-batch1-${process.pid}-${this.fileSequence}.sql`,
    );
    await writeFile(
      path,
      `${statements
        .map((statement) => `${renderStatement(statement)};`)
        .join("\n")}\n`,
      "utf8",
    );
    await this.run(["--file", path]);
    return statements.map(() => ({
      affectedRows: 1,
      returnedRows: [],
      metadata: { provider: this.kind },
    }));
  }

  async healthCheck() {
    return (await this.queryOne({ sql: "SELECT 1 AS ok" }))?.ok === 1;
  }

  async run(input) {
    const output = await capture(process.execPath, [
      "scripts/run-wrangler.mjs",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "wrangler.local.jsonc",
      "--persist-to",
      this.persistPath,
      ...input,
      "--json",
    ]);
    if (output.code !== 0) {
      throw new Error(
        `ISMS_P_BATCH1_D1_COMMAND_FAILED:${`${output.stderr}\n${output.stdout}`.slice(-2400)}`,
      );
    }
    const result = JSON.parse(output.stdout)[0];
    if (!result?.success) throw new Error("ISMS_P_BATCH1_D1_RESULT_FAILED");
    return result;
  }
}

function renderStatement(statement) {
  let index = 0;
  const sql = statement.sql.replace(/\?/g, () => {
    const value = statement.parameters?.[index];
    index += 1;
    return sqlLiteral(value ?? null);
  });
  if (index !== (statement.parameters?.length ?? 0)) {
    throw new Error("ISMS_P_BATCH1_PARAMETER_COUNT_MISMATCH");
  }
  return sql;
}

function sqlLiteral(value) {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Uint8Array) {
    return `X'${Buffer.from(value).toString("hex")}'`;
  }
  return `CAST(X'${Buffer.from(String(value), "utf8").toString("hex")}' AS TEXT)`;
}

function argumentValue(prefix) {
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(
    prefix.length,
  );
}

function capture(executable, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(executable, args, {
      cwd: resolve("."),
      env: {
        ...process.env,
        APP_BUILD_TARGET: "cloudflare",
        DB_PROVIDER: "d1",
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) =>
      resolvePromise({ code: code ?? 1, stdout, stderr }),
    );
    child.on("error", (error) =>
      resolvePromise({ code: 1, stdout, stderr: String(error) }),
    );
  });
}

const provider = new WranglerD1Provider(resolve(persistTo));
const context = {
  target: "isolated-d1",
  environment: "test",
  confirmation: ISMS_P_BATCH1_WRITE_CONFIRMATION,
};
let result;
if (mode === "PLAN") {
  result = await planIsmsPBatch1Materialization(provider);
} else if (mode === "APPLY") {
  result = await applyIsmsPBatch1Materialization(provider, context);
} else if (mode === "VERIFY") {
  result = await verifyIsmsPBatch1Materialization(provider);
} else {
  const operationIds = process.argv
    .filter((argument) => argument.startsWith("--created-operation-id="))
    .map((argument) => argument.slice("--created-operation-id=".length));
  if (!operationIds.length) {
    throw new Error(
      "ISMS_P_BATCH1_ROLLBACK_OWNERSHIP_RECEIPT_REQUIRED",
    );
  }
  result = await rollbackIsmsPBatch1Materialization(
    provider,
    context,
    operationIds,
  );
}
console.log(JSON.stringify(result, null, 2));
