import assert from "node:assert/strict";
import test from "node:test";
import {
  assertCurrentRuntimeAuthorityEvidence,
  assertRuntimeAuthorityBinding,
  assertRuntimeAuthorityGate,
  approvalSubjectHash,
  canonicalRuntimeAuthoritySubject,
  compareRuntimeAuthorityBinding,
  assertPublicationAuthorityBoundary,
  normalizeRuntimeAuthoritySubject,
  type RuntimeAuthoritySubject,
} from "../lib/policy/runtime-authority-binding.ts";
import {
  buildRuntimeAuthorityLifecycleResolver,
  reduceRuntimeAuthorityLifecycle,
  resolveRuntimeAuthorityLifecycle,
  type RuntimeAuthorityLifecycleEvent,
} from "../lib/policy/runtime-authority-lifecycle.ts";
import {
  assertNoCallerAuthorityInjection,
  buildCppgRuntimeAuthoritySubject,
} from "../lib/services/cppg-runtime-authority.ts";

const hash = (letter: string) => letter.repeat(64);
const base: RuntimeAuthoritySubject = Object.freeze({
  contractVersion: "SECURIUM_RUNTIME_AUTHORITY_SUBJECT_V1",
  registrationPurpose: "COURSE_THEORY_DRAFT",
  courseId: "course-cppg",
  courseSlug: "cppg",
  packageKey: "securium-cppg-foundation",
  sourceManifestId: "SECURIUM_CPPG_FOUNDATION_SOURCE_SHA256_V1",
  sourcePackageHash: hash("a"),
  foundationId: "SECURIUM_CPPG_FOUNDATION_V1",
  foundationHash: hash("b"),
  runtimeRevisionId: "cppg-runtime-revision-1",
  semanticHash: hash("c"),
  publicationAuthority: "NOT_GRANTED",
});

const current = () => ({
  state: "CURRENT" as const,
  runtimeRevisionId: base.runtimeRevisionId,
  semanticHash: base.semanticHash,
});

function approval(authorityId: string, subject = base, createdAt = "2026-09-21T00:00:00.000Z"): RuntimeAuthorityLifecycleEvent {
  return { contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1", eventType: "APPROVAL_CREATED", authorityId, subject, approvalSubjectHash: approvalSubjectHash(subject), createdAt };
}

function supersession(authorityId: string, successorAuthorityId: string, successorSubject: RuntimeAuthoritySubject, createdAt = "2026-09-21T00:02:00.000Z"): RuntimeAuthorityLifecycleEvent {
  return { contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1", eventType: "SUPERSESSION_DECLARED", authorityId, successorAuthorityId, successorSubjectHash: approvalSubjectHash(successorSubject), createdAt };
}

function revocation(authorityId: string, createdAt = "2026-09-21T00:03:00.000Z"): RuntimeAuthorityLifecycleEvent {
  return { contractVersion: "SECURIUM_RUNTIME_AUTHORITY_LIFECYCLE_V1", eventType: "REVOCATION_DECLARED", authorityId, reason: "test revocation", createdAt };
}

function expectCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof Error && ((error as Error & { code?: string }).code === code || error.message.includes(code)));
}

async function expectGateCode(input: Parameters<typeof assertRuntimeAuthorityGate>[0], code: string): Promise<void> {
  await assert.rejects(() => assertRuntimeAuthorityGate(input), (error: unknown) => error instanceof Error && ((error as Error & { code?: string }).code === code || error.message.includes(code)));
}

function activeGate(overrides: Partial<Parameters<typeof assertRuntimeAuthorityGate>[0]> = {}): Parameters<typeof assertRuntimeAuthorityGate>[0] {
  return {
    expectedSubject: base,
    resolvedSubject: base,
    authorityId: "authority-1",
    currentnessResolver: { resolveCurrentness: () => current() },
    lifecycleResolver: { resolveLifecycle: () => "APPROVED_ACTIVE" },
    ...overrides,
  };
}

test("exact subject equality and canonical field ordering produce one hash", () => {
  const reordered = Object.fromEntries(Object.entries(base).reverse()) as RuntimeAuthoritySubject;
  assert.equal(canonicalRuntimeAuthoritySubject(base), canonicalRuntimeAuthoritySubject(reordered));
  assert.equal(approvalSubjectHash(base), approvalSubjectHash(reordered));
  assert.equal(approvalSubjectHash({ ...base, actorId: "actor", auditId: "audit", requestId: "request", idempotencyKey: "idempotency" } as RuntimeAuthoritySubject), approvalSubjectHash(base));
  assert.deepEqual(compareRuntimeAuthorityBinding(base, reordered), { valid: true, mismatches: [] });
  assert.equal(compareRuntimeAuthorityBinding({} as RuntimeAuthoritySubject, {} as RuntimeAuthoritySubject).valid, false);
  expectCode(() => canonicalRuntimeAuthoritySubject({ ...base, unexpected: "field" } as RuntimeAuthoritySubject), "APPROVAL_BINDING_MISMATCH");
});

test("canonical subject shape rejects inherited, custom-prototype, non-enumerable, and Symbol ambiguity", () => {
  assert.doesNotThrow(() => normalizeRuntimeAuthoritySubject(base));
  const inheritedUnknown = Object.assign(Object.create({ unexpected: "field" }), base) as RuntimeAuthoritySubject;
  const inheritedMaterial = Object.create({ courseId: base.courseId, semanticHash: base.semanticHash }) as Record<string, unknown>;
  for (const key of ["contractVersion", "registrationPurpose", "courseSlug", "packageKey", "sourceManifestId", "sourcePackageHash", "foundationId", "foundationHash", "runtimeRevisionId", "publicationAuthority"] as const) inheritedMaterial[key] = base[key];
  const customPrototype = Object.assign(Object.create({ injectedAuthority: true }), base) as RuntimeAuthoritySubject;
  const nonEnumerableUnknown = { ...base } as Record<string, unknown>;
  Object.defineProperty(nonEnumerableUnknown, "unexpected", { value: "field", enumerable: false });
  const nonEnumerableMaterial = { ...base } as Record<string, unknown>;
  Object.defineProperty(nonEnumerableMaterial, "semanticHash", { value: base.semanticHash, enumerable: false });
  const symbolField = { ...base } as Record<string | symbol, unknown>;
  Object.defineProperty(symbolField, Symbol("unexpected"), { value: "field", enumerable: true });
  for (const malformed of [inheritedUnknown, inheritedMaterial, customPrototype, nonEnumerableUnknown, nonEnumerableMaterial, symbolField] as RuntimeAuthoritySubject[]) {
    expectCode(() => normalizeRuntimeAuthoritySubject(malformed), "APPROVAL_BINDING_MISMATCH");
    expectCode(() => canonicalRuntimeAuthoritySubject(malformed), "APPROVAL_BINDING_MISMATCH");
    expectCode(() => approvalSubjectHash(malformed), "APPROVAL_BINDING_MISMATCH");
    assert.equal(compareRuntimeAuthorityBinding(malformed, base).valid, false);
    assert.equal(compareRuntimeAuthorityBinding(base, malformed).valid, false);
  }
  const auditMetadata = { ...base, actorId: "actor", auditId: "audit", requestId: "request", idempotencyKey: "idempotency" } as RuntimeAuthoritySubject;
  assert.equal(approvalSubjectHash(auditMetadata), approvalSubjectHash(base));
});

test("every material binding field mutation is rejected", () => {
  for (const field of ["contractVersion", "registrationPurpose", "courseId", "courseSlug", "packageKey", "sourceManifestId", "sourcePackageHash", "foundationId", "foundationHash", "runtimeRevisionId", "semanticHash", "publicationAuthority"] as const) {
    const value = field === "contractVersion" ? "OTHER_CONTRACT" : field === "registrationPurpose" ? "OTHER_PURPOSE" : field === "publicationAuthority" ? "GRANTED" : field.endsWith("Hash") || field === "semanticHash" ? hash("f") : `${base[field]}-changed`;
    const mutated = { ...base, [field]: value } as RuntimeAuthoritySubject;
    assert.equal(compareRuntimeAuthorityBinding(base, mutated).valid, false, field);
    expectCode(() => assertRuntimeAuthorityBinding(base, mutated), "APPROVAL_BINDING_MISMATCH");
    if (["courseId", "courseSlug", "packageKey", "sourceManifestId", "sourcePackageHash", "foundationId", "foundationHash", "runtimeRevisionId", "semanticHash"].includes(field)) assert.notEqual(approvalSubjectHash(base), approvalSubjectHash(mutated), field);
  }
  assert.equal(compareRuntimeAuthorityBinding({} as RuntimeAuthoritySubject, {} as RuntimeAuthoritySubject).valid, false);
  assert.equal(compareRuntimeAuthorityBinding({ ...base, irrelevant: true } as RuntimeAuthoritySubject, base).valid, false);
});

test("currentness accepts only explicitly bound CURRENT evidence and fails closed", () => {
  assert.doesNotThrow(() => assertCurrentRuntimeAuthorityEvidence(base, current()));
  expectCode(() => assertCurrentRuntimeAuthorityEvidence(base, { state: "CURRENT" }), "CURRENTNESS_UNAVAILABLE");
  for (const state of ["UNKNOWN", "HISTORICAL", "REVIEW_REQUIRED", "FUTURE_EFFECTIVE", "CURRENT_WITH_VERSION_UNCERTAINTY"] as const) {
    expectCode(() => assertCurrentRuntimeAuthorityEvidence(base, { state }), state === "UNKNOWN" || state === "REVIEW_REQUIRED" ? "CURRENTNESS_UNAVAILABLE" : "CURRENTNESS_STALE");
  }
  expectCode(() => assertCurrentRuntimeAuthorityEvidence(base, { state: "NOT_A_REAL_STATE" } as never), "CURRENTNESS_UNAVAILABLE");
  expectCode(() => assertCurrentRuntimeAuthorityEvidence(base, null), "CURRENTNESS_UNAVAILABLE");
  expectCode(() => assertCurrentRuntimeAuthorityEvidence(base, { state: "CURRENT", runtimeRevisionId: "old", semanticHash: base.semanticHash }), "CURRENTNESS_STALE");
  expectCode(() => assertCurrentRuntimeAuthorityEvidence(base, { state: "CURRENT", runtimeRevisionId: base.runtimeRevisionId, semanticHash: hash("d") }), "CURRENTNESS_STALE");
});

test("lifecycle resolution is authority-id exact for same-subject approvals", () => {
  const events: RuntimeAuthorityLifecycleEvent[] = [approval("authority-a"), approval("authority-b", base, "2026-09-21T00:01:00.000Z"), revocation("authority-b")];
  assert.equal(resolveRuntimeAuthorityLifecycle(events, "authority-a")?.state, "APPROVED_ACTIVE");
  assert.equal(resolveRuntimeAuthorityLifecycle(events, "authority-b")?.state, "REVOKED");
  const resolver = buildRuntimeAuthorityLifecycleResolver(events);
  assert.equal(resolver(base, "authority-a"), "APPROVED_ACTIVE");
  assert.equal(resolver(base, "authority-b"), "REVOKED");
  assert.equal(resolver(base, "missing-authority"), null);
});

test("append-only lifecycle supports approval, supersession, revocation, and no reactivation", () => {
  const nextSubject = { ...base, runtimeRevisionId: "cppg-runtime-revision-2", semanticHash: hash("d") } as RuntimeAuthoritySubject;
  const events: RuntimeAuthorityLifecycleEvent[] = [approval("authority-1"), approval("authority-2", nextSubject, "2026-09-21T00:01:00.000Z"), supersession("authority-1", "authority-2", nextSubject)];
  assert.equal(resolveRuntimeAuthorityLifecycle(events, "authority-1")?.state, "SUPERSEDED");
  assert.equal(resolveRuntimeAuthorityLifecycle(events, "authority-2")?.state, "APPROVED_ACTIVE");
  const revoked = [...events, revocation("authority-2")];
  assert.equal(resolveRuntimeAuthorityLifecycle(revoked, "authority-2")?.state, "REVOKED");
  expectCode(() => reduceRuntimeAuthorityLifecycle([...revoked, approval("authority-2", nextSubject, "2026-09-21T00:04:00.000Z")]), "AUTHORITY_REVOKED");
  expectCode(() => reduceRuntimeAuthorityLifecycle([...events, approval("authority-1", base, "2026-09-21T00:04:00.000Z")]), "AUTHORITY_SUPERSEDED");
});

test("superseded or revoked same-subject authority never falls back to an older authority", () => {
  const authorityA = approval("authority-a");
  const authorityB = approval("authority-b", base, "2026-09-21T00:01:00.000Z");
  const authorityC = approval("authority-c", base, "2026-09-21T00:02:00.000Z");
  const superseded = [authorityA, authorityB, authorityC, supersession("authority-b", "authority-c", base)];
  const resolver = buildRuntimeAuthorityLifecycleResolver(superseded);
  assert.equal(resolver(base, "authority-b"), "SUPERSEDED");
  assert.equal(resolver(base, "authority-a"), "APPROVED_ACTIVE");
  const revoked = [...superseded, revocation("authority-b", "2026-09-21T00:04:00.000Z")];
  assert.equal(buildRuntimeAuthorityLifecycleResolver(revoked)(base, "authority-b"), "REVOKED");
  assert.equal(buildRuntimeAuthorityLifecycleResolver(revoked)(base, "authority-a"), "APPROVED_ACTIVE");
});

test("lifecycle rejects malformed, out-of-order, duplicate-target, and unknown events deterministically", () => {
  expectCode(() => reduceRuntimeAuthorityLifecycle([null as never]), "AUTHORITY_LIFECYCLE_UNAVAILABLE");
  expectCode(() => reduceRuntimeAuthorityLifecycle([{ eventType: "UNKNOWN" } as never]), "AUTHORITY_LIFECYCLE_UNAVAILABLE");
  expectCode(() => reduceRuntimeAuthorityLifecycle([supersession("missing", "successor", base)]), "AUTHORITY_LIFECYCLE_UNAVAILABLE");
  expectCode(() => reduceRuntimeAuthorityLifecycle([revocation("missing")]), "AUTHORITY_LIFECYCLE_UNAVAILABLE");
  const approved = approval("authority-dup");
  assert.equal(reduceRuntimeAuthorityLifecycle([approved, approved]).records.size, 1);
  assert.equal(reduceRuntimeAuthorityLifecycle([approved, revocation("authority-dup"), revocation("authority-dup", "2026-09-21T00:04:00.000Z")]).records.get("authority-dup")?.state, "REVOKED");
  const successor = approval("successor", base, "2026-09-21T00:01:00.000Z");
  const other = approval("other", base, "2026-09-21T00:01:30.000Z");
  const firstSupersession = supersession("authority-dup", "successor", base);
  const secondSupersession = supersession("authority-dup", "other", base, "2026-09-21T00:05:00.000Z");
  expectCode(() => reduceRuntimeAuthorityLifecycle([approved, successor, other, firstSupersession, secondSupersession]), "AUTHORITY_SUPERSEDED");
  assert.equal(reduceRuntimeAuthorityLifecycle([approved, successor, firstSupersession, revocation("authority-dup")]).records.get("authority-dup")?.state, "REVOKED");
  expectCode(() => reduceRuntimeAuthorityLifecycle([approved, revocation("authority-dup"), supersession("authority-dup", "successor", base)]), "AUTHORITY_REVOKED");
  expectCode(() => reduceRuntimeAuthorityLifecycle([approved, firstSupersession]), "AUTHORITY_LIFECYCLE_UNAVAILABLE");
});

test("exact replay is allowed, changed-subject replay is not, and reapproval needs a new identity", () => {
  const event = approval("authority-replay");
  assert.equal(reduceRuntimeAuthorityLifecycle([event, event]).records.size, 1);
  expectCode(() => reduceRuntimeAuthorityLifecycle([event, approval("authority-replay", { ...base, courseSlug: "wrong-slug" } as RuntimeAuthoritySubject, "2026-09-21T00:01:00.000Z")]), "APPROVAL_BINDING_MISMATCH");
  expectCode(() => reduceRuntimeAuthorityLifecycle([event, revocation("authority-replay"), approval("authority-replay", base, "2026-09-21T00:04:00.000Z")]), "AUTHORITY_REVOKED");
  assert.equal(reduceRuntimeAuthorityLifecycle([event, approval("authority-new", base, "2026-09-21T00:01:00.000Z")]).records.size, 2);
});

test("CPPG production builder owns material authority and rejects caller injection", () => {
  const built = buildCppgRuntimeAuthoritySubject();
  assert.equal(built.subject.courseId, "course-cppg");
  assert.equal(built.subject.courseSlug, "cppg");
  assert.equal(built.subject.registrationPurpose, "COURSE_THEORY_DRAFT");
  assert.equal(built.subject.publicationAuthority, "NOT_GRANTED");
  const runtimeBuilder = buildCppgRuntimeAuthoritySubject as unknown as (...inputs: readonly unknown[]) => unknown;
  expectCode(() => runtimeBuilder({ courseId: base.courseId, courseSlug: base.courseSlug, packageKey: base.packageKey, sourceManifestId: base.sourceManifestId, sourcePackageHash: base.sourcePackageHash, foundationId: base.foundationId, foundationHash: base.foundationHash, runtimeRevisionId: base.runtimeRevisionId, semanticHash: base.semanticHash }), "CPPG_CALLER_AUTHORITY_FIELD_FORBIDDEN:courseId");
  expectCode(() => runtimeBuilder({ sourcePackageHash: hash("z") }), "CPPG_CALLER_AUTHORITY_FIELD_FORBIDDEN:sourcePackageHash");
  expectCode(() => runtimeBuilder({ runtimeRevisionId: "caller-revision" }), "CPPG_CALLER_AUTHORITY_FIELD_FORBIDDEN:runtimeRevisionId");
  for (const key of ["bundle", "sourceRoot", "courseId", "courseSlug", "packageKey", "packageHash", "sourceManifestId", "sourcePackageHash", "foundationId", "foundationHash", "revisionId", "runtimeRevisionId", "semanticHash", "approved", "approval", "currentness", "revocation", "supersession", "authorityId"]) {
    expectCode(() => assertNoCallerAuthorityInjection({ nested: { [key]: "caller-value" } }), `CPPG_CALLER_AUTHORITY_FIELD_FORBIDDEN:${key}`);
  }
});

test("authority gate is explicit, publication-safe, and starts no persistence on any failure", async () => {
  let persistenceBeginCount = 0;
  const failed = async (input: Parameters<typeof assertRuntimeAuthorityGate>[0], code: string) => {
    await expectGateCode(input, code);
    persistenceBeginCount += 0;
  };
  await failed(activeGate({ expectedSubject: null }), "APPROVAL_BINDING_UNAVAILABLE");
  await failed(activeGate({ resolvedSubject: null }), "APPROVAL_BINDING_UNAVAILABLE");
  await failed(activeGate({ expectedSubject: {} as never }), "APPROVAL_BINDING_MISMATCH");
  await failed(activeGate({ resolvedSubject: { ...base, foundationHash: hash("e") } }), "APPROVAL_BINDING_MISMATCH");
  await failed(activeGate({ expectedSubject: { ...base, publicationAuthority: "GRANTED" } as never }), "PUBLICATION_AUTHORITY_FORBIDDEN");
  await failed(activeGate({ currentnessResolver: { resolveCurrentness: () => null } }), "CURRENTNESS_UNAVAILABLE");
  await failed(activeGate({ currentnessResolver: { resolveCurrentness: () => ({ state: "HISTORICAL", runtimeRevisionId: base.runtimeRevisionId, semanticHash: base.semanticHash }) } }), "CURRENTNESS_STALE");
  await failed(activeGate({ lifecycleResolver: { resolveLifecycle: () => "REVOKED" } }), "AUTHORITY_REVOKED");
  await failed(activeGate({ lifecycleResolver: { resolveLifecycle: () => "SUPERSEDED" } }), "AUTHORITY_SUPERSEDED");
  await failed(activeGate({ lifecycleResolver: { resolveLifecycle: () => "UNKNOWN" as never } }), "AUTHORITY_LIFECYCLE_UNAVAILABLE");
  await failed(activeGate({ lifecycleResolver: { resolveLifecycle: () => null } }), "AUTHORITY_LIFECYCLE_UNAVAILABLE");
  await failed(activeGate({ authorityId: undefined }), "AUTHORITY_LIFECYCLE_UNAVAILABLE");
  assert.equal(persistenceBeginCount, 0);
  await assertRuntimeAuthorityGate(activeGate()).then(() => { persistenceBeginCount += 1; });
  assert.equal(persistenceBeginCount, 1);
});

test("publication authority is never granted in Phase 1", () => {
  expectCode(() => assertPublicationAuthorityBoundary({ ...base, publicationAuthority: "GRANTED" }), "PUBLICATION_AUTHORITY_FORBIDDEN");
});
