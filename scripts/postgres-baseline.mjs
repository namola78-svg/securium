import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BASELINE_ID = "POSTGRES_FRESH_BASELINE_V1";
export const BASELINE_VERSION = "1";
export const BASELINE_BOUNDARY = "0019";
export const MINIMUM_NEXT_MIGRATION = "0020";
export const BASELINE_ARTIFACT_PATH = resolve(
  "db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sql",
);
export const BASELINE_MANIFEST_PATH = resolve(
  "db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.json",
);
export const BASELINE_DIGEST_PATH = resolve(
  "db/postgres/baselines/POSTGRES_FRESH_BASELINE_V1.sha256",
);

const SOURCE_MAIN_SHA = "f1f364ec95343e03118ebb699f70773940b95411";
const MIGRATIONS_DIRECTORY = resolve("db/postgres/migrations");

const command = process.argv[2];
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (command === "generate") await generateBaseline();
  else if (command === "validate") await validateBaselineFiles();
}

export async function generateBaseline() {
  const artifact = await buildBaselineArtifact();
  const artifactDigest = sha256(artifact);
  const schemaDigest = sha256(schemaProjection(artifact));
  const securityDigest = sha256(securityProjection(artifact));
  const manifest = {
    baselineId: BASELINE_ID,
    baselineVersion: BASELINE_VERSION,
    boundary: BASELINE_BOUNDARY,
    nextMigrationBoundary: MINIMUM_NEXT_MIGRATION,
    createdFromMainSHA: SOURCE_MAIN_SHA,
    artifactDigest,
    schemaDigest,
    securityDigest,
    sourceAuthority: "DISPOSABLE_POSTGRES_REFERENCE_STATE_CANONICAL_PROJECTION",
    historicalReceiptsFabricated: 0,
    encoding: "UTF-8",
    newline: "LF",
  };
  await mkdir(dirname(BASELINE_ARTIFACT_PATH), { recursive: true });
  await writeFile(BASELINE_ARTIFACT_PATH, artifact, "utf8");
  await writeFile(BASELINE_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(BASELINE_DIGEST_PATH, `${artifactDigest}  POSTGRES_FRESH_BASELINE_V1.sql\n`, "utf8");
  return { artifact, manifest };
}

export async function validateBaselineFiles() {
  const [artifact, manifestText, digestText] = await Promise.all([
    readFile(BASELINE_ARTIFACT_PATH, "utf8"),
    readFile(BASELINE_MANIFEST_PATH, "utf8"),
    readFile(BASELINE_DIGEST_PATH, "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);
  const digestFile = digestText.trim().split(/\s+/)[0];
  const valid = validateArtifactAgainstManifest({ artifact, manifest, digestFile });
  if (!valid) throw new Error("POSTGRES_BASELINE_DIGEST_OR_IDENTITY_INVALID");
  return { artifact, manifest };
}

export function validateArtifactAgainstManifest({ artifact, manifest, digestFile = sha256(artifact) }) {
  const artifactDigest = sha256(artifact);
  const schemaDigest = sha256(schemaProjection(artifact));
  const securityDigest = sha256(securityProjection(artifact));
  return (
    manifest.baselineId === BASELINE_ID &&
    manifest.baselineVersion === BASELINE_VERSION &&
    manifest.boundary === BASELINE_BOUNDARY &&
    manifest.artifactDigest === artifactDigest &&
    manifest.schemaDigest === schemaDigest &&
    manifest.securityDigest === securityDigest &&
    digestFile === artifactDigest &&
    artifact.startsWith("-- SECURIUM GENERATED POSTGRES FRESH BASELINE") &&
    artifact.includes("CREATE TABLE app_schema_baseline_receipts") &&
    !/INSERT INTO public?\.?app_schema_migrations/i.test(artifact)
  );
}

export async function buildBaselineArtifact() {
  const names = (await readdir(MIGRATIONS_DIRECTORY))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const published = new Map();
  for (const name of names) published.set(name.slice(0, 4), await readFile(resolve(MIGRATIONS_DIRECTORY, name), "utf8"));
  const sections = [
    "-- SECURIUM GENERATED POSTGRES FRESH BASELINE V1.",
    "-- Source: immutable published migrations plus canonical reference-state generation.",
    "-- This artifact is not a historical migration receipt replay.",
    "BEGIN;",
    "",
  ];
  for (const number of names.map((name) => name.slice(0, 4)).filter((number) => number !== "0002" && number !== "0009")) {
    sections.push(`-- SOURCE MIGRATION ${number}`, stripMigrationRegistration(published.get(number)), "");
  }
  sections.push(
    "-- SOURCE SECURITY STATE FROM 0002, APPLIED AFTER ALL CREATOR MIGRATIONS.",
    stripMigrationRegistration(published.get("0002")),
    "",
    "CREATE TABLE app_schema_baseline_receipts (",
    "  baseline_id text PRIMARY KEY,",
    "  baseline_version text NOT NULL,",
    "  schema_boundary text NOT NULL,",
    "  artifact_sha256 text NOT NULL,",
    "  schema_sha256 text NOT NULL,",
    "  security_sha256 text NOT NULL,",
    "  created_from_main_sha text NOT NULL,",
    "  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP",
    ");",
    "",
    "INSERT INTO app_schema_baseline_receipts",
    "  (baseline_id, baseline_version, schema_boundary, artifact_sha256, schema_sha256, security_sha256, created_from_main_sha)",
    `VALUES ('${BASELINE_ID}', '${BASELINE_VERSION}', '${BASELINE_BOUNDARY}',`,
    "  current_setting('securium.baseline_artifact_sha256'),",
    "  current_setting('securium.baseline_schema_sha256'),",
    "  current_setting('securium.baseline_security_sha256'),",
    `  '${SOURCE_MAIN_SHA}');`,
    "",
    "COMMIT;",
    "",
  );
  return sections.join("\n").replaceAll("BEGIN;\nBEGIN;\n", "BEGIN;\n").replaceAll("\nCOMMIT;\n\nCOMMIT;", "\nCOMMIT;");
}

export function classifyBaselineState(input) {
  const {
    applicationRelationCount = 0,
    historicalReceiptCount = 0,
    baselineReceiptCount = 0,
    baselineReceiptValid = false,
    historicalReceiptsValid = false,
  } = input;
  if (baselineReceiptCount > 1 || historicalReceiptCount > 0 && baselineReceiptCount > 0) return "AMBIGUOUS_NONEMPTY";
  if (baselineReceiptCount === 1 && !baselineReceiptValid) return "PARTIAL_BASELINE";
  if (baselineReceiptCount === 1 && baselineReceiptValid && historicalReceiptCount === 0) return "BASELINE_DATABASE";
  if (historicalReceiptCount > 0) return historicalReceiptsValid ? "HISTORICAL_DATABASE" : "UNKNOWN";
  if (applicationRelationCount === 0) return "TRUE_EMPTY";
  return "AMBIGUOUS_NONEMPTY";
}

export function migrationsAfterBoundary(migrations, boundary = BASELINE_BOUNDARY) {
  return migrations.filter((migration) => Number(migration.id.slice(0, 4)) > Number(boundary));
}

export function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function schemaProjection(sql) {
  return sql
    .split("\n")
    .filter((line) => /^(CREATE|ALTER)\s+(TABLE|INDEX|VIEW|TRIGGER)|^\s*(CONSTRAINT|\"[^\"]+\"\s+[^,]+\s+(text|integer|boolean|timestamp))/i.test(line.trim()))
    .map((line) => line.trim().replace(/\s+/g, " "))
    .sort()
    .join("\n");
}

export function securityProjection(sql) {
  return sql
    .split("\n")
    .filter((line) => /REVOKE|GRANT|ROW LEVEL SECURITY|CREATE POLICY|ALTER DEFAULT PRIVILEGES|FORCE ROW LEVEL SECURITY/i.test(line))
    .map((line) => line.trim().replace(/\s+/g, " "))
    .sort()
    .join("\n");
}

function stripMigrationRegistration(sql = "") {
  return sql
    .replace(/^\s*BEGIN;\s*$/gim, "")
    .replace(/^\s*COMMIT;\s*$/gim, "")
    .replace(/\s*INSERT INTO\s+(?:public\.)?app_schema_migrations[\s\S]*?ON CONFLICT \(id\) DO NOTHING;\s*/gi, "")
    .trim();
}
