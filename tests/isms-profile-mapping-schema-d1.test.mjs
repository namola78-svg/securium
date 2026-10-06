import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync("drizzle/0047_isms_profile_mapping_foundation.sql", "utf8").replaceAll("--> statement-breakpoint", "");

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE isms_standards (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE temporal_assertions (id TEXT PRIMARY KEY NOT NULL);
    INSERT INTO users VALUES ('user-1');
    INSERT INTO isms_standards VALUES ('standard-1');
    INSERT INTO temporal_assertions VALUES ('assertion-1');`);
  db.exec(migration);
  return db;
}

function profile(db, id = "profile-1", key = "STRENGTHENED", effectiveFrom = null, effectiveTo = null) {
  db.prepare(`INSERT INTO isms_profiles
    (id, profile_key, profile_type, canonical_label, criteria_state, lifecycle_state, effective_from, effective_to)
    VALUES (?, ?, 'STRENGTHENED', ?, 'PENDING_OFFICIAL_CRITERIA', 'CURRENT', ?, ?)`)
    .run(id, key, key, effectiveFrom, effectiveTo);
}

function mapping(db, {
  id, profileId = "profile-1", standardId = "standard-1", code = null,
  applicability = "APPLIES", state = "CURRENT", from = null, to = null,
  version = 1, authority = "assertion-1", supersedes = null,
} = {}) {
  db.prepare(`INSERT INTO isms_profile_requirement_mappings
    (id, profile_id, standard_id, profile_requirement_code, applicability_state, mapping_state,
     effective_from, effective_to, version, authority_assertion_id, supersedes_mapping_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, profileId, standardId, code, applicability, state, from, to, version, authority, supersedes);
}

test("profile D1 constraints enforce interval, stable key, and pending strengthened zero-mapping validity", () => {
  const db = database();
  profile(db, "strengthened", "STRENGTHENED");
  assert.equal(db.prepare("SELECT count(*) AS count FROM isms_profile_requirement_mappings").get().count, 0);
  assert.throws(() => profile(db, "bad-interval", "BAD_INTERVAL", "2026-10-07", "2026-10-06"), /CHECK constraint failed/i);
  assert.throws(() => profile(db, "duplicate-key", "STRENGTHENED"), /UNIQUE constraint failed/i);
  db.close();
});

test("mapping D1 constraints enforce interval, FKs, states, positive version, and active uniqueness", () => {
  const db = database();
  profile(db);
  assert.throws(() => mapping(db, { id: "bad-interval", from: "2026-10-07", to: "2026-10-06" }), /CHECK constraint failed/i);
  assert.throws(() => mapping(db, { id: "bad-profile", profileId: "missing" }), /FOREIGN KEY constraint failed/i);
  assert.throws(() => mapping(db, { id: "bad-standard", standardId: "missing" }), /FOREIGN KEY constraint failed/i);
  assert.throws(() => mapping(db, { id: "bad-state", applicability: "MAYBE" }), /CHECK constraint failed/i);
  assert.throws(() => mapping(db, { id: "bad-map-state", state: "ACTIVE" }), /CHECK constraint failed/i);
  assert.throws(() => mapping(db, { id: "bad-version", version: 0 }), /CHECK constraint failed/i);
  mapping(db, { id: "current" });
  assert.throws(() => mapping(db, { id: "duplicate-current" }), /UNIQUE constraint failed/i);
  mapping(db, { id: "superseded-history", state: "SUPERSEDED", authority: null, supersedes: "current" });
  assert.equal(db.prepare("SELECT count(*) AS count FROM isms_profile_requirement_mappings").get().count, 2);
  db.close();
});
