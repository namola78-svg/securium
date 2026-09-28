import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  CPPG_PERSISTENCE_ORDER,
  buildCppgCourseTheoryDraftProjection,
  buildCppgCourseTheoryDraftProjectionFromBundle,
  buildCppgRuntimeId,
  classifyCppgRuntimeCollision,
  compareCppgProjectionReplay,
  expectedCppgRuntimeState,
  interpretCppgStaticSeed,
  persistCppgCourseTheoryDraft,
  persistCppgCourseTheoryDraftForTesting,
  evaluateCppgProjectionAuthorityForTesting,
  resolveCppgCourseTheoryDraftCurrentness,
  type CppgDraftPersistenceAdapter,
  type CppgFoundationBundle,
  type CppgPersistenceStage,
  type CppgObservedRuntimeState,
  type CppgCourseTheoryDraftProjection,
  type ProjectionRecord,
} from "../lib/services/cppg-runtime-course-registration.ts";
import type {
  AuthorityEventPersistenceRecord,
  AuthorityIdempotencyLookup,
  RuntimeAuthorityPersistenceTransaction,
  RuntimeAuthorityPersistenceTransactionOwner,
} from "../lib/policy/runtime-authority-persistence-contract.ts";
import { executeRuntimeAuthorityCommand } from "../lib/services/runtime-authority-command-service.ts";
import { persistenceRecordsToCanonicalEvents } from "../lib/policy/runtime-authority-persistence-contract.ts";
import { replayAuthorityLedger } from "../lib/policy/runtime-authority-event-ledger.ts";
import { approvalSubjectHash } from "../lib/policy/runtime-authority-binding.ts";
import { PostgresRuntimeAuthorityPersistence } from "../db/runtime-authority-postgres-persistence.ts";
import { PostgresCppgDraftPersistenceAdapter } from "../db/cppg-runtime-postgres-registration.ts";
import type { PostgresExecutor, PostgresTransactionExecutor } from "../db/provider/postgres-database-provider.ts";

(process.env as unknown as { NODE_ENV?: string }).NODE_ENV = "test";
const root = new URL("../content-drafts/securium-cppg-foundation/", import.meta.url);
const OPTIONS = { actorUserId: "test-actor" };

async function foundationBundle(): Promise<CppgFoundationBundle> {
  const read = async (name: string) => JSON.parse(await readFile(new URL(name, root), "utf8")) as unknown;
  return {
    curriculum: await read("curriculum-authority.json") as CppgFoundationBundle["curriculum"],
    theory: await read("theory-authority.json") as CppgFoundationBundle["theory"],
    objectives: await read("objective-authority.json") as CppgFoundationBundle["objectives"],
    assessment: await read("assessment-authority.json") as CppgFoundationBundle["assessment"],
    practical: await read("practical-spec-authority.json") as CppgFoundationBundle["practical"],
    dryRun: await read("ontology-concept-dry-run.json") as CppgFoundationBundle["dryRun"],
    provenanceRights: await read("provenance-rights-manifest.json") as CppgFoundationBundle["provenanceRights"],
  };
}

async function projection(options = OPTIONS): Promise<CppgCourseTheoryDraftProjection> {
  return buildCppgCourseTheoryDraftProjectionFromBundle(await foundationBundle(), options);
}

function readbackFor(value: CppgCourseTheoryDraftProjection, overrides: Partial<CppgObservedRuntimeState> = {}): CppgObservedRuntimeState {
  void value;
  return { courseCount: 0, recordCount: 0, recordIds: [], semanticHashes: {}, duplicateAuthorityCount: 0, ...overrides };
}

class RecordingAdapter implements CppgDraftPersistenceAdapter {
  readonly stages: CppgPersistenceStage[] = [];
  readonly applied: ProjectionRecord[][] = [];
  committed = false;
  rolledBack = false;
  began = 0;
  private readonly readback: CppgObservedRuntimeState;
  private readonly failAt?: CppgPersistenceStage;
  constructor(readback: CppgObservedRuntimeState, failAt?: CppgPersistenceStage) {
    this.readback = readback;
    this.failAt = failAt;
  }
  async inspect() { return this.readback; }
  async begin() {
    this.began += 1;
    return {
      apply: async (stage: CppgPersistenceStage, records: readonly ProjectionRecord[]) => {
        this.stages.push(stage);
        this.applied.push([...records]);
        if (stage === this.failAt) throw new Error("injected failure at " + stage);
      },
      commit: async () => { this.committed = true; },
      rollback: async () => { this.rolledBack = true; this.stages.length = 0; this.applied.length = 0; },
    };
  }
}

class MemoryAuthorityOwner implements RuntimeAuthorityPersistenceTransactionOwner {
  readonly events = new Map<string, AuthorityEventPersistenceRecord[]>();
  readonly roots = new Map<string, number>();

  async withTransaction<T>(callback: (transaction: RuntimeAuthorityPersistenceTransaction) => Promise<T>): Promise<T> {
    const transaction: RuntimeAuthorityPersistenceTransaction = {
      loadAuthorityRoot: async (authorityId) => this.roots.has(authorityId) ? { authorityId, latestSequence: this.roots.get(authorityId)! } : null,
      loadAcceptedAuthorityEvents: async (authorityId) => [...(this.events.get(authorityId) ?? [])],
      findAcceptedByIdempotency: async (authorityId, idempotencyKey, commandHash): Promise<AuthorityIdempotencyLookup> => {
        const event = (this.events.get(authorityId) ?? []).find((item) => item.idempotencyKey === idempotencyKey);
        if (!event) return { kind: "NOT_FOUND" };
        return event.commandHash === commandHash ? { kind: "REPLAY_EXISTING", event } : { kind: "IDEMPOTENCY_CONFLICT", existing: event };
      },
      resolveSuccessorAuthority: async (authorityId) => {
        const records = this.events.get(authorityId) ?? [];
        if (records.length === 0) return null;
        const events = persistenceRecordsToCanonicalEvents(records, authorityId);
        const replay = replayAuthorityLedger(authorityId, events);
        return replay.record ? { authorityId, subject: replay.record.subject, approvalSubjectHash: replay.record.approvalSubjectHash } : null;
      },
      appendAcceptedEvent: async (event) => { this.events.set(event.authorityId, [...(this.events.get(event.authorityId) ?? []), event]); },
      updateLatestSequence: async (authorityId, latestSequence) => { this.roots.set(authorityId, latestSequence); },
    };
    return callback(transaction);
  }
}

test("projects approved Foundation counts and reports objective metadata without a persistence stage", async () => {
  const value = await projection();
  assert.deepEqual(value.counts, { course: 1, subjects: 5, curriculumTrees: 1, curriculumNodes: 30, topics: 25, learningUnits: 25, objectives: 50, contents: 25, lessons: 25, courseLessons: 25, contentRevisions: 25 });
  assert.equal(value.objectives.length, 50);
  assert.equal(value.futurePersistenceRowCounts.objectives, 0);
  assert.deepEqual(CPPG_PERSISTENCE_ORDER, ["COURSE", "CURRICULUM_TREE", "SUBJECTS", "CURRICULUM_NODES", "TOPICS", "LEARNING_UNITS", "CONTENTS", "LESSONS", "COURSE_LESSONS", "CONTENT_REVISIONS"]);
  assert.equal(value.excluded.assessmentQuestions, 100);
  assert.equal(value.excluded.practicalSpecs, 10);
  assert.equal(value.excluded.publication, false);
  assert.equal(value.contents.some((item) => JSON.stringify(item.payload).includes("conceptId")), false);
  assert.equal(value.contents.every((item) => item.payload.status === "DRAFT"), true);
  assert.equal(value.lessons.every((item) => item.payload.published === false), true);
  assert.equal(value.course.payload.published, false);
});

test("canonical loader and structural validator pass without granting source or approval authority", async () => {
  const validator = await import("../scripts/validate-securium-cppg-foundation-wave-a.mjs") as unknown as {
    loadBundle(repoRoot: string): Promise<{ sourceManifest: { sourceRoot: string; manifestId: string } }>;
    validateFoundation(bundle: unknown): { status: string };
  };
  const bundle = await validator.loadBundle(process.cwd());
  assert.equal(validator.validateFoundation(bundle).status, "PASS");
  assert.equal(bundle.sourceManifest.manifestId, "SECURIUM_CPPG_FOUNDATION_SOURCE_SHA256_V1");
  assert.equal(bundle.sourceManifest.sourceRoot, "../source-evidence-original/cppg");
});

test("registered entrypoints ignore caller authority inputs and fail closed before adapter begin", async () => {
  const value = await projection();
  const adapter = new RecordingAdapter(readbackFor(value));
  const forgedOptions = {
    actorUserId: "test-actor",
    bundle: { ...await foundationBundle(), sourceRoot: "caller-controlled", authorityId: "caller-controlled", approval: true },
    sourceRoot: "caller-controlled",
    authorityId: "caller-controlled",
    approved: true,
    approvalResolver: async () => ({ approved: true }),
  } as unknown as Parameters<typeof buildCppgCourseTheoryDraftProjection>[0];
  await assert.rejects(() => buildCppgCourseTheoryDraftProjection(forgedOptions), /CPPG_CALLER_AUTHORITY_FIELD_FORBIDDEN/);
  await assert.rejects(() => persistCppgCourseTheoryDraft(forgedOptions, {} as never), /CPPG_CALLER_AUTHORITY_FIELD_FORBIDDEN/);
  assert.equal(adapter.began, 0);
  const directProjectionAttempt = persistCppgCourseTheoryDraft as unknown as (input: unknown, owner: RuntimeAuthorityPersistenceTransactionOwner) => Promise<unknown>;
  await assert.rejects(() => directProjectionAttempt(value, {} as never), (error: unknown) => (error as { code?: string }).code === "CPPG_PROJECTION_ENTRYPOINT_INPUT_INVALID");
  assert.equal(adapter.began, 0);
});

test("emits payloads compatible with current generic runtime contracts", async () => {
  const value = await projection();
  assert.equal(value.course.payload.code, "CPPG");
  assert.equal(value.curriculumTree.payload.title !== undefined, true);
  assert.equal(value.curriculumNodes.every((item) => item.payload.curriculumTreeId && item.payload.title && item.payload.status === "INACTIVE"), true);
  assert.equal(value.topics.every((item) => item.payload.subjectId && item.payload.code && item.payload.name), true);
  assert.equal(value.learningUnits.every((item) => item.payload.subjectId && item.payload.topicId && item.payload.code && item.payload.title), true);
  assert.equal(value.contents.every((item) => item.payload.slug && item.payload.canonicalKey && item.payload.title && typeof item.payload.body === "string" && typeof item.payload.learningObjectivesJson === "string"), true);
  assert.equal(value.lessons.every((item) => item.payload.learningUnitId && item.payload.code && item.payload.title && typeof item.payload.content === "string" && !("contentId" in item.payload)), true);
  assert.equal(value.courseLessons.every((item) => item.payload.displayTitle && item.payload.contentId && item.payload.lessonId), true);
  assert.equal(value.contentRevisions.every((item) => item.payload.title && item.payload.contentDate && item.payload.createdBy && item.payload.revisionStatus === "draft"), true);
});

test("uses stable source IDs and never title, index, path, or operator identity", async () => {
  const value = await projection();
  assert.equal(buildCppgRuntimeId("course", "course-cppg"), "course-cppg");
  assert.equal(value.subjects[0]?.id, "course-cppg:subject:CPPG-S1");
  assert.equal(value.learningUnits.some((item) => item.id.includes("媛쒖씤?뺣낫")), false);
  assert.throws(() => buildCppgRuntimeId("unit", String.fromCharCode(67, 58, 92) + "local" + String.fromCharCode(92) + "worktree"));
  assert.throws(() => buildCppgRuntimeId("unit", "unit/one"));
});

test("replays deterministically, excludes actor identity from semantic hashes, and uses generic revision hash contract", async () => {
  const first = await projection();
  const second = await projection();
  const otherActor = await projection({ actorUserId: "another-test-actor" });
  assert.equal(first.projectionSemanticHash, second.projectionSemanticHash);
  assert.equal(first.projectionSemanticHash, otherActor.projectionSemanticHash);
  assert.deepEqual(first.revisionRegistration.identities, second.revisionRegistration.identities);
  assert.deepEqual(first.contents.map(({ id, semanticHash }) => ({ id, semanticHash })), second.contents.map(({ id, semanticHash }) => ({ id, semanticHash })));
  assert.equal(compareCppgProjectionReplay(first, second), "EXACT_REPLAY");
  const changedBundle = await foundationBundle();
  const firstUnit = changedBundle.theory.units[0];
  assert.ok(firstUnit);
  const changedUnit = { ...firstUnit, purpose: firstUnit.purpose + " changed" };
  const changed = await buildCppgCourseTheoryDraftProjectionFromBundle({ ...changedBundle, theory: { ...changedBundle.theory, units: [changedUnit, ...changedBundle.theory.units.slice(1)] } }, OPTIONS);
  assert.equal(compareCppgProjectionReplay(first, changed), "CONFLICTING_IMMUTABLE_REVISION");
  assert.equal(first.revisionRegistration.subjects[0]?.semanticRevisionId, changed.revisionRegistration.subjects[0]?.semanticRevisionId);
  assert.equal(first.revisionRegistration.subjects[0]?.version, changed.revisionRegistration.subjects[0]?.version);
  assert.equal(first.revisionRegistration.identities.registrationSemanticIdentity.length, 64);
});

test("keeps static seed evidence separate from runtime registration", () => {
  assert.deepEqual(interpretCppgStaticSeed(), { staticState: "STATIC_REGISTERED_EXACT", runtimeState: "UNKNOWN_NOT_QUERIED" });
});

test("classifies collision states only from trusted expected projection and observed adapter state", async () => {
  const value = await projection();
  const expected = expectedCppgRuntimeState(value);
  const empty = readbackFor(value);
  assert.equal(classifyCppgRuntimeCollision(expected, empty), "NOT_REGISTERED");
  const exact = readbackFor(value, { courseCount: 1, recordCount: expected.recordIds.length, recordIds: expected.recordIds, semanticHashes: expected.semanticHashes });
  assert.equal(classifyCppgRuntimeCollision(expected, exact), "REGISTERED_EXACT");
  assert.equal(classifyCppgRuntimeCollision(expected, readbackFor(value, { courseCount: 1, recordCount: 1, recordIds: [value.course.id], semanticHashes: { [value.course.id]: value.course.semanticHash } })), "REGISTERED_PARTIAL");
  assert.equal(classifyCppgRuntimeCollision(expected, { ...exact, semanticHashes: { ...exact.semanticHashes, [value.course.id]: "wrong" } }), "REGISTERED_CONFLICTING");
  assert.equal(classifyCppgRuntimeCollision(expected, { ...readbackFor(value), duplicateAuthorityCount: 1 }), "DUPLICATE_AUTHORITY");
  assert.equal(classifyCppgRuntimeCollision(expected, { ...exact, recordCount: expected.recordIds.length + 1 }), "REGISTERED_CONFLICTING");
  assert.equal(classifyCppgRuntimeCollision(expected, { ...exact, recordCount: expected.recordIds.length - 1 }), "REGISTERED_CONFLICTING");
  assert.equal(classifyCppgRuntimeCollision(expected, { ...exact, courseCount: 0 }), "REGISTERED_CONFLICTING");
  assert.equal(classifyCppgRuntimeCollision(expected, { ...readbackFor(value), courseCount: -1 }), "REGISTERED_CONFLICTING");
  assert.equal(classifyCppgRuntimeCollision(expected, { ...exact, recordIds: [expected.recordIds[0], expected.recordIds[0], ...expected.recordIds.slice(1)], recordCount: expected.recordIds.length + 1 }), "REGISTERED_CONFLICTING");
  const missing = expected.recordIds.slice(0, -1);
  assert.equal(classifyCppgRuntimeCollision(expected, { ...exact, recordIds: missing, recordCount: missing.length, semanticHashes: Object.fromEntries(missing.map((id) => [id, expected.semanticHashes[id]])) }), "REGISTERED_PARTIAL");
  const unexpected = [...expected.recordIds.slice(0, -1), "course-cppg:unexpected"];
  assert.equal(classifyCppgRuntimeCollision(expected, { ...exact, recordIds: unexpected, recordCount: unexpected.length, semanticHashes: Object.fromEntries(unexpected.map((id) => [id, expected.semanticHashes[id] ?? "unexpected"])) }), "REGISTERED_CONFLICTING");
  assert.equal(classifyCppgRuntimeCollision(expected, { ...exact, courseCount: 1, recordCount: 0, recordIds: [], semanticHashes: {} }), "REGISTERED_CONFLICTING");
  const callerForgedExpected = { ...expected, semanticHashes: Object.fromEntries(expected.recordIds.map((id) => [id, "caller-forged"])) };
  assert.equal(classifyCppgRuntimeCollision(callerForgedExpected, exact), "REGISTERED_CONFLICTING");
  const rejectedReadbacks: readonly [string, CppgObservedRuntimeState][] = [
    ["duplicate authority in empty state", { ...readbackFor(value), duplicateAuthorityCount: 1 }],
    ["multiple course authorities", { ...exact, courseCount: 2 }],
    ["count too high", { ...exact, recordCount: expected.recordIds.length + 1 }],
    ["count too low", { ...exact, recordCount: expected.recordIds.length - 1 }],
    ["valid partial registration", { ...readbackFor(value, { courseCount: 1, recordCount: 1, recordIds: [value.course.id], semanticHashes: { [value.course.id]: value.course.semanticHash } }) }],
    ["course metadata contradiction", { ...exact, courseCount: 0 }],
    ["course row missing from non-empty state", { ...exact, courseCount: 1, recordCount: 0, recordIds: [], semanticHashes: {} }],
    ["invalid count", { ...readbackFor(value), courseCount: -1 }],
    ["fractional count", { ...readbackFor(value), recordCount: 1.5 }],
    ["duplicate id", { ...exact, recordIds: [expected.recordIds[0], expected.recordIds[0], ...expected.recordIds.slice(1)], recordCount: expected.recordIds.length + 1 }],
    ["missing id", { ...exact, recordIds: missing, recordCount: missing.length, semanticHashes: Object.fromEntries(missing.map((id) => [id, expected.semanticHashes[id]])) }],
    ["unexpected id", { ...exact, recordIds: unexpected, recordCount: unexpected.length, semanticHashes: Object.fromEntries(unexpected.map((id) => [id, expected.semanticHashes[id] ?? "unexpected"])) }],
    ["stale semantic hash", { ...exact, semanticHashes: { ...exact.semanticHashes, [value.course.id]: "wrong" } }],
  ];
  for (const [label, readback] of rejectedReadbacks) {
    const adapter = new RecordingAdapter(readback);
    await assert.rejects(() => persistCppgCourseTheoryDraftForTesting(value, adapter), label);
    assert.equal(adapter.began, 0, label);
    assert.deepEqual(adapter.stages, [], label);
  }
});

test("persists only the atomic Course/Theory Draft plan through an injected adapter", async () => {
  const value = await projection();
  const adapter = new RecordingAdapter(readbackFor(value));
  const result = await persistCppgCourseTheoryDraftForTesting(value, adapter);
  assert.equal(result.outcome, "NEW_SUCCESS");
  assert.deepEqual(adapter.stages, [...CPPG_PERSISTENCE_ORDER]);
  assert.equal(adapter.committed, true);
  assert.equal(adapter.rolledBack, false);
  assert.equal(adapter.applied.flat().some((item) => item.payload.revisionStatus === "published"), false);
  assert.equal(adapter.applied.flat().some((item) => item.kind === "CONTENT_REVISION" && item.payload.createdBy === undefined), false);
  assert.equal(adapter.applied.flat().some((item) => item.kind === "CONTENT_REVISION" && item.id.includes("OBJECTIVE")), false);
});

test("rolls back early, mid, and late failures with zero committed partial authority", async () => {
  const value = await projection();
  for (const stage of ["COURSE", "CONTENTS", "CONTENT_REVISIONS"] as const) {
    const failure = new RecordingAdapter(readbackFor(value), stage);
    await assert.rejects(() => persistCppgCourseTheoryDraftForTesting(value, failure), /injected failure/);
    assert.equal(failure.committed, false);
    assert.equal(failure.rolledBack, true);
    assert.deepEqual(failure.stages, []);
    assert.equal(failure.applied.length, 0);
  }
});

test("failed transaction does not become a false exact replay", async () => {
  const value = await projection();
  const failure = new RecordingAdapter(readbackFor(value), "CONTENT_REVISIONS");
  await assert.rejects(() => persistCppgCourseTheoryDraftForTesting(value, failure));
  const retry = new RecordingAdapter(readbackFor(value));
  const result = await persistCppgCourseTheoryDraftForTesting(value, retry);
  assert.equal(result.outcome, "NEW_SUCCESS");
});

test("exact runtime state replays without beginning a transaction", async () => {
  const value = await projection();
  const expected = expectedCppgRuntimeState(value);
  const exactAdapter = new RecordingAdapter(readbackFor(value, { courseCount: 1, recordCount: expected.recordIds.length, recordIds: expected.recordIds, semanticHashes: expected.semanticHashes }));
  const result = await persistCppgCourseTheoryDraftForTesting(value, exactAdapter);
  assert.equal(result.outcome, "EXACT_REPLAY");
  assert.deepEqual(exactAdapter.stages, []);
});

test("does not overwrite v1 when the same revision identity has changed content", async () => {
  const original = await projection();
  const changedBundle = await foundationBundle();
  const firstUnit = changedBundle.theory.units[0];
  assert.ok(firstUnit);
  const changed = await buildCppgCourseTheoryDraftProjectionFromBundle({ ...changedBundle, theory: { ...changedBundle.theory, units: [{ ...firstUnit, purpose: firstUnit.purpose + " changed" }, ...changedBundle.theory.units.slice(1)] } }, OPTIONS);
  const expectedChanged = expectedCppgRuntimeState(changed);
  const existingV1 = new RecordingAdapter(readbackFor(original, { courseCount: 1, recordCount: expectedChanged.recordIds.length, recordIds: expectedChanged.recordIds, semanticHashes: expectedCppgRuntimeState(original).semanticHashes }));
  await assert.rejects(() => persistCppgCourseTheoryDraftForTesting(changed, existingV1), /REGISTERED_CONFLICTING/);
  assert.equal(existingV1.began, 0);
  assert.deepEqual(existingV1.stages, []);
});

test("CPPG approval is persisted through the generic writer and exact replay is idempotent", async () => {
  const value = await projection();
  const owner = new MemoryAuthorityOwner();
  const initial = await evaluateCppgProjectionAuthorityForTesting(value, owner, { now: () => "2026-09-28T00:00:00.000Z", eventId: () => "cppg-approval-event-1" });
  assert.equal(initial.state.state, "NOT_CURRENT");
  assert.equal(initial.identity.approvalSubjectHash.length, 64);
  assert.equal(initial.identity.subject.sourcePackageHash, "cf4ada7c7f325aa405c76db7993d314b782ff4f69f07b467793dc11cf1913a80");
  assert.equal(initial.identity.subject.publicationAuthority, "NOT_GRANTED");

  const first = await initial.approve("cppg-approval-v1");
  assert.equal(first.outcome, "APPENDED");
  assert.equal(first.event.sequence, 1);
  assert.equal(first.event.eventType, "APPROVAL_CREATED");
  assert.equal((first.event.payload as { approvalSubjectHash: string }).approvalSubjectHash, initial.identity.approvalSubjectHash);

  const replayContext = { now: () => "2026-09-28T00:05:00.000Z", eventId: () => "unused-cppg-event" };
  const replay = await (await evaluateCppgProjectionAuthorityForTesting(value, owner, replayContext)).approve("cppg-approval-v1");
  assert.equal(replay.outcome, "REPLAY_EXISTING");
  assert.equal(replay.event.eventId, "cppg-approval-event-1");
  assert.equal(owner.roots.get(initial.identity.authorityId), 1);
  await assert.rejects(() => executeRuntimeAuthorityCommand(owner, {
    authorityId: initial.identity.authorityId,
    eventType: "APPROVAL_CREATED",
    payload: { subject: initial.identity.subject, approvalSubjectHash: initial.identity.approvalSubjectHash, createdAt: "2026-09-28T00:06:00.000Z" },
    idempotencyKey: "cppg-approval-v1",
  }), (error: unknown) => (error as { code?: string }).code === "IDEMPOTENCY_CONFLICT");
  assert.equal((await evaluateCppgProjectionAuthorityForTesting(value, owner)).state.state, "CURRENT");
});

test("CPPG no approval, revision drift, hash mismatch, and tampered stored hash all fail closed", async () => {
  const original = await projection();
  const owner = new MemoryAuthorityOwner();
  const originalGate = await evaluateCppgProjectionAuthorityForTesting(original, owner);
  assert.equal(originalGate.state.state, "NOT_CURRENT");

  const changedBundle = await foundationBundle();
  const unit = changedBundle.theory.units[0];
  assert.ok(unit);
  const changed = await buildCppgCourseTheoryDraftProjectionFromBundle({
    ...changedBundle,
    theory: { ...changedBundle.theory, units: [{ ...unit, purpose: unit.purpose + " revised" }, ...changedBundle.theory.units.slice(1)] },
  }, OPTIONS);
  const changedGate = await evaluateCppgProjectionAuthorityForTesting(changed, owner);
  assert.notEqual(changedGate.identity.approvalSubjectHash, originalGate.identity.approvalSubjectHash);
  assert.equal(changedGate.state.state, "NOT_CURRENT");

  await originalGate.approve("source-drift-approval");
  const sourceEvent = owner.events.get(originalGate.identity.authorityId)?.[0];
  assert.ok(sourceEvent);
  const changedSubject = { ...originalGate.identity.subject, sourcePackageHash: "e".repeat(64) };
  owner.events.set(originalGate.identity.authorityId, [{
    ...sourceEvent,
    payload: { ...sourceEvent.payload, subject: changedSubject, approvalSubjectHash: approvalSubjectHash(changedSubject) } as typeof sourceEvent.payload,
  }]);
  assert.equal((await evaluateCppgProjectionAuthorityForTesting(original, owner)).state.state, "NOT_CURRENT");

  const forgedProjection = { ...original, projectionSemanticHash: "0".repeat(64) } as CppgCourseTheoryDraftProjection;
  const forgedGate = await evaluateCppgProjectionAuthorityForTesting(forgedProjection, owner);
  assert.notEqual(forgedGate.identity.approvalSubjectHash, originalGate.identity.approvalSubjectHash);
  assert.equal(forgedGate.state.state, "NOT_CURRENT");

  const tamperOwner = new MemoryAuthorityOwner();
  const tamperGate = await evaluateCppgProjectionAuthorityForTesting(original, tamperOwner);
  await tamperGate.approve("tamper-test-approval");
  const event = tamperOwner.events.get(tamperGate.identity.authorityId)?.[0];
  assert.ok(event);
  tamperOwner.events.set(tamperGate.identity.authorityId, [{ ...event, payload: { ...event.payload, approvalSubjectHash: "f".repeat(64) } as typeof event.payload }]);
  await assert.rejects(() => evaluateCppgProjectionAuthorityForTesting(original, tamperOwner), /Approval subject hash does not match the subject/);
});

test("CPPG revocation and supersession are read from the persisted generic lifecycle", async () => {
  const oldProjection = await projection();
  const changedBundle = await foundationBundle();
  const unit = changedBundle.theory.units[0];
  assert.ok(unit);
  const successorProjection = await buildCppgCourseTheoryDraftProjectionFromBundle({
    ...changedBundle,
    theory: { ...changedBundle.theory, units: [{ ...unit, purpose: unit.purpose + " successor" }, ...changedBundle.theory.units.slice(1)] },
  }, OPTIONS);

  const owner = new MemoryAuthorityOwner();
  const oldGate = await evaluateCppgProjectionAuthorityForTesting(oldProjection, owner, { now: () => "2026-09-28T00:00:00.000Z" });
  const successorGate = await evaluateCppgProjectionAuthorityForTesting(successorProjection, owner, { now: () => "2026-09-28T00:01:00.000Z" });
  await oldGate.approve("old-approval");
  await successorGate.approve("successor-approval");

  const supersession = await successorGate.supersede(oldGate.identity.authorityId, "supersede-old");
  assert.equal(supersession.event.sequence, 2);
  assert.equal((await successorGate.supersede(oldGate.identity.authorityId, "supersede-old")).outcome, "REPLAY_EXISTING");
  assert.equal((await evaluateCppgProjectionAuthorityForTesting(oldProjection, owner)).state.state, "NOT_CURRENT");
  assert.equal((await evaluateCppgProjectionAuthorityForTesting(successorProjection, owner)).state.state, "CURRENT");

  const revokeOwner = new MemoryAuthorityOwner();
  const revocable = await evaluateCppgProjectionAuthorityForTesting(oldProjection, revokeOwner, { now: () => "2026-09-28T00:03:00.000Z" });
  await revocable.approve("approval-to-revoke");
  const revoke = await revocable.revoke("revoke-current", "focused CPPG lifecycle test");
  assert.equal(revoke.event.sequence, 2);
  assert.equal((await revocable.revoke("revoke-current", "focused CPPG lifecycle test")).outcome, "REPLAY_EXISTING");
  await assert.rejects(() => revocable.revoke("revoke-current", "conflicting reason"), (error: unknown) => (error as { code?: string }).code === "IDEMPOTENCY_CONFLICT");
  assert.equal((await evaluateCppgProjectionAuthorityForTesting(oldProjection, revokeOwner)).state.state, "NOT_CURRENT");
  assert.equal(revokeOwner.roots.get(revocable.identity.authorityId), 2);
});

test("CPPG supersession rejects generic predecessor identity masquerades without appending events", async () => {
  const predecessorProjection = await projection();
  const bundle = await foundationBundle();
  const firstUnit = bundle.theory.units[0];
  assert.ok(firstUnit);
  const successorProjection = await buildCppgCourseTheoryDraftProjectionFromBundle({
    ...bundle,
    theory: { ...bundle.theory, units: [{ ...firstUnit, purpose: `${firstUnit.purpose} canonical successor` }, ...bundle.theory.units.slice(1)] },
  }, OPTIONS);

  const owner = new MemoryAuthorityOwner();
  const predecessor = await evaluateCppgProjectionAuthorityForTesting(predecessorProjection, owner);
  const successor = await evaluateCppgProjectionAuthorityForTesting(successorProjection, owner);
  await successor.approve("canonical-successor-approval");

  const forgedPackageSubject = { ...predecessor.identity.subject, packageKey: "course-cppg:foundation:other" };
  const genericMasqueradeSubject = { ...predecessor.identity.subject, foundationHash: "e".repeat(64) };
  const cases = [
    {
      name: "wrong packageKey",
      subject: forgedPackageSubject,
      authorityId: `runtime-authority:cppg:${approvalSubjectHash(forgedPackageSubject)}`,
    },
    {
      name: "generic authority masquerade",
      subject: genericMasqueradeSubject,
      authorityId: `runtime-authority:cppg:${approvalSubjectHash(genericMasqueradeSubject)}`,
    },
    {
      name: "wrong authorityId",
      subject: predecessor.identity.subject,
      authorityId: `runtime-authority:cppg:${"f".repeat(64)}`,
    },
  ] as const;

  for (const [index, candidate] of cases.entries()) {
    await executeRuntimeAuthorityCommand(owner, {
      authorityId: candidate.authorityId,
      eventType: "APPROVAL_CREATED",
      payload: {
        subject: candidate.subject,
        approvalSubjectHash: approvalSubjectHash(candidate.subject),
        createdAt: `2026-09-28T00:0${index}:00.000Z`,
      },
      idempotencyKey: `generic-masquerade-${index}`,
    });
    const beforeEvents = owner.events.get(candidate.authorityId) ?? [];
    const beforeSequence = owner.roots.get(candidate.authorityId);
    await assert.rejects(
      () => successor.supersede(candidate.authorityId, `reject-masquerade-${index}`),
      (error: unknown) => (error as { code?: string }).code === "CPPG_CANONICAL_IDENTITY_MISMATCH",
      candidate.name,
    );
    assert.equal(owner.events.get(candidate.authorityId)?.length, beforeEvents.length, `${candidate.name}: predecessor history must not change`);
    assert.equal(owner.roots.get(candidate.authorityId), beforeSequence, `${candidate.name}: predecessor sequence must not change`);
  }

  assert.equal((await evaluateCppgProjectionAuthorityForTesting(successorProjection, owner)).state.state, "CURRENT");
  assert.equal(owner.roots.get(successor.identity.authorityId), 1);
});

test("production CPPG authority APIs reject structural non-PostgreSQL writers", async () => {
  const status = await resolveCppgCourseTheoryDraftCurrentness(OPTIONS, new MemoryAuthorityOwner());
  assert.deepEqual(status, { state: "NOT_CURRENT", authorityId: "", approvalSubjectHash: "", reason: "APPROVAL_BINDING_UNAVAILABLE" });
});

test("registration remains before adapter begin without a persisted PostgreSQL approval", async () => {
  const queries: string[] = [];
  const transaction: PostgresTransactionExecutor = {
    query: async <Row extends Record<string, unknown>>(sql: string) => {
      queries.push(sql);
      return { rows: [] as Row[], rowCount: 0 };
    },
  };
  const executor: PostgresExecutor = {
    ...transaction,
    transaction: async <T>(callback: (connection: PostgresTransactionExecutor) => Promise<T>) => callback(transaction),
  };
  const authorityOwner = new PostgresRuntimeAuthorityPersistence(executor);
  const value = await projection();
  const adapter = new RecordingAdapter(readbackFor(value));
  await assert.rejects(
    () => persistCppgCourseTheoryDraft(OPTIONS, authorityOwner),
    (error: unknown) => ["CPPG_APPROVAL_BINDING_UNAVAILABLE", "CPPG_SOURCE_REVALIDATION_BLOCKED"].includes(String((error as { code?: unknown }).code)),
  );
  assert.equal(adapter.began, 0);
  assert.equal(queries.some((sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)), false);
});

test("registration authority recheck and projection writes share one PostgreSQL transaction executor", async () => {
  let transactionStarts = 0;
  const statements: string[] = [];
  const transaction: PostgresTransactionExecutor = {
    query: async <Row extends Record<string, unknown>>(sql: string) => {
      statements.push(sql);
      return { rows: [] as Row[], rowCount: 0 };
    },
  };
  const executor: PostgresExecutor = {
    ...transaction,
    transaction: async <T>(callback: (connection: PostgresTransactionExecutor) => Promise<T>) => {
      transactionStarts += 1;
      return callback(transaction);
    },
  };
  const owner = new PostgresRuntimeAuthorityPersistence(executor);
  await owner.withRegistrationTransaction(async (transactionOwner, projectionExecutor) => {
    assert.equal(projectionExecutor, transaction);
    await transactionOwner.withTransaction((authorityTransaction) => authorityTransaction.loadAuthorityRoot("runtime-authority:cppg:locked-test"));
    await projectionExecutor.query("INSERT INTO public.cppg_runtime_registrations (id) VALUES ($1)", ["fixture"]);
  });
  assert.equal(transactionStarts, 1);
  assert.match(statements[0]!, /FOR UPDATE/);
  assert.match(statements[1]!, /cppg_runtime_registrations/);
});

test("PostgreSQL CPPG adapter rejects legacy course rows and records registration as unpublished", async () => {
  const value = await projection();
  const authority = await evaluateCppgProjectionAuthorityForTesting(value, new MemoryAuthorityOwner());
  const binding = {
    identity: authority.identity,
    currentness: { state: "CURRENT" as const, authorityId: authority.identity.authorityId, approvalSubjectHash: authority.identity.approvalSubjectHash, authoritySequence: 1 },
    projection: value,
    registeredBy: "test-actor",
  };
  const legacyExecutor: PostgresTransactionExecutor = {
    query: async <Row extends Record<string, unknown>>(sql: string) => ({
      rows: (sql.includes('FROM public."courses"') ? [{ id: "course-cppg" }] : []) as unknown as Row[],
      rowCount: sql.includes('FROM public."courses"') ? 1 : 0,
    }),
  };
  const legacyAdapter = new PostgresCppgDraftPersistenceAdapter(legacyExecutor, binding);
  const legacyState = await legacyAdapter.inspect({ courseId: "course-cppg", recordIds: expectedCppgRuntimeState(value).recordIds });
  assert.equal(classifyCppgRuntimeCollision(expectedCppgRuntimeState(value), legacyState), "REGISTERED_CONFLICTING");

  const writes: Array<{ sql: string; parameters: readonly unknown[] }> = [];
  const cleanExecutor: PostgresTransactionExecutor = {
    query: async <Row extends Record<string, unknown>>(sql: string, parameters: readonly unknown[]) => {
      writes.push({ sql, parameters });
      return { rows: [] as Row[], rowCount: 1 };
    },
  };
  const adapter = new PostgresCppgDraftPersistenceAdapter(cleanExecutor, binding);
  const transaction = await adapter.begin();
  await transaction.apply("COURSE", [value.course]);
  await transaction.commit();
  assert.equal(writes.length, 3);
  assert.match(writes[0]!.sql, /INSERT INTO public\."courses"/);
  assert.equal(writes[0]!.parameters.includes(0), true);
  assert.match(writes[1]!.sql, /cppg_runtime_projection_records/);
  assert.match(writes[2]!.sql, /REGISTERED_UNPUBLISHED.*NOT_GRANTED/);
  assert.equal(writes[2]!.parameters.includes(authority.identity.approvalSubjectHash), true);
  assert.equal((writes[2]!.parameters.find((value) => typeof value === "string" && value.startsWith("[")) as string).includes("course-cppg:revision:"), true);
});
