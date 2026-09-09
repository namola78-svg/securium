import assert from "node:assert/strict";
import test from "node:test";
import { executeGuardedMigration, MigrationGuardError } from "../scripts/postgres-migration-guard.mjs";

const migration = {
  id: "0038_skill_foundation",
  sql: "-- fixture\nBEGIN; INSERT INTO app_schema_migrations (id, checksum) VALUES ('0038_skill_foundation', 'skill-foundation-v1') ON CONFLICT (id) DO NOTHING; COMMIT;",
};

function session(checksum) {
  return {
    executeControl: async () => {},
    readControls: async () => ({ lockTimeout: "5s", statementTimeout: "60s", idleInTransactionSessionTimeout: "60s", sessionIdentity: "1" }),
    getAppliedMigration: async () => checksum === null ? null : { id: migration.id, checksum },
    readSessionIdentity: async () => "1",
    executeMigration: async () => { throw new Error("DDL must not run for applied fixture"); },
  };
}

test("migration checksum accepts the same ID and checksum", async () => {
  const result = await executeGuardedMigration({ session: session("skill-foundation-v1"), migration, logger: () => {} });
  assert.equal(result.applied, false);
});

test("migration checksum rejects same ID with different checksum", async () => {
  await assert.rejects(
    executeGuardedMigration({ session: session("wrong-checksum"), migration, logger: () => {} }),
    (error) => error instanceof MigrationGuardError && error.code.includes("MIGRATION_GUARD_CHECKSUM_MISMATCH") && error.code.includes("stored=wrong-checksum"),
  );
});

test("migration checksum executes when the ID is not yet recorded", async () => {
  let executed = false;
  const state = session(null);
  state.executeMigration = async () => { executed = true; };
  const result = await executeGuardedMigration({ session: state, migration, logger: () => {} });
  assert.equal(result.applied, true);
  assert.equal(executed, true);
});
