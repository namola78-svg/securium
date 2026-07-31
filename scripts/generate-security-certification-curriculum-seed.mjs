import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  generateSecurityCertificationCurriculumSeedSql,
  getSecurityCertificationCurriculumSeedStats,
} from "../lib/curriculum/security-certification-curriculum-seed.ts";

const VALID_DIALECTS = new Set(["d1", "postgres"]);

function argValue(prefix) {
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function parseDialect() {
  const dialect = argValue("--dialect=") ?? "d1";

  if (!VALID_DIALECTS.has(dialect)) {
    throw new Error(`Unsupported dialect: ${dialect}`);
  }

  return dialect;
}

function outputPathFor(dialect) {
  return resolve(
    process.cwd(),
    "db",
    "seeds",
    `security-certification-curriculum-2027-2029.${dialect}.sql`,
  );
}

function writeSeedFile(dialect, explicitOut) {
  const out = explicitOut === undefined ? outputPathFor(dialect) : resolve(process.cwd(), explicitOut);
  const sql = generateSecurityCertificationCurriculumSeedSql({ dialect });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, sql, "utf8");
  console.log(`SECURITY_CERTIFICATION_CURRICULUM_SEED_WRITTEN:${out}`);
}

if (process.argv.includes("--stats")) {
  console.log(JSON.stringify(getSecurityCertificationCurriculumSeedStats(), null, 2));
  process.exit(0);
}

const write = process.argv.includes("--write");
const writeAll = process.argv.includes("--all") && write;
const explicitOut = argValue("--out=");

if (writeAll) {
  writeSeedFile("d1");
  writeSeedFile("postgres");
  process.exit(0);
}

const dialect = parseDialect();

if (write) {
  writeSeedFile(dialect, explicitOut);
} else {
  process.stdout.write(generateSecurityCertificationCurriculumSeedSql({ dialect }));
}
