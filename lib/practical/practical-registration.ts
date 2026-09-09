import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import { PracticalGovernanceRepository } from "../../db/practical-governance-repositories.ts";
import {
  hashPracticalGovernanceSemantics,
  stableGovernanceJson,
  validatePracticalGovernanceInput,
  type PracticalConceptBindingInput,
  type PracticalGovernanceInput,
} from "./practical-governance-validation.ts";
import {
  buildPracticalId,
  isPracticalId,
} from "./practical-definition.ts";
import {
  requireStableReference,
  requireStableSemanticSegment,
} from "../assessment/assessment-objective.ts";

const HASH = /^[a-f0-9]{64}$/;
type CanonicalConceptStatus = "ACTIVE" | "DRAFT";

export type PracticalRegistrationMemberType =
  | "EXECUTABLE_LAB"
  | "PRACTICAL";

export type CanonicalConceptReference = Readonly<{
  conceptId?: string;
  conceptKey?: string;
  registeredAlias?: string;
}>;

export type PracticalConceptCandidate = Readonly<{
  reference: CanonicalConceptReference;
  mappingSource: string;
  qualification?: unknown;
  mappingStatus?: PracticalConceptBindingInput["mappingStatus"];
}>;

export type PracticalRegistrationGovernanceInput = Omit<
  PracticalGovernanceInput,
  | "practicalId"
  | "semanticKey"
  | "practicalVersionId"
  | "conceptMappingHash"
  | "conceptBindings"
>;

export type PracticalRegistrationInput = Readonly<{
  courseId: string;
  memberIdentity: string;
  memberType: PracticalRegistrationMemberType;
  namespace: string;
  intentKey: string;
  semanticKey: string;
  governance: PracticalRegistrationGovernanceInput;
  conceptCandidates: readonly PracticalConceptCandidate[];
}>;

export type CanonicalConceptResolution = Readonly<{
  id: string;
  conceptKey: string;
  status: CanonicalConceptStatus;
  matchedBy: "CANONICAL_ID" | "CANONICAL_KEY" | "REGISTERED_ALIAS";
}>;

export type PracticalRegistrationResult = Readonly<{
  outcome: "NEW_SUCCESS" | "EXACT_REPLAY" | "NEW_VERSION_REQUIRED";
  practicalId: string;
  practicalVersionId: string;
  conceptBindings: readonly PracticalConceptBindingInput[];
  resolvedConcepts: readonly CanonicalConceptResolution[];
}>;

type CanonicalConceptRow = Readonly<{
  id: unknown;
  concept_key: unknown;
  status: unknown;
}>;

function fail(code: string): never {
  throw new TypeError(code);
}

function normalizeLookup(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function requireHash(value: unknown, field: string): string {
  if (typeof value !== "string" || !HASH.test(value)) {
    fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

function requireCanonicalConceptRow(
  row: CanonicalConceptRow | null,
): CanonicalConceptResolution {
  if (!row) fail("CANONICAL_CONCEPT_NOT_FOUND");
  const id = requireStableReference(row.id, "canonical_concept_id");
  const conceptKey = requireStableReference(
    row.concept_key,
    "canonical_concept_key",
  );
  if (row.status !== "ACTIVE" && row.status !== "DRAFT") {
    fail("CANONICAL_CONCEPT_NOT_ACTIVE");
  }
  return Object.freeze({
    id,
    conceptKey,
    status: row.status,
    matchedBy: "CANONICAL_KEY",
  });
}

function requireOneCanonicalRow(
  rows: readonly CanonicalConceptRow[],
): CanonicalConceptRow {
  if (rows.length === 0) fail("CANONICAL_CONCEPT_NOT_FOUND");
  if (rows.length !== 1) fail("CANONICAL_CONCEPT_AMBIGUOUS");
  return rows[0];
}

function validateConceptReference(
  value: CanonicalConceptReference,
): CanonicalConceptReference {
  const conceptId = value.conceptId === undefined
    ? undefined
    : requireStableReference(value.conceptId, "canonical_concept_id");
  const conceptKey = value.conceptKey === undefined
    ? undefined
    : requireStableReference(value.conceptKey, "canonical_concept_key");
  const registeredAlias = value.registeredAlias === undefined
    ? undefined
    : requireStableReference(value.registeredAlias, "registered_alias");
  if (registeredAlias && (conceptId || conceptKey)) {
    fail("CANONICAL_CONCEPT_LOOKUP_STRATEGY_CONFLICT");
  }
  if (!conceptId && !conceptKey && !registeredAlias) {
    fail("CANONICAL_CONCEPT_REFERENCE_REQUIRED");
  }
  return Object.freeze({
    ...(conceptId ? { conceptId } : {}),
    ...(conceptKey ? { conceptKey } : {}),
    ...(registeredAlias ? { registeredAlias } : {}),
  });
}

/**
 * Resolve only against canonical ontology rows. This function is deliberately
 * read-only and has no label fallback or Concept creation path.
 */
export async function resolveCanonicalConcept(
  database: DatabaseProvider,
  input: CanonicalConceptReference,
): Promise<CanonicalConceptResolution> {
  const reference = validateConceptReference(input);
  if (reference.conceptId) {
    const rows = await database.query<CanonicalConceptRow>({
      sql: `SELECT id, concept_key, status FROM ontology_concepts
        WHERE id = ? AND status IN ('ACTIVE', 'DRAFT') LIMIT 2`,
      parameters: [reference.conceptId],
    });
    const row = requireOneCanonicalRow(rows.rows);
    if (reference.conceptKey && row.concept_key !== reference.conceptKey) {
      fail("CANONICAL_CONCEPT_KEY_MISMATCH");
    }
    const resolved = requireCanonicalConceptRow(row);
    return Object.freeze({ ...resolved, matchedBy: "CANONICAL_ID" });
  }
  if (reference.conceptKey) {
    const rows = await database.query<CanonicalConceptRow>({
      sql: `SELECT id, concept_key, status FROM ontology_concepts
        WHERE concept_key = ? AND status IN ('ACTIVE', 'DRAFT') LIMIT 2`,
      parameters: [reference.conceptKey],
    });
    const resolved = requireCanonicalConceptRow(requireOneCanonicalRow(rows.rows));
    return Object.freeze({ ...resolved, matchedBy: "CANONICAL_KEY" });
  }
  const rows = await database.query<CanonicalConceptRow>({
    sql: `SELECT c.id, c.concept_key, c.status FROM ontology_aliases a
      JOIN ontology_concepts c ON c.id = a.concept_id
      WHERE a.normalized_alias = ? AND c.status IN ('ACTIVE', 'DRAFT')
      ORDER BY c.id LIMIT 2`,
    parameters: [normalizeLookup(reference.registeredAlias as string)],
  });
  const resolved = requireCanonicalConceptRow(requireOneCanonicalRow(rows.rows));
  return Object.freeze({ ...resolved, matchedBy: "REGISTERED_ALIAS" });
}

function validateRegistrationInput(input: PracticalRegistrationInput): void {
  requireStableReference(input.courseId, "course_id");
  requireStableReference(input.memberIdentity, "member_identity");
  if (input.memberType !== "EXECUTABLE_LAB" && input.memberType !== "PRACTICAL") {
    fail("INVALID_PRACTICAL_MEMBER_TYPE");
  }
  requireStableSemanticSegment(input.namespace, "practical_namespace");
  requireStableSemanticSegment(input.intentKey, "practical_intent_key");
  requireStableSemanticSegment(input.semanticKey, "semantic_key");
  const practicalId = buildPracticalId(input.namespace, input.intentKey);
  if (!isPracticalId(practicalId)) fail("INVALID_PRACTICAL_ID");
  if (!Array.isArray(input.conceptCandidates) || input.conceptCandidates.length === 0) {
    fail("CONCEPT_MAPPING_REQUIRED");
  }
  requireHash(input.governance.semanticHash, "semantic_hash");
  requireHash(input.governance.humanReviewHash, "human_review_hash");
  requireHash(input.governance.safetyReviewHash, "safety_review_hash");
  requireHash(input.governance.evaluationSemanticHash, "evaluation_semantic_hash");
}

function buildQualificationJson(
  input: PracticalRegistrationInput,
  candidate: PracticalConceptCandidate,
  resolution: CanonicalConceptResolution,
  practicalVersionId: string,
): string {
  return stableGovernanceJson({
    courseId: input.courseId,
    memberIdentity: input.memberIdentity,
    memberType: input.memberType,
    practicalVersionId,
    canonicalConceptId: resolution.id,
    canonicalConceptKey: resolution.conceptKey,
    matchedBy: resolution.matchedBy,
    mappingSource: requireStableReference(candidate.mappingSource, "mapping_source"),
    semanticContext: candidate.qualification ?? null,
  });
}

function buildBinding(
  input: PracticalRegistrationInput,
  candidate: PracticalConceptCandidate,
  resolution: CanonicalConceptResolution,
  practicalVersionId: string,
): PracticalConceptBindingInput {
  const qualificationJson = buildQualificationJson(
    input,
    candidate,
    resolution,
    practicalVersionId,
  );
  const mappingSemanticHash = hashPracticalGovernanceSemantics({
    practicalVersionId,
    conceptId: resolution.id,
    conceptKey: resolution.conceptKey,
    qualificationJson,
    mappingStatus: candidate.mappingStatus ?? "PENDING",
  });
  return Object.freeze({
    id: `practical-concept-binding:${mappingSemanticHash}`,
    practicalVersionId,
    conceptKey: resolution.conceptKey,
    conceptId: resolution.id,
    mappingSemanticHash,
    qualificationJson,
    mappingStatus: candidate.mappingStatus ?? "PENDING",
  } as PracticalConceptBindingInput);
}

/**
 * Register one approved practical version through the existing shared
 * governance repository. Canonical concept resolution completes before the
 * repository is called, so unresolved or ambiguous references cause zero
 * practical/version/binding writes.
 */
export async function registerGovernedPracticalVersion(
  database: DatabaseProvider,
  input: PracticalRegistrationInput,
): Promise<PracticalRegistrationResult> {
  validateRegistrationInput(input);
  const practicalId = buildPracticalId(input.namespace, input.intentKey);
  const practicalVersionId =
    `practical-version:${practicalId}:v${input.governance.version}`;
  const resolutions = await Promise.all(
    input.conceptCandidates.map((candidate) =>
      resolveCanonicalConcept(database, candidate.reference)),
  );
  const bindings = input.conceptCandidates
    .map((candidate, index) =>
      buildBinding(input, candidate, resolutions[index], practicalVersionId),
    )
    .sort((left, right) => left.conceptKey.localeCompare(right.conceptKey));
  const uniqueKeys = new Set(bindings.map((binding) => binding.conceptKey));
  if (uniqueKeys.size !== bindings.length) fail("DUPLICATE_CONCEPT_MAPPING");
  const conceptMappingHash = hashPracticalGovernanceSemantics({
    practicalVersionId,
    bindings: bindings.map((binding) => ({
      conceptId: binding.conceptId,
      conceptKey: binding.conceptKey,
      mappingSemanticHash: binding.mappingSemanticHash,
    })),
  });
  const governanceInput: PracticalGovernanceInput = {
    ...input.governance,
    practicalId,
    semanticKey: input.semanticKey,
    practicalVersionId,
    conceptMappingHash,
    conceptBindings: bindings,
  };
  validatePracticalGovernanceInput(governanceInput);
  const result = await new PracticalGovernanceRepository(database).createGovernedPractical(
    governanceInput,
  );
  return Object.freeze({
    ...result,
    conceptBindings: Object.freeze(bindings),
    resolvedConcepts: Object.freeze(resolutions),
  });
}
