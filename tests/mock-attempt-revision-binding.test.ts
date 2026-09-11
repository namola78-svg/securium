import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseEvidenceSourceResolver } from "../db/evidence-source-adapters.ts";
import type { DatabaseProvider, DatabaseStatement } from "../db/provider/database-provider.ts";
import { gradeQuestion } from "../lib/services/grading-service.ts";
import {
  computeConceptMappingSetHash,
} from "../lib/services/learning-event-contracts.ts";
import { resolveMockQuestionVersionSnapshot } from "../lib/services/mock-exam-revision.ts";

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
    bindings: [{ question_id: "question-1", question_version_id: "version-1", concept_mapping_set_hash: mappingHash }],
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
    bindings: [{ question_id: "question-1", question_version_id: "version-1", concept_mapping_set_hash: originalHash }],
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

type MappingRow = Record<string, unknown>;
function mockProvider(input: {
  bindings?: MappingRow[];
  mappings?: MappingRow[];
  item?: MappingRow;
}): DatabaseProvider {
  const parent = {
    id: "attempt-1",
    user_id: "user-1",
    composition_semantic_hash: "c".repeat(64),
    score: 80,
    correct_count: 1,
    wrong_count: 0,
    unanswered_count: 0,
    submitted_at: "2026-09-11T00:00:00Z",
  };
  const resolve = (statement: DatabaseStatement): MappingRow[] => {
    if (statement.sql.includes("FROM mock_exam_attempts")) return [parent];
    if (statement.sql.includes("FROM learning_event_revisions")) return [];
    if (statement.sql.includes("SELECT a.id, m.user_id")) return input.item ? [input.item] : [];
    if (statement.sql.includes("FROM mock_exam_answers WHERE")) return input.bindings ?? [];
    if (statement.sql.includes("FROM mock_exam_answers a")) return input.mappings ?? [];
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
