import { AppError } from "../lib/errors.ts";
import {
  assertTheoryRevisionCandidate,
  computeTheoryRevisionSemanticHash,
  stableJson,
  THEORY_REVISION_CONTENT_TYPE,
  THEORY_REVISION_STATUS,
  type GovernedTheoryRevisionCandidate,
} from "../lib/services/content-revision-service.ts";
import type { DatabaseProvider, DatabaseValue } from "./provider/database-provider.ts";
import type { Cs1aPolicyRequest } from "@/lib/policy/cs1a-contract";
import { assertCs1aMutationAllowed } from "@/lib/policy/cs1a-mutation-gate";

export type GovernedTheoryRevisionOutcome =
  | "NEW_SUCCESS"
  | "EXACT_REPLAY"
  | "CONFLICT"
  | "NEW_REVISION_REQUIRED";

export type GovernedTheoryRevisionResult = Readonly<{
  outcome: GovernedTheoryRevisionOutcome;
  canonicalKey: string;
  revisionId: string;
  semanticHash: string;
  lifecycle: "CANONICAL_UNPUBLISHED";
}>;

export async function saveGovernedTheoryRevision(
  candidate: GovernedTheoryRevisionCandidate,
  actorUserId: string,
  database: DatabaseProvider,
  policy?: Cs1aPolicyRequest,
): Promise<GovernedTheoryRevisionResult> {
  assertCs1aMutationAllowed(policy, "DRAFT_MUTATION");
  assertTheoryRevisionCandidate(candidate, actorUserId);
  const semanticHash = await computeTheoryRevisionSemanticHash({
    canonicalKey: candidate.canonicalKey,
    version: candidate.version,
    title: candidate.title,
    body: candidate.body,
    bodyFormat: candidate.bodyFormat,
    learningObjectives: candidate.learningObjectives,
    examples: candidate.examples,
    selfChecks: candidate.selfChecks,
    conceptMappings: candidate.conceptMappings,
    governance: candidate.governance,
  });
  const content = await database.queryOne<ContentRow>({
    sql: "SELECT id, canonical_key FROM contents WHERE id = ? AND canonical_key = ? LIMIT 1",
    parameters: [candidate.contentId, candidate.canonicalKey],
  });
  if (!content) throw new AppError("Theory content identity was not found.", 404, "THEORY_CONTENT_NOT_FOUND");
  const existing = await database.queryOne<RevisionRow>({
    sql: "SELECT id, semantic_hash, snapshot_json, human_review_hash FROM content_revisions WHERE content_type = ? AND content_id = ? AND version = ? LIMIT 1",
    parameters: [THEORY_REVISION_CONTENT_TYPE, content.id, candidate.version],
  });
  const snapshot = stableJson(toSnapshot(candidate));
  if (existing) {
    if (existing.semantic_hash === semanticHash && await isComplete(database, existing.id, candidate, snapshot, semanticHash)) {
      return { outcome: "EXACT_REPLAY", canonicalKey: candidate.canonicalKey, revisionId: existing.id, semanticHash, lifecycle: "CANONICAL_UNPUBLISHED" };
    }
    throw new AppError("Theory semantic identity conflicts with an existing revision.", 409, "THEORY_REVISION_CONFLICT");
  }
  const prior = await database.queryOne<{ id: string }>({
    sql: "SELECT id FROM content_revisions WHERE content_type = ? AND content_id = ? LIMIT 1",
    parameters: [THEORY_REVISION_CONTENT_TYPE, content.id],
  });
  if (prior) throw new AppError("A new immutable Theory revision is required.", 409, "THEORY_NEW_REVISION_REQUIRED");
  await assertParents(database, candidate, actorUserId);
  const revisionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [
    statement("INSERT INTO content_revisions (id, content_type, content_id, course_id, title, content_date, version, revision_status, snapshot_json, reviewed_at, reviewed_by, published_at, superseded_at, change_summary, previous_version_id, is_latest, created_by, created_at, updated_at, semantic_hash, human_review_hash) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, 0, ?, ?, ?, ?, ?)", [revisionId, THEORY_REVISION_CONTENT_TYPE, content.id, candidate.title, now.slice(0, 10), candidate.version, THEORY_REVISION_STATUS, snapshot, candidate.governance.humanReviewedAt, candidate.governance.humanReviewedBy, `Theory canonical-unpublished ${candidate.canonicalKey}`, actorUserId, now, now, semanticHash, candidate.governance.humanReviewHash]),
    ...candidate.conceptMappings.map((mapping) => conceptStatement(revisionId, mapping, actorUserId, now)),
  ];
  try {
    await database.transaction(statements);
  } catch (error) {
    const winner = await database.queryOne<RevisionRow>({
      sql: "SELECT id, semantic_hash, snapshot_json, human_review_hash FROM content_revisions WHERE content_type = ? AND content_id = ? AND version = ? LIMIT 1",
      parameters: [THEORY_REVISION_CONTENT_TYPE, content.id, candidate.version],
    });
    if (winner?.semantic_hash === semanticHash && await isComplete(database, winner.id, candidate, snapshot, semanticHash)) {
      return { outcome: "EXACT_REPLAY", canonicalKey: candidate.canonicalKey, revisionId: winner.id, semanticHash, lifecycle: "CANONICAL_UNPUBLISHED" };
    }
    throw error;
  }
  return { outcome: "NEW_SUCCESS", canonicalKey: candidate.canonicalKey, revisionId, semanticHash, lifecycle: "CANONICAL_UNPUBLISHED" };
}

async function assertParents(database: DatabaseProvider, candidate: GovernedTheoryRevisionCandidate, actorUserId: string) {
  const actor = await database.queryOne<{ id: string }>({ sql: "SELECT id FROM users WHERE id = ? LIMIT 1", parameters: [actorUserId] });
  if (!actor) throw new AppError("Theory governance actor was not found.", 404, "ACTOR_NOT_FOUND");
  const physicalConceptIds = candidate.conceptMappings.flatMap((mapping) => mapping.conceptId ? [mapping.conceptId] : []);
  if (!physicalConceptIds.length) return;
  const concepts = await database.query<{ id: string }>({ sql: `SELECT id FROM ontology_concepts WHERE id IN (${physicalConceptIds.map(() => "?").join(",")})`, parameters: physicalConceptIds });
  if (concepts.rows.length !== new Set(physicalConceptIds).size) throw new AppError("Theory Concept mapping was not found.", 404, "CONCEPT_NOT_FOUND");
}

async function isComplete(database: DatabaseProvider, revisionId: string, candidate: GovernedTheoryRevisionCandidate, snapshot: string, semanticHash: string) {
  const rows = await database.query<ConceptRow>({ sql: "SELECT concept_id, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at FROM content_revision_concepts WHERE revision_id = ? ORDER BY concept_id, mapping_version", parameters: [revisionId] });
  const expected = [...candidate.conceptMappings].sort(mappingSort).map((mapping) => ({ concept_id: mapping.conceptId ?? null, qualification_json: mapping.qualificationJson, provenance_json: mapping.provenanceJson, mapping_status: mapping.mappingStatus ?? "SUGGESTED", mapping_version: mapping.mappingVersion ?? 1, reviewed_by: mapping.reviewedBy ?? null, reviewed_at: mapping.reviewedAt ?? null }));
  const actual = rows.rows.map((row) => ({ concept_id: row.concept_id, qualification_json: row.qualification_json, provenance_json: row.provenance_json, mapping_status: row.mapping_status, mapping_version: Number(row.mapping_version), reviewed_by: row.reviewed_by, reviewed_at: row.reviewed_at }));
  const revision = await database.queryOne<{ snapshot_json: string; semantic_hash: string | null; human_review_hash: string | null }>({ sql: "SELECT snapshot_json, semantic_hash, human_review_hash FROM content_revisions WHERE id = ?", parameters: [revisionId] });
  return revision?.snapshot_json === snapshot && revision.semantic_hash === semanticHash && revision.human_review_hash === candidate.governance.humanReviewHash && stableJson(actual) === stableJson(expected);
}

function toSnapshot(candidate: GovernedTheoryRevisionCandidate) {
  return { title: candidate.title, body: candidate.body, bodyFormat: candidate.bodyFormat, learningObjectives: candidate.learningObjectives, examples: candidate.examples, selfChecks: candidate.selfChecks, governance: candidate.governance };
}

function conceptStatement(revisionId: string, mapping: GovernedTheoryRevisionCandidate["conceptMappings"][number], actorUserId: string, now: string) {
  return statement("INSERT INTO content_revision_concepts (id, revision_id, concept_id, created_by, created_at, relation_type, qualification_json, provenance_json, mapping_status, mapping_version, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, 'MAPS_TO', ?, ?, ?, ?, ?, ?)", [crypto.randomUUID(), revisionId, mapping.conceptId ?? null, actorUserId, now, mapping.qualificationJson, mapping.provenanceJson, mapping.mappingStatus ?? "SUGGESTED", mapping.mappingVersion ?? 1, mapping.reviewedBy ?? null, mapping.reviewedAt ?? null]);
}

function mappingSort(left: { conceptId?: string | null; mappingVersion?: number }, right: { conceptId?: string | null; mappingVersion?: number }) {
  return (left.conceptId ?? "").localeCompare(right.conceptId ?? "") || (left.mappingVersion ?? 1) - (right.mappingVersion ?? 1);
}
function statement(sql: string, parameters: DatabaseValue[]) { return { sql, parameters }; }
type ContentRow = { id: string; canonical_key: string };
type RevisionRow = { id: string; semantic_hash: string | null; snapshot_json: string; human_review_hash: string | null };
type ConceptRow = { concept_id: string | null; qualification_json: string; provenance_json: string; mapping_status: string; mapping_version: number | string; reviewed_by: string | null; reviewed_at: string | null };
