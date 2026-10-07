import assert from "node:assert/strict";
import { test } from "node:test";
import { PracticalRepository } from "../db/practical-repositories.ts";
import { PracticalAttemptService } from "../lib/services/practical-attempt-service.ts";
import { PRACTICAL_SERVER_AUTHORITY_REQUIRED } from "../lib/policy/practical-registration-authority.ts";

const denial = { name: "AppError", code: PRACTICAL_SERVER_AUTHORITY_REQUIRED, status: 503 };
const claims = { humanReviewHash: "b".repeat(64), rightsBinding: "APPROVED", provenanceBinding: "APPROVED:CURRENT", lifecycle: "CANONICAL_UNPUBLISHED", mappingStatus: "APPROVED", mutationLabel: "CANONICAL_CONTENT_REGISTRATION", replay: { accepted: true }, capability: { authorized: true } };
const snapshotInput = { id: "pv-synthetic", practicalId: "practical:synthetic:one", rubricId: "rubric:synthetic", rubricVersionId: "rv-synthetic", version: 1, snapshotFormatVersion: 1, snapshotJson: "{}", snapshotDigest: "a".repeat(64), effectiveFrom: null, ...claims };
const serviceInput = { ...snapshotInput, snapshot: claims };

class FakeDatabase {
  constructor() { this.mutations = []; }
  async queryOne() { return { id: "rv-synthetic", rubric_id: "rubric:synthetic", version: 1, snapshot_format_version: 1, snapshot_json: "{}", snapshot_digest: "a".repeat(64), created_at: "2026-10-07", effective_from: null, withdrawn_at: null }; }
  async execute(statement) { this.mutations.push(statement); return { affectedRows: 1, returnedRows: [], metadata: { provider: "d1" } }; }
  async transaction(statements) { this.mutations.push(statements); return []; }
}

for (const method of ["insertRubricVersion", "insertDefinitionVersion"]) {
  test(`direct legacy ${method} and replay cannot write caller claims`, async () => {
    const db = new FakeDatabase();
    const repository = new PracticalRepository(db);
    await assert.rejects(() => repository[method](snapshotInput), denial);
    await assert.rejects(() => repository[method](JSON.parse(JSON.stringify(snapshotInput))), denial);
    assert.deepEqual(db.mutations, []);
  });
}

for (const method of ["storeRubricVersion", "storeDefinitionVersion"]) {
  test(`legacy service ${method} denies before entering repository writer`, async () => {
    const writes = [];
    const repository = {
      getRubricVersion: async () => ({ id: "rv-synthetic" }),
      insertRubricVersion: async (input) => writes.push(input),
      insertDefinitionVersion: async (input) => writes.push(input),
    };
    const service = new PracticalAttemptService(repository);
    await assert.rejects(() => service[method](serviceInput), denial);
    await assert.rejects(() => service[method](JSON.parse(JSON.stringify(serviceInput))), denial);
    assert.deepEqual(writes, []);
  });
}

test("legacy repository snapshot and digest validation errors remain unchanged", async () => {
  const db = new FakeDatabase();
  const repository = new PracticalRepository(db);
  for (const method of ["insertRubricVersion", "insertDefinitionVersion"]) {
    await assert.rejects(() => repository[method]({ ...snapshotInput, snapshotJson: "{ }" }), { code: "INVALID_STRUCTURED_FIELD" });
    await assert.rejects(() => repository[method]({ ...snapshotInput, snapshotDigest: "invalid" }), { code: "INVALID_DIGEST" });
  }
  assert.deepEqual(db.mutations, []);
});

test("legacy service validation and existing version reads remain unchanged", async () => {
  const db = new FakeDatabase();
  const repository = new PracticalRepository(db);
  const service = new PracticalAttemptService(repository);
  await assert.rejects(() => service.storeRubricVersion({ ...serviceInput, version: 0 }), { code: "INVALID_RUBRIC_VERSION" });
  await assert.rejects(() => service.storeDefinitionVersion({ ...serviceInput, version: 0 }), { code: "INVALID_PRACTICAL_VERSION" });
  for (const method of ["storeRubricVersion", "storeDefinitionVersion"]) {
    await assert.rejects(() => service[method]({ ...serviceInput, effectiveFrom: "invalid" }), { code: "INVALID_TIMESTAMP" });
  }
  assert.equal((await repository.getRubricVersion("rv-synthetic")).snapshotJson, "{}");
  db.queryOne = async () => null;
  await assert.rejects(() => service.storeDefinitionVersion(serviceInput), { code: "RUBRIC_VERSION_NOT_FOUND" });
  assert.deepEqual(db.mutations, []);
});
