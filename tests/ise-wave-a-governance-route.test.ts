import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../lib/errors.ts";
import { handleIseWaveAGovernanceRequest, type IseWaveAGovernanceRouteDependencies } from "../lib/services/ise-wave-a-governance-route.ts";

const actor = { id: "actor-1", email: "actor@example.test", roles: ["CONTENT_REVIEWER"] } as never;
const database = { kind: "supabase" as const } as never;

function dependencies(overrides: Partial<IseWaveAGovernanceRouteDependencies> = {}) {
  const calls = { readiness: 0, owner: 0, review: 0 };
  const base: IseWaveAGovernanceRouteDependencies = {
    requireUser: async () => actor,
    getDatabase: async () => database,
    assertActor: () => undefined,
    rateLimit: async () => undefined,
    readReadiness: async () => { calls.readiness += 1; return { status: "READY_FOR_BOUNDED_GOVERNANCE", currentnessAvailable: true, currentnessJudgmentPresent: false }; },
    ownerAttest: async (_database, currentActor) => { calls.owner += 1; assert.equal(currentActor, actor); return { outcome: "NEW_ATTESTATION", attestation: { resourceType: "CONTENT_REVISION_REGISTRATION", resourceId: "server-id", reviewedInputIdentity: "a".repeat(64) } }; },
    reviewDomain: async (_database, currentActor, input) => { calls.review += 1; assert.equal(currentActor, actor); return { outcome: "NEW_JUDGMENT", judgment: { reviewDomain: input.reviewDomain, reviewedInputIdentity: "b".repeat(64), result: input.result } }; },
  };
  return { calls, dependencies: { ...base, ...overrides } };
}

test("GET is read-only and returns bounded readiness", async () => {
  const fixture = dependencies();
  const response = await handleIseWaveAGovernanceRequest("GET", new Request("https://app.test/api/admin/ise-wave-a/governance"), fixture.dependencies);
  assert.equal(response.status, 200);
  assert.equal(fixture.calls.readiness, 1);
  assert.equal(fixture.calls.owner, 0);
  assert.equal(fixture.calls.review, 0);
  assert.deepEqual(await response.json(), { status: "READY_FOR_BOUNDED_GOVERNANCE", currentnessAvailable: true, currentnessJudgmentPresent: false });
});

test("anonymous and ordinary users are denied", async () => {
  const anonymous = dependencies({ requireUser: async () => { throw new AppError("Authentication required.", 401, "UNAUTHENTICATED"); } });
  const ordinary = dependencies({ assertActor: () => { throw new AppError("Governance role required.", 403, "ISE_GOVERNANCE_ROLE_REQUIRED"); } });
  assert.equal((await handleIseWaveAGovernanceRequest("GET", new Request("https://app.test"), anonymous.dependencies)).status, 401);
  assert.equal((await handleIseWaveAGovernanceRequest("GET", new Request("https://app.test"), ordinary.dependencies)).status, 403);
  const post = new Request("https://app.test", { method: "POST", headers: { origin: "https://app.test", "content-type": "application/json" }, body: JSON.stringify({ action: "owner-attest", idempotencyKey: "denied-owner" }) });
  assert.equal((await handleIseWaveAGovernanceRequest("POST", post, anonymous.dependencies)).status, 401);
  assert.equal((await handleIseWaveAGovernanceRequest("POST", post, ordinary.dependencies)).status, 403);
});

test("owner-attest and review-domain are the only bounded writes", async () => {
  const owner = dependencies();
  const ownerResponse = await handleIseWaveAGovernanceRequest("POST", new Request("https://app.test/api/admin/ise-wave-a/governance", { method: "POST", headers: { origin: "https://app.test", "content-type": "application/json" }, body: JSON.stringify({ action: "owner-attest", idempotencyKey: "owner-1" }) }), owner.dependencies);
  assert.equal(ownerResponse.status, 201);
  assert.equal(owner.calls.owner, 1);
  const review = dependencies();
  const reviewResponse = await handleIseWaveAGovernanceRequest("POST", new Request("https://app.test/api/admin/ise-wave-a/governance", { method: "POST", headers: { origin: "https://app.test", "content-type": "application/json" }, body: JSON.stringify({ action: "review-domain", reviewDomain: "CURRENTNESS", result: "REVIEW_PERFORMED_PASS", idempotencyKey: "review-1" }) }), review.dependencies);
  assert.equal(reviewResponse.status, 201);
  assert.equal(review.calls.review, 1);
});

test("identity and resource spoof fields are rejected by the strict action contract", async () => {
  const fixture = dependencies();
  const response = await handleIseWaveAGovernanceRequest("POST", new Request("https://app.test", { method: "POST", headers: { origin: "https://app.test", "content-type": "application/json" }, body: JSON.stringify({ action: "owner-attest", idempotencyKey: "owner-spoof", actorId: "spoofed", role: "ADMIN", resourceType: "CONTENT_REVISION", resourceId: "spoofed", ownerId: "spoofed", reviewerId: "spoofed" }) }), fixture.dependencies);
  assert.equal(response.status, 400);
  assert.equal(fixture.calls.owner, 0);
});

test("unknown action and domain are rejected", async () => {
  const fixture = dependencies();
  const unknownAction = await handleIseWaveAGovernanceRequest("POST", new Request("https://app.test", { method: "POST", headers: { origin: "https://app.test", "content-type": "application/json" }, body: JSON.stringify({ action: "authority" }) }), fixture.dependencies);
  const unknownDomain = await handleIseWaveAGovernanceRequest("POST", new Request("https://app.test", { method: "POST", headers: { origin: "https://app.test", "content-type": "application/json" }, body: JSON.stringify({ action: "review-domain", reviewDomain: "AUTHORITY", result: "REVIEW_PERFORMED_PASS", idempotencyKey: "review-2" }) }), fixture.dependencies);
  assert.equal(unknownAction.status, 400);
  assert.equal(unknownDomain.status, 400);
  assert.equal(fixture.calls.owner + fixture.calls.review, 0);
});

test("same-origin and rate-limit boundaries fail closed", async () => {
  const fixture = dependencies();
  const hostile = await handleIseWaveAGovernanceRequest("POST", new Request("https://app.test", { method: "POST", headers: { origin: "https://evil.test", "content-type": "application/json" }, body: JSON.stringify({ action: "owner-attest", idempotencyKey: "owner-2" }) }), fixture.dependencies);
  assert.equal(hostile.status, 403);
  const limited = dependencies({ rateLimit: async () => { throw new AppError("Too many requests.", 429, "RATE_LIMITED"); } });
  const limitedResponse = await handleIseWaveAGovernanceRequest("GET", new Request("https://app.test"), limited.dependencies);
  assert.equal(limitedResponse.status, 429);
});

test("database/provider failures are redacted", async () => {
  const fixture = dependencies({ getDatabase: async () => { throw new Error("FAKE_DATABASE_SECRET_MARKER"); } });
  const response = await handleIseWaveAGovernanceRequest("GET", new Request("https://app.test"), fixture.dependencies);
  const body = await response.text();
  assert.equal(response.status, 500);
  assert.doesNotMatch(body, /FAKE_DATABASE_SECRET_MARKER/);
  assert.doesNotMatch(body, /stack|DATABASE_URL|service_role/i);
});

test("unsupported methods cannot invoke governance actions", async () => {
  const fixture = dependencies();
  const response = await handleIseWaveAGovernanceRequest("PUT", new Request("https://app.test"), fixture.dependencies);
  assert.equal(response.status, 405);
  assert.equal(fixture.calls.owner + fixture.calls.review, 0);
});
