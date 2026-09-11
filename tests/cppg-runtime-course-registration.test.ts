import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  CPPG_PERSISTENCE_ORDER,
  buildCppgCourseTheoryDraftProjection,
  buildCppgRuntimeId,
  classifyCppgRuntimeCollision,
  compareCppgProjectionReplay,
  expectedCppgRuntimeState,
  interpretCppgStaticSeed,
  persistCppgCourseTheoryDraft,
  type CppgDraftPersistenceAdapter,
  type CppgFoundationBundle,
  type CppgPersistenceStage,
  type CppgObservedRuntimeState,
  type CppgCourseTheoryDraftProjection,
  type ProjectionRecord,
} from "../lib/services/cppg-runtime-course-registration.ts";

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
  return buildCppgCourseTheoryDraftProjection(await foundationBundle(), options);
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
  const changed = await buildCppgCourseTheoryDraftProjection({ ...changedBundle, theory: { ...changedBundle.theory, units: [changedUnit, ...changedBundle.theory.units.slice(1)] } }, OPTIONS);
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
    await assert.rejects(() => persistCppgCourseTheoryDraft(value, adapter), label);
    assert.equal(adapter.began, 0, label);
    assert.deepEqual(adapter.stages, [], label);
  }
});

test("persists only the atomic Course/Theory Draft plan through an injected adapter", async () => {
  const value = await projection();
  const adapter = new RecordingAdapter(readbackFor(value));
  const result = await persistCppgCourseTheoryDraft(value, adapter);
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
    await assert.rejects(() => persistCppgCourseTheoryDraft(value, failure), /injected failure/);
    assert.equal(failure.committed, false);
    assert.equal(failure.rolledBack, true);
    assert.deepEqual(failure.stages, []);
    assert.equal(failure.applied.length, 0);
  }
});

test("failed transaction does not become a false exact replay", async () => {
  const value = await projection();
  const failure = new RecordingAdapter(readbackFor(value), "CONTENT_REVISIONS");
  await assert.rejects(() => persistCppgCourseTheoryDraft(value, failure));
  const retry = new RecordingAdapter(readbackFor(value));
  const result = await persistCppgCourseTheoryDraft(value, retry);
  assert.equal(result.outcome, "NEW_SUCCESS");
});

test("exact runtime state replays without beginning a transaction", async () => {
  const value = await projection();
  const expected = expectedCppgRuntimeState(value);
  const exactAdapter = new RecordingAdapter(readbackFor(value, { courseCount: 1, recordCount: expected.recordIds.length, recordIds: expected.recordIds, semanticHashes: expected.semanticHashes }));
  const result = await persistCppgCourseTheoryDraft(value, exactAdapter);
  assert.equal(result.outcome, "EXACT_REPLAY");
  assert.deepEqual(exactAdapter.stages, []);
});

test("does not overwrite v1 when the same revision identity has changed content", async () => {
  const original = await projection();
  const changedBundle = await foundationBundle();
  const firstUnit = changedBundle.theory.units[0];
  assert.ok(firstUnit);
  const changed = await buildCppgCourseTheoryDraftProjection({ ...changedBundle, theory: { ...changedBundle.theory, units: [{ ...firstUnit, purpose: firstUnit.purpose + " changed" }, ...changedBundle.theory.units.slice(1)] } }, OPTIONS);
  const expectedChanged = expectedCppgRuntimeState(changed);
  const existingV1 = new RecordingAdapter(readbackFor(original, { courseCount: 1, recordCount: expectedChanged.recordIds.length, recordIds: expectedChanged.recordIds, semanticHashes: expectedCppgRuntimeState(original).semanticHashes }));
  await assert.rejects(() => persistCppgCourseTheoryDraft(changed, existingV1), /REGISTERED_CONFLICTING/);
  assert.equal(existingV1.began, 0);
  assert.deepEqual(existingV1.stages, []);
});
