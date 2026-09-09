import { readFile } from "node:fs/promises";
import { createRuntimeDatabaseProvider } from "../db/provider/provider-factory.ts";
import { registerGovernedPracticalVersion } from "../lib/practical/practical-registration.ts";

const args = new Set(process.argv.slice(2));
const manifestFlag = process.argv.indexOf("--manifest");
const manifestPath = manifestFlag >= 0 ? process.argv[manifestFlag + 1] : undefined;
const apply = args.has("--apply");
const nonprod = args.has("--nonprod");

if (!manifestPath || manifestFlag + 1 >= process.argv.length) {
  throw new Error("USAGE: node scripts/register-governed-practical-content.mjs --manifest <path> [--dry-run|--apply --nonprod]");
}
if (apply && !nonprod) {
  throw new Error("NONPROD_CONFIRMATION_REQUIRED");
}
if (apply && process.env.APP_ENV?.trim().toLowerCase() === "production") {
  throw new Error("PRODUCTION_REGISTRATION_FORBIDDEN");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!manifest || manifest.manifestVersion !== "GOVERNED_PRACTICAL_REGISTRATION_V1") {
  throw new Error("UNSUPPORTED_REGISTRATION_MANIFEST");
}
if (!Array.isArray(manifest.registrations) || manifest.registrations.length === 0) {
  throw new Error("REGISTRATION_ENTRIES_REQUIRED");
}

if (!apply) {
  console.log(JSON.stringify({
    mode: "DRY_RUN",
    authority: manifest.authority,
    registrationCount: manifest.registrations.length,
    writes: 0,
    nextStep: "Use --apply --nonprod only with a reviewed manifest and an approved non-production provider.",
  }, null, 2));
  process.exit(0);
}

const database = await createRuntimeDatabaseProvider(process.env);
const results = [];
for (const registration of manifest.registrations) {
  results.push(await registerGovernedPracticalVersion(database, registration));
}
console.log(JSON.stringify({
  mode: "NONPROD_APPLY",
  authority: manifest.authority,
  registrationCount: results.length,
  results,
}, null, 2));
