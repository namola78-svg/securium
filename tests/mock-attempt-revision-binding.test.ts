import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import type { DatabaseProvider, DatabaseStatement } from "../db/provider/database-provider.ts";
import { gradeQuestion } from "../lib/services/grading-service.ts";
import {
  computeMockCompositionSemanticHash,
  computeConceptMappingSetHash,
} from "../lib/services/learning-event-contracts.ts";
import { createMockExamCompositionSnapshot } from "../lib/services/mock-exam-composition.ts";
import {
  computeMockQuestionVersionSemanticHash,
  resolveMockQuestionVersionSnapshot,
} from "../lib/services/mock-exam-revision.ts";

const snapshot = JSON.stringify({
  id: "question-1",
  title: "Original title",
  content: "Original content",
  type: "SINGLE_CHOICE",
  difficulty: "EASY",
  explanation: "Original explanation",
  wrongAnswerExplanation: "Original wrong answer explanation",
  answerConfigJson: "{}",
  choices: [
    { id: "choice-1", content: "Original correct", displayOrder: 1, isCorrect: true, explanation: "" },
    { id: "choice-2", content: "Original incorrect", displayOrder: 2, isCorrect: false, explanation: "" },
  ],
});

const governedSnapshot = JSON.stringify({
  ...JSON.parse(snapshot),
  version: 1,
  source: null,
  sourceDate: null,
  courseIds: ["course-1"],
  conceptMappings: [{
    conceptId: "concept-id",
    qualificationJson: JSON.stringify({ track: "mock" }),
    provenanceJson: JSON.stringify({ source: "fixture" }),
    mappingStatus: "APPROVED",
    reviewedBy: "user-admin",
    reviewedAt: "2026-09-11T00:00:00.000Z",
  }],
  governance: {
    blueprintId: "mock-blueprint",
    qualificationJson: "{}",
    provenanceJson: "{}",
    governanceJson: "{}",
    humanReviewHash: "b".repeat(64),
    humanReviewedBy: "user-admin",
    humanReviewedAt: "2026-09-11T00:00:00.000Z",
  },
});
const governedSemanticHash = await computeMockQuestionVersionSemanticHash(
  governedSnapshot,
  "question-1",
);
const governedMapping = {
  conceptIdentity: "concept.original",
  mappingVersion: 1,
  qualification: { track: "mock" },
  provenance: { source: "fixture" },
  status: "APPROVED" as const,
};
const governedMappingHash = await computeConceptMappingSetHash([governedMapping]);
const compositionInput = {
  items: [{
    displayOrder: 1,
    questionIdentity: "question-1",
    questionVersionSemanticHash: governedSemanticHash,
    possibleScore: 10,
    conceptMappingSetHash: governedMappingHash,
  }],
  passingScore: 60,
  questionCount: 1,
  randomizeQuestions: false,
  randomizeChoices: false,
};
const compositionSemanticHash = await computeMockCompositionSemanticHash(compositionInput);
const compositionSnapshotJson = createMockExamCompositionSnapshot({
  ...compositionInput,
  items: compositionInput.items.map((item) => ({
    ...item,
    questionVersionId: "version-1",
  })),
});

test("mock grading restores the immutable question snapshot after current content changes", () => {
  const revision = resolveMockQuestionVersionSnapshot(snapshot, "question-1");
  const grade = gradeQuestion(
    { type: revision.type, choices: [...revision.choices], answerConfig: JSON.parse(revision.answerConfigJson) },
    "choice-1",
  );
  assert.equal(revision.title, "Original title");
  assert.equal(revision.choices[0]?.id, "choice-1");
  assert.equal(grade.isCorrect, true);
});

test("an incomplete QuestionVersion snapshot fails closed instead of using current choices", () => {
  const incomplete = JSON.stringify({
    ...JSON.parse(snapshot),
    choices: [{ content: "No immutable identity", displayOrder: 1, isCorrect: true }],
  });
  assert.throws(
    () => resolveMockQuestionVersionSnapshot(incomplete, "question-1"),
    (error: unknown) => error && typeof error === "object" && "code" in error && error.code === "MOCK_QUESTION_VERSION_UNAVAILABLE",
  );
});

test("verified mock revisions reject a wrong QuestionVersion identity and semantic drift", async () => {
  const { resolveMockQuestionVersionSnapshotVerified } = await import("../lib/services/mock-exam-revision.ts");
  await assert.rejects(
    () => resolveMockQuestionVersionSnapshotVerified(governedSnapshot, "question-2", governedSemanticHash, 1),
    (error: unknown) => error && typeof error === "object" && "code" in error && error.code === "MOCK_QUESTION_VERSION_UNAVAILABLE",
  );
  const changed = JSON.parse(governedSnapshot);
  changed.content = "mutable content must not become the revision";
  await assert.rejects(
    () => resolveMockQuestionVersionSnapshotVerified(JSON.stringify(changed), "question-1", governedSemanticHash, 1),
    (error: unknown) => error && typeof error === "object" && "code" in error && error.code === "QUESTION_VERSION_SEMANTIC_HASH_MISMATCH",
  );
});

test("mock Evidence verifies every stored item mapping hash before resolving current mappings", async () => {
  const mapping = {
    conceptIdentity: "concept.original",
    mappingVersion: 1,
    qualification: { track: "mock" },
    provenance: { source: "fixture" },
    status: "APPROVED" as const,
  };
  const mappingHash = await computeConceptMappingSetHash([mapping]);
  const provider = mockProvider({
    bindings: [{ question_id: "question-1", question_version_id: "version-1", concept_mapping_set_hash: mappingHash, version_question_id: "question-1", version_number: 1, version_hash: governedSemanticHash, version_snapshot_json: governedSnapshot }],
    mappings: [{ question_id: "question-1", question_version_id: "version-1", mapping_id: "mapping-1", concept_id: "concept-id", concept_key: mapping.conceptIdentity, mapping_version: 1, qualification_json: JSON.stringify(mapping.qualification), provenance_json: JSON.stringify(mapping.provenance) }],
  });
  const source = await new DatabaseEvidenceSourceResolver(provider).resolveEvent({
    sourceType: "MOCK_ATTEMPT",
    sourceEventId: "attempt-1",
    sourceRevisionIdentity: "initial",
  });
  assert.equal(source?.validity, "ELIGIBLE");
  assert.deepEqual(source?.conceptIds, ["concept-id"]);
});

test("mock Evidence rejects changed current mapping instead of reinterpreting the old attempt", async () => {
  const original = {
    conceptIdentity: "concept.original",
    mappingVersion: 1,
    qualification: { track: "mock" },
    provenance: { source: "fixture" },
    status: "APPROVED" as const,
  };
  const changed = { ...original, conceptIdentity: "concept.changed", mappingVersion: 2 };
  const originalHash = await computeConceptMappingSetHash([original]);
  const provider = mockProvider({
    bindings: [{ question_id: "question-1", question_version_id: "version-1", concept_mapping_set_hash: originalHash, version_question_id: "question-1", version_number: 1, version_hash: governedSemanticHash, version_snapshot_json: governedSnapshot }],
    mappings: [{ question_id: "question-1", question_version_id: "version-1", mapping_id: "mapping-2", concept_id: "concept-id-2", concept_key: changed.conceptIdentity, mapping_version: changed.mappingVersion, qualification_json: JSON.stringify(changed.qualification), provenance_json: JSON.stringify(changed.provenance) }],
  });
  await assert.rejects(
    () => new DatabaseEvidenceSourceResolver(provider).resolveEvent({ sourceType: "MOCK_ATTEMPT", sourceEventId: "attempt-1", sourceRevisionIdentity: "initial" }),
    (error: unknown) => error && typeof error === "object" && "code" in error && error.code === "EVIDENCE_MAPPING_SET_MISMATCH",
  );
});

test("a pre-submit mock item is not resolved as a performance result", async () => {
  const provider = mockProvider({
    item: {
      id: "answer-1",
      user_id: "user-1",
      question_version_id: "version-1",
      concept_mapping_set_hash: "a".repeat(64),
      is_correct: null,
      score: null,
      occurred_at: null,
      attempt_status: "IN_PROGRESS",
      attempt_submitted_at: null,
      version_hash: "b".repeat(64),
    },
  });
  const source = await new DatabaseEvidenceSourceResolver(provider).resolveEvent({
    sourceType: "MOCK_ITEM_RESULT",
    sourceEventId: "answer-1",
    sourceRevisionIdentity: "initial",
  });
  assert.equal(source, null);
});

test("a stored mock composition is required; legacy rows do not fall back to mutable content", async () => {
  const provider = mockProvider({
    parent: { composition_snapshot_json: null },
  });
  await assert.rejects(
    () => new DatabaseEvidenceSourceResolver(provider).resolveEvent({
      sourceType: "MOCK_ATTEMPT",
      sourceEventId: "attempt-1",
      sourceRevisionIdentity: "initial",
    }),
    (error: unknown) => error && typeof error === "object" && "code" in error && error.code === "MOCK_COMPOSITION_UNAVAILABLE",
  );
});

test("composition hash rejects item, order, score, revision, mapping, and setting mutations", async () => {
  type MutableComposition = {
    items: Array<Record<string, unknown>>;
    randomizeQuestions: boolean;
    randomizeChoices: boolean;
  };
  const mutations = [
    (value: MutableComposition) => { value.items[0].questionIdentity = "question-2"; },
    (value: MutableComposition) => { value.items.push({ ...value.items[0], questionIdentity: "question-2", questionVersionId: "version-2" }); },
    (value: MutableComposition) => { value.items.pop(); },
    (value: MutableComposition) => { value.items[0].displayOrder = 2; },
    (value: MutableComposition) => { value.items[0].possibleScore = 20; },
    (value: MutableComposition) => { value.items[0].questionVersionSemanticHash = "d".repeat(64); },
    (value: MutableComposition) => { value.items[0].conceptMappingSetHash = "e".repeat(64); },
    (value: MutableComposition) => { value.randomizeQuestions = true; },
    (value: MutableComposition) => { value.randomizeChoices = true; },
  ];
  for (const mutate of mutations) {
    const value = JSON.parse(compositionSnapshotJson) as MutableComposition;
    mutate(value);
    await assert.rejects(
      () => new DatabaseEvidenceSourceResolver(mockProvider({
        parent: {
          composition_semantic_hash: compositionSemanticHash,
          composition_snapshot_json: JSON.stringify(value),
        },
        bindings: [{ question_id: "question-1", question_version_id: "version-1", concept_mapping_set_hash: governedMappingHash, version_question_id: "question-1", version_number: 1, version_hash: governedSemanticHash, version_snapshot_json: governedSnapshot }],
      })).resolveEvent({
        sourceType: "MOCK_ATTEMPT",
        sourceEventId: "attempt-1",
        sourceRevisionIdentity: "initial",
      }),
      (error: unknown) => error && typeof error === "object" && "code" in error && ["MOCK_COMPOSITION_MISMATCH", "MOCK_COMPOSITION_UNAVAILABLE"].includes(String(error.code)),
    );
  }
});

type MappingRow = Record<string, unknown>;
function mockProvider(input: {
  parent?: MappingRow;
  bindings?: MappingRow[];
  mappings?: MappingRow[];
  item?: MappingRow;
}): DatabaseProvider {
  const parent = {
    id: "attempt-1",
    user_id: "user-1",
    composition_semantic_hash: compositionSemanticHash,
    composition_snapshot_json: compositionSnapshotJson,
    score: 80,
    correct_count: 1,
    wrong_count: 0,
    unanswered_count: 0,
    submitted_at: "2026-09-11T00:00:00Z",
    ...input.parent,
  };
  const resolve = (statement: DatabaseStatement): MappingRow[] => {
    if (statement.sql.includes("FROM mock_exam_attempts")) return [parent];
    if (statement.sql.includes("FROM learning_event_revisions")) return [];
    if (statement.sql.includes("SELECT a.id, a.question_id")) return input.item ? [input.item] : [];
    if (statement.sql.includes("SELECT a.question_id, a.question_version_id")) return input.bindings ?? [];
    if (statement.sql.includes("SELECT DISTINCT a.question_id")) return input.mappings ?? [];
    if (statement.sql.includes("FROM mock_exam_answers")) return input.item ? [input.item] : [];
    return [];
  };
  return {
    kind: "d1",
    async query(statement) {
      const rows = resolve(statement);
      return { rows, rowCount: rows.length, metadata: { provider: "d1" } } as never;
    },
    async queryOne(statement) {
      return resolve(statement)[0] ?? null;
    },
    async execute() { throw new Error("read-only fake"); },
    async transaction() { throw new Error("read-only fake"); },
    async healthCheck() { return true; },
  } as DatabaseProvider;
}
