import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { classifyBaselineState } from "../scripts/postgres-baseline.mjs";
import { validateHistoricalMigrationLedger } from "../scripts/postgres-historical-ledger.mjs";
import {
  HISTORICAL_SUPPLEMENTARY_RECEIPTS,
} from "../scripts/postgres-historical-supplementary-receipts.mjs";
import { expectedMigrationChecksum } from "../scripts/postgres-migration-guard.mjs";

const migrationNames = readdirSync("db/postgres/migrations")
  .filter(name => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const migrations = migrationNames.map(name => ({
  id: name.slice(0, -4),
  sql: readFileSync(`db/postgres/migrations/${name}`, "utf8"),
}));
const historicalRows = migrations.slice(0, 12).map(migration => ({
  id: migration.id,
  checksum: expectedMigrationChecksum(migration),
}));
const supplementaryRows = Object.entries(HISTORICAL_SUPPLEMENTARY_RECEIPTS)
  .map(([id, checksum]) => ({ id, checksum }));

test("production supplementary seed receipts have exact reviewed identities", () => {
  assert.deepEqual(HISTORICAL_SUPPLEMENTARY_RECEIPTS, {
    seed_application_security_questions_2027_2029:
      "manual-application-security-questions-2027-2029",
    seed_information_security_general_questions_2027_2029:
      "manual-information-security-general-questions-2027-2029",
    seed_management_law_questions_2027_2029:
      "manual-management-law-questions-2027-2029",
    seed_network_security_questions_2027_2029:
      "manual-network-security-questions-2027-2029",
    seed_security_certification_course_lessons_2027_2029:
      "manual-security-certification-course-lessons-2027-2029",
    seed_system_security_questions_2027_2029:
      "manual-system-security-questions-2027-2029",
  });
});

test("known supplementary receipts validate without entering numbered progression", () => {
  assert.equal(validateHistoricalMigrationLedger(migrations, {
    migrationRows: [...historicalRows, ...supplementaryRows],
    baselineRelationExists: false,
  }), true);

  const interleaved = [
    historicalRows[0],
    supplementaryRows[0],
    historicalRows[2],
    supplementaryRows[1],
    historicalRows[1],
    ...historicalRows.slice(3),
    ...supplementaryRows.slice(2),
  ];
  assert.equal(validateHistoricalMigrationLedger(migrations, {
    migrationRows: interleaved,
    baselineRelationExists: false,
  }), true);
});

test("supplementary receipts remain fail closed for mismatch, duplicate, and unknown identity", () => {
  assert.throws(() => validateHistoricalMigrationLedger(migrations, {
    migrationRows: [
      ...historicalRows,
      { ...supplementaryRows[0], checksum: "wrong-supplementary-checksum" },
    ],
    baselineRelationExists: false,
  }), /MIGRATION_GUARD_MIGRATION_CHECKSUM_MISMATCH/);

  assert.throws(() => validateHistoricalMigrationLedger(migrations, {
    migrationRows: [
      ...historicalRows,
      supplementaryRows[0],
      supplementaryRows[0],
    ],
    baselineRelationExists: false,
  }), /MIGRATION_GUARD_MIGRATION_LEDGER_DUPLICATE/);

  assert.throws(() => validateHistoricalMigrationLedger(migrations, {
    migrationRows: [
      ...historicalRows,
      { id: "seed_unregistered_historical_receipt", checksum: "unreviewed" },
    ],
    baselineRelationExists: false,
  }), /POSTGRES_HISTORICAL_LEDGER_UNKNOWN_RECEIPT/);
});

test("supplementary receipts cannot establish historical migration authority by themselves", () => {
  assert.throws(() => validateHistoricalMigrationLedger(migrations, {
    migrationRows: supplementaryRows,
    baselineRelationExists: false,
  }), /POSTGRES_HISTORICAL_LEDGER_HISTORICAL_RECEIPT_REQUIRED/);
});

test("validated supplementary receipts do not change historical baseline classification", () => {
  assert.equal(classifyBaselineState({
    applicationRelationCount: 1,
    historicalReceiptCount: historicalRows.length,
    baselineReceiptCount: 0,
    baselineReceiptValid: false,
    historicalReceiptsValid: true,
    postBoundaryMigrationIds: supplementaryRows.map(row => row.id),
    expectedPostBoundaryMigrationIds: [],
  }), "HISTORICAL_DATABASE");
});
