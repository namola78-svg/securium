import { AppError } from "../lib/errors.ts";
import {
  assertGovernanceInput,
  assertQuestionConceptInput,
  computeQuestionSemanticHash,
  stableJson,
  type GovernedQuestionCandidate,
  type QuestionConceptInput,
} from "../lib/services/question-governance.ts";
import type { DatabaseProvider, DatabaseValue } from "./provider/database-provider.ts";
import type { Cs1aPolicyRequest } from "@/lib/policy/cs1a-contract";
import { assertCs1aMutationAllowed } from "@/lib/policy/cs1a-mutation-gate";

export type GovernedQuestionWriteOutcome =
  | "NEW_SUCCESS"
  | "EXACT_REPLAY"
  | "CONFLICT"
  | "NEW_VERSION_REQUIRED";

export type GovernedQuestionWriteResult = Readonly<{
  outcome: GovernedQuestionWriteOutcome;
  questionId: string;
  version: number;
  semanticHash: string;
}>;

export async function saveGovernedQuestionCandidate(
  candidate: GovernedQuestionCandidate,
  actorUserId: string,
  database: DatabaseProvider,
  policy?: Cs1aPolicyRequest,
): Promise<GovernedQuestionWriteResult> {
  assertCs1aMutationAllowed(policy, "DRAFT_MUTATION");
  assertCandidate(candidate, actorUserId);
  const semanticHash = await computeQuestionSemanticHash({
    id: candidate.id,
    version: candidate.version,
    title: candidate.title,
    content: candidate.content,
    type: candidate.type,
    difficulty: candidate.difficulty,
    explanation: candidate.explanation,
    wrongAnswerExplanation: candidate.wrongAnswerExplanation,
    answerConfigJson: parseJson(candidate.answerConfigJson),
    source: candidate.source ?? null,
    sourceDate: candidate.sourceDate ?? null,
    choices: candidate.choices,
    courseIds: [...candidate.courseIds].sort(),
    conceptMappings: candidate.conceptMappings,
    governance: candidate.governance,
  });
  const existing = await database.queryOne<QuestionRow>({
    sql: "SELECT id, version, semantic_hash FROM question_versions WHERE question_id = ? AND version = ? LIMIT 1",
    parameters: [candidate.id, candidate.version],
  });
  if (existing) {
    if (existing.semantic_hash === semanticHash && await isComplete(database, candidate, semanticHash)) {
      return { outcome: "EXACT_REPLAY", questionId: candidate.id, version: candidate.version, semanticHash };
    }
    throw new AppError("Question semantic identity conflicts with an existing version.", 409, "QUESTION_SEMANTIC_CONFLICT");
  }
  const identity = await database.queryOne<{ id: string }>({
    sql: "SELECT id FROM questions WHERE id = ? LIMIT 1",
    parameters: [candidate.id],
  });
  if (identity) throw new AppError("A new immutable version is required for this question identity.", 409, "QUESTION_NEW_VERSION_REQUIRED");
  await assertParents(database, candidate, actorUserId);
  const now = new Date().toISOString();
  const governanceJson = stableJson({
    ...parseJson(candidate.governance.governanceJson),
    reviewedSemanticHash: semanticHash,
    humanReviewHash: candidate.governance.humanReviewHash ?? null,
    humanReviewedBy: candidate.governance.humanReviewedBy ?? null,
    humanReviewedAt: candidate.governance.humanReviewedAt ?? null,
  });
  const statements = [
    statement(`INSERT INTO questions (id, title, content, type, difficulty, explanation, wrong_answer_explanation, status, source, source_date, version, answer_config_json, is_sample, created_by, reviewed_by, published_at, archived_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 0, ?, NULL, NULL, NULL, ?, ?)`, [candidate.id, candidate.title, candidate.content, candidate.type, candidate.difficulty, candidate.explanation, candidate.wrongAnswerExplanation, candidate.source ?? null, candidate.sourceDate ?? null, candidate.version, candidate.answerConfigJson, actorUserId, now, now]),
    statement(`INSERT INTO question_versions (id, question_id, version, snapshot_json, review_comment, semantic_hash, blueprint_id, qualification_json, provenance_json, governance_json, human_review_hash, human_reviewed_by, human_reviewed_at, created_by, created_at) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [crypto.randomUUID(), candidate.id, candidate.version, stableJson(candidate), semanticHash, candidate.governance.blueprintId, candidate.governance.qualificationJson, candidate.governance.provenanceJson, governanceJson, candidate.governance.humanReviewHash ?? null, candidate.governance.humanReviewedBy ?? null, candidate.governance.humanReviewedAt ?? null, actorUserId, now]),
    ...candidate.choices.map((choice) => statement(`INSERT INTO question_choices (id, question_id, content, display_order, is_correct, explanation) VALUES (?, ?, ?, ?, ?, ?)`, [choice.id ?? crypto.randomUUID(), candidate.id, choice.content, choice.displayOrder, choice.isCorrect ? 1 : 0, choice.explanation])),
    ...candidate.courseIds.map((courseId) => statement(`INSERT INTO question_courses (question_id, course_id, weight) VALUES (?, ?, 100)`, [candidate.id, courseId])),
    ...candidate.conceptMappings.map((mapping) => conceptStatement(candidate, mapping, actorUserId, now)),
    statement(`INSERT INTO admin_audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, result, metadata_json) VALUES (?, ?, 'ADMIN', 'QUESTION_CREATED', 'QUESTION', ?, 'SUCCESS', ?)`, [crypto.randomUUID(), actorUserId, candidate.id, stableJson({ version: candidate.version, semanticHash })]),
  ];
  try {
    await database.transaction(statements);
  } catch (error) {
    const winner = await database.queryOne<QuestionRow>({ sql: "SELECT semantic_hash FROM question_versions WHERE question_id = ? AND version = ? LIMIT 1", parameters: [candidate.id, candidate.version] });
    if (winner?.semantic_hash === semanticHash && await isComplete(database, candidate, semanticHash)) return { outcome: "EXACT_REPLAY", questionId: candidate.id, version: candidate.version, semanticHash };
    throw error;
  }
  return { outcome: "NEW_SUCCESS", questionId: candidate.id, version: candidate.version, semanticHash };
}

async function assertParents(database: DatabaseProvider, candidate: GovernedQuestionCandidate, actorUserId: string) {
  const actor = await database.queryOne<{ id: string }>({ sql: "SELECT id FROM users WHERE id = ? LIMIT 1", parameters: [actorUserId] });
  if (!actor) throw new AppError("Question actor was not found.", 404, "ACTOR_NOT_FOUND");
  const courseRows = await database.query<{ id: string }>({ sql: `SELECT id FROM courses WHERE id IN (${candidate.courseIds.map(() => "?").join(",")})`, parameters: candidate.courseIds });
  if (courseRows.rows.length !== new Set(candidate.courseIds).size) throw new AppError("Question course was not found.", 404, "COURSE_NOT_FOUND");
  const conceptIds = candidate.conceptMappings.map((mapping) => mapping.conceptId);
  const concepts = await database.query<{ id: string }>({ sql: `SELECT id FROM ontology_concepts WHERE id IN (${conceptIds.map(() => "?").join(",")})`, parameters: conceptIds });
  if (concepts.rows.length !== new Set(conceptIds).size) throw new AppError("Question Concept was not found.", 404, "CONCEPT_NOT_FOUND");
}

async function isComplete(database: DatabaseProvider, candidate: GovernedQuestionCandidate, semanticHash: string) {
  const [choices, courses, concepts, version] = await Promise.all([
    database.query<QuestionChoiceRow>({ sql: "SELECT content, display_order, is_correct, explanation FROM question_choices WHERE question_id = ? ORDER BY display_order ASC", parameters: [candidate.id] }),
    database.query<{ course_id: string }>({ sql: "SELECT course_id FROM question_courses WHERE question_id = ? ORDER BY course_id ASC", parameters: [candidate.id] }),
    database.query<QuestionConceptRow>({ sql: "SELECT qc.concept_id, qc.qualification_json, qc.provenance_json, qc.mapping_status, qc.reviewed_by, qc.reviewed_at FROM question_concepts qc INNER JOIN question_versions qv ON qv.id = qc.question_version_id WHERE qv.question_id = ? AND qv.version = ? ORDER BY qc.concept_id ASC", parameters: [candidate.id, candidate.version] }),
    database.queryOne<{ semantic_hash: string }>({ sql: "SELECT semantic_hash FROM question_versions WHERE question_id = ? AND version = ?", parameters: [candidate.id, candidate.version] }),
  ]);
  const expectedChoices = [...candidate.choices].sort((left, right) => left.displayOrder - right.displayOrder).map((choice) => ({ content: choice.content, display_order: choice.displayOrder, is_correct: choice.isCorrect ? 1 : 0, explanation: choice.explanation }));
  const actualChoices = choices.rows.map((choice) => ({ content: choice.content, display_order: Number(choice.display_order), is_correct: Number(choice.is_correct), explanation: choice.explanation }));
  const expectedConcepts = [...candidate.conceptMappings].sort((left, right) => left.conceptId.localeCompare(right.conceptId)).map((mapping) => ({ concept_id: mapping.conceptId, qualification_json: mapping.qualificationJson ?? null, provenance_json: mapping.provenanceJson ?? null, mapping_status: mapping.mappingStatus ?? "SUGGESTED", reviewed_by: mapping.reviewedBy ?? null, reviewed_at: mapping.reviewedAt ?? null }));
  const actualConcepts = concepts.rows.map((mapping) => ({ concept_id: mapping.concept_id, qualification_json: mapping.qualification_json, provenance_json: mapping.provenance_json, mapping_status: mapping.mapping_status, reviewed_by: mapping.reviewed_by, reviewed_at: mapping.reviewed_at }));
  return stableJson(actualChoices) === stableJson(expectedChoices) && stableJson(courses.rows.map((row) => row.course_id)) === stableJson([...candidate.courseIds].sort()) && stableJson(actualConcepts) === stableJson(expectedConcepts) && version?.semantic_hash === semanticHash;
}

function conceptStatement(candidate: GovernedQuestionCandidate, mapping: QuestionConceptInput, actorUserId: string, now: string) {
  return statement(`INSERT INTO question_concepts (id, question_version_id, concept_id, created_by, created_at, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at) SELECT ?, qv.id, ?, ?, ?, 'MAPS_TO', ?, ?, ?, 1, ?, ? FROM question_versions qv WHERE qv.question_id = ? AND qv.version = ?`, [crypto.randomUUID(), mapping.conceptId, actorUserId, now, mapping.qualificationJson ?? null, mapping.provenanceJson ?? null, mapping.mappingStatus ?? "SUGGESTED", mapping.reviewedBy ?? null, mapping.reviewedAt ?? null, candidate.id, candidate.version]);
}

function assertCandidate(candidate: GovernedQuestionCandidate, actorUserId: string) {
  if (!candidate.id || candidate.version < 1 || !actorUserId) throw new AppError("Question candidate identity is invalid.", 400, "QUESTION_CANDIDATE_INVALID");
  if (!candidate.choices.length || new Set(candidate.choices.map((choice) => choice.displayOrder)).size !== candidate.choices.length) throw new AppError("Question choices are incomplete or duplicated.", 400, "QUESTION_CHOICES_INVALID");
  assertGovernanceInput(candidate.governance);
  candidate.conceptMappings.forEach(assertQuestionConceptInput);
}

function parseJson(value: string) { try { return JSON.parse(value); } catch { throw new AppError("Question answer configuration is invalid.", 400, "QUESTION_ANSWER_CONFIG_INVALID"); } }
function statement(sql: string, parameters: DatabaseValue[]) { return { sql, parameters }; }
type QuestionRow = { id: string; version?: number; semantic_hash: string | null };
type QuestionChoiceRow = { content: string; display_order: number | string; is_correct: number | boolean; explanation: string };
type QuestionConceptRow = { concept_id: string; qualification_json: string | null; provenance_json: string | null; mapping_status: string; reviewed_by: string | null; reviewed_at: string | null };
