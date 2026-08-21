import { AppError } from "../lib/errors.ts";
import {
  canonicalizeFactJson,
  createFactProvenanceManifest,
  type FactIdentity,
  type TemporalAssertion,
} from "../lib/facts/fact-domain.ts";
import {
  digestFactProvenance,
  provenanceManifestFromBindings,
  type AssertionSourceBinding,
  type SourceIdentity,
} from "../lib/provenance/fact-source-binding.ts";
/*
 * Source bindings are the durable materialization of an assertion's immutable
 * provenance manifest. They are created only with the assertion transaction.
 */
import type {
  DatabaseProvider,
  DatabaseStatement,
  DatabaseValue,
} from "./provider/database-provider.ts";
import {
  conceptMappingProvenanceSchema,
  conceptMappingQualificationSchema,
} from "../lib/validation.ts";
import { assertConceptMappingQualificationPreserved } from "../lib/services/ontology-service.ts";

export type FactConceptBinding = Readonly<{
  id: string;
  factIdentityId: string;
  conceptId: string;
  createdBy: string;
  createdAt: string;
}>;

export type GovernedFactConceptBinding = FactConceptBinding & Readonly<{
  relationType: "MAPS_TO";
  qualificationJson: string | null;
  mappingBasis: "HUMAN_AUTHORED" | "RULE_BASED" | "AI_SUGGESTED" | "CANONICAL_PACKAGE" | "IMPORT" | null;
  provenanceJson: string | null;
  mappingStatus: "LEGACY_UNVERIFIED" | "SUGGESTED" | "APPROVED" | "REJECTED" | "SUPERSEDED";
  mappingVersion: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
}>;

export type ConceptPersistenceInput = Readonly<{
  concept: Readonly<{
    id: string;
    conceptKey: string;
    namespace?: string;
    label: string;
    normalizedLabel: string;
    category?: string;
    description?: string;
  }>;
  binding: Readonly<{
    id: string;
    factIdentityId: string;
    createdBy: string;
    createdAt: string;
    qualificationJson?: string | null;
    mappingBasis: "HUMAN_AUTHORED" | "RULE_BASED" | "AI_SUGGESTED" | "CANONICAL_PACKAGE" | "IMPORT";
    provenanceJson?: string | null;
    mappingStatus: "SUGGESTED" | "APPROVED";
    mappingVersion?: number;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
  }>;
}>;

export type ConceptPersistenceResult = Readonly<{
  outcome: "NEW_SUCCESS" | "EXACT_REPLAY" | "CONFLICT" | "REVIEW_REQUIRED" | "MAP_TO_EXISTING";
  conceptId: string;
  binding: GovernedFactConceptBinding | null;
}>;

export type FactTrackBinding = Readonly<{
  id: string;
  factIdentityId: string;
  trackKey: string;
  createdBy: string;
  createdAt: string;
}>;

type Row = Record<string, DatabaseValue>;

export type CanonicalCandidatePersistenceResult = Readonly<{
  outcome: "NEW_SUCCESS" | "EXACT_REPLAY";
  factIdentity: FactIdentity;
  temporalAssertion: TemporalAssertion;
  sourceBindings: readonly AssertionSourceBinding[];
}>;

export class FactRepository {
  private readonly database: DatabaseProvider;

  constructor(database: DatabaseProvider) {
    this.database = database;
  }

  async createCanonicalCandidate(
    factIdentity: FactIdentity,
    temporalAssertion: TemporalAssertion,
    sourceBindings: readonly AssertionSourceBinding[],
  ): Promise<CanonicalCandidatePersistenceResult> {
    if (temporalAssertion.factIdentityId !== factIdentity.id) {
      conflict("CANONICAL_CANDIDATE_FACT_ASSERTION_MISMATCH");
    }
    await assertBindingsMatchAssertion(temporalAssertion, sourceBindings);

    let results: Awaited<ReturnType<DatabaseProvider["transaction"]>>;
    try {
      results = await this.database.transaction([
        canonicalCandidateStateGuardStatement(factIdentity, temporalAssertion, sourceBindings),
        factIdentityInsertStatement(factIdentity),
        canonicalFactGuardStatement(factIdentity, temporalAssertion),
        temporalAssertionInsertStatement(temporalAssertion),
        canonicalAssertionGuardStatement(temporalAssertion),
        ...sourceBindings.map(sourceBindingInsertStatement),
        ...sourceBindings.map((binding) =>
          canonicalSourceBindingGuardStatement(temporalAssertion, binding)
        ),
        canonicalBindingCountGuardStatement(temporalAssertion, sourceBindings.length),
      ]);
    } catch (error) {
      const state = await inspectCanonicalCandidateState(
        this,
        factIdentity,
        temporalAssertion,
        sourceBindings,
      );
      if (state === "EXACT") {
        return canonicalCandidateResult(
          "EXACT_REPLAY",
          factIdentity,
          temporalAssertion,
          sourceBindings,
        );
      }
      if (state === "FACT_CONFLICT") conflict("FACT_IDENTITY_CONFLICT");
      if (state === "ASSERTION_CONFLICT") conflict("TEMPORAL_ASSERTION_CONFLICT");
      if (state === "PARTIAL") {
        conflict("CANONICAL_CANDIDATE_INCONSISTENT_PARTIAL_STATE");
      }
      if (isCanonicalGuardViolation(error) || isUniqueConstraintViolation(error)) {
        conflict("CANONICAL_CANDIDATE_CONFLICT");
      }
      throw error;
    }

    const state = await inspectCanonicalCandidateState(
      this,
      factIdentity,
      temporalAssertion,
      sourceBindings,
    );
    if (state !== "EXACT") conflict("CANONICAL_CANDIDATE_INCONSISTENT_PARTIAL_STATE");
    return canonicalCandidateResult(
      results[1]?.affectedRows === 1 ? "NEW_SUCCESS" : "EXACT_REPLAY",
      factIdentity,
      temporalAssertion,
      sourceBindings,
    );
  }

  async createFactIdentity(input: FactIdentity): Promise<FactIdentity> {
    await this.database.execute({
      sql: `INSERT INTO fact_identities
        (id, canonical_key, domain, canonical_label, normalized_semantic_identity,
         scope_discriminator, lifecycle_state, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING`,
      parameters: [
        input.id,
        input.canonicalKey,
        input.domain,
        input.canonicalLabel,
        input.normalizedSemanticIdentity,
        input.scopeDiscriminator,
        input.lifecycleState,
        input.createdBy,
        input.createdAt,
      ],
    });
    const row = await this.findFactByCanonicalKey(input.canonicalKey);
    if (!row || !sameFactIdentity(row, input)) conflict("FACT_IDENTITY_CONFLICT");
    return row;
  }

  async getFactIdentity(id: string): Promise<FactIdentity | null> {
    const row = await this.database.queryOne<Row>({
      sql: "SELECT * FROM fact_identities WHERE id = ? LIMIT 1",
      parameters: [id],
    });
    return row ? mapFactIdentity(row) : null;
  }

  async findFactByCanonicalKey(canonicalKey: string): Promise<FactIdentity | null> {
    const row = await this.database.queryOne<Row>({
      sql: "SELECT * FROM fact_identities WHERE canonical_key = ? LIMIT 1",
      parameters: [canonicalKey],
    });
    return row ? mapFactIdentity(row) : null;
  }

  async createTemporalAssertion(
    input: TemporalAssertion,
    sourceBindings: readonly AssertionSourceBinding[],
  ): Promise<TemporalAssertion> {
    await assertBindingsMatchAssertion(input, sourceBindings);
    const existing = await this.getTemporalAssertion(input.id);
    if (existing) {
      if (!sameTemporalAssertion(existing, input)) conflict("TEMPORAL_ASSERTION_CONFLICT");
      await assertPersistedBindingsMatch(this, input, sourceBindings);
      return existing;
    }
    try {
      await this.database.transaction([
        temporalAssertionInsertStatement(input),
        canonicalAssertionGuardStatement(input),
        ...sourceBindings.map(sourceBindingInsertStatement),
        ...sourceBindings.map((binding) => canonicalSourceBindingGuardStatement(input, binding)),
        canonicalBindingCountGuardStatement(input, sourceBindings.length),
      ]);
    } catch (error) {
      // Provider transaction promises reject only after their atomic batch or
      // transaction has rolled back. Durable reads here normalize the engine
      // error; they are not used to decide whether a commit was canonical.
      const winner = await this.getTemporalAssertion(input.id);
      if (winner) {
        if (!sameTemporalAssertion(winner, input)) conflict("TEMPORAL_ASSERTION_CONFLICT");
        await assertPersistedBindingsMatch(this, input, sourceBindings);
        return winner;
      }
      const semanticWinner = await this.database.queryOne<Row>({
        sql: `SELECT * FROM temporal_assertions
          WHERE fact_identity_id = ? AND payload_hash = ? AND provenance_hash = ? LIMIT 1`,
        parameters: [input.factIdentityId, input.payloadHash, input.provenanceHash],
      });
      if (semanticWinner) conflict("TEMPORAL_ASSERTION_CONFLICT");
      if (isCanonicalGuardViolation(error) || isUniqueConstraintViolation(error)) {
        conflict("ASSERTION_SOURCE_BINDING_CONFLICT");
      }
      throw error;
    }
    return input;
  }

  async getTemporalAssertion(id: string): Promise<TemporalAssertion | null> {
    const row = await this.database.queryOne<Row>({
      sql: "SELECT * FROM temporal_assertions WHERE id = ? LIMIT 1",
      parameters: [id],
    });
    return row ? mapTemporalAssertion(row) : null;
  }

  async listAssertionsForFact(factIdentityId: string): Promise<TemporalAssertion[]> {
    const result = await this.database.query<Row>({
      sql: `SELECT * FROM temporal_assertions
        WHERE fact_identity_id = ? ORDER BY effective_from ASC, created_at ASC, id ASC`,
      parameters: [factIdentityId],
    });
    return result.rows.map(mapTemporalAssertion);
  }

  async createSourceIdentity(input: SourceIdentity): Promise<SourceIdentity> {
    await this.database.execute({
      sql: `INSERT INTO source_identities
        (id, canonical_key, source_type, canonical_label, normalized_identity,
         publisher, jurisdiction, lifecycle_state, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING`,
      parameters: [
        input.id,
        input.logicalSourceDocumentId,
        input.sourceKind,
        input.officialTitle,
        input.normalizedIdentity,
        input.issuer,
        input.jurisdiction,
        input.lifecycleState,
        input.createdBy,
        input.createdAt,
      ],
    });
    const row = await this.database.queryOne<Row>({
      sql: "SELECT * FROM source_identities WHERE canonical_key = ? LIMIT 1",
      parameters: [input.logicalSourceDocumentId],
    });
    const mapped = row ? mapSourceIdentity(row) : null;
    if (!mapped || !sameRecord(mapped, input)) {
      conflict("SOURCE_IDENTITY_CONFLICT");
    }
    return mapped;
  }

  async createAssertionSourceBinding(
    input: AssertionSourceBinding,
  ): Promise<AssertionSourceBinding> {
    const row = await this.database.queryOne<Row>({
      sql: `SELECT * FROM assertion_source_bindings
        WHERE temporal_assertion_id = ? AND source_identity_id = ?
          AND source_role = ? AND locator = ? LIMIT 1`,
      parameters: [
        input.temporalAssertionId,
        input.sourceIdentityId,
        input.sourceRole,
        input.locator,
      ],
    });
    const mapped = row ? mapSourceBinding(row) : null;
    if (!mapped) conflict("ASSERTION_SOURCE_BINDING_SET_IMMUTABLE");
    if (!sameRecord(mapped, input)) conflict("ASSERTION_SOURCE_BINDING_CONFLICT");
    return mapped;
  }

  async listSourcesForAssertion(
    temporalAssertionId: string,
  ): Promise<AssertionSourceBinding[]> {
    const result = await this.database.query<Row>({
      sql: `SELECT * FROM assertion_source_bindings
        WHERE temporal_assertion_id = ?
        ORDER BY CASE source_role WHEN 'PRIMARY_AUTHORITY' THEN 0
          WHEN 'SUPPORTING_AUTHORITY' THEN 1 ELSE 2 END, created_at ASC, id ASC`,
      parameters: [temporalAssertionId],
    });
    return result.rows.map(mapSourceBinding);
  }

  async createFactConceptBinding(
    input: FactConceptBinding,
  ): Promise<FactConceptBinding> {
    const row = await this.database.queryOne<Row>({
      sql: `SELECT * FROM fact_concept_bindings
        WHERE fact_identity_id = ? AND concept_id = ? LIMIT 1`,
      parameters: [input.factIdentityId, input.conceptId],
    });
    const mapped = row ? mapConceptBinding(row) : null;
    if (mapped && sameRecord(mapped, input)) return mapped;
    conflict(mapped ? "FACT_CONCEPT_BINDING_CONFLICT" : "GOVERNED_MAPPING_REQUIRED");
  }

  async createGovernedConceptMapping(
    input: ConceptPersistenceInput,
  ): Promise<ConceptPersistenceResult> {
    const fact = await this.getFactIdentity(input.binding.factIdentityId);
    if (!fact) conflict("PARENT_FACT_NOT_FOUND");
    const actor = await this.database.queryOne<Row>({
      sql: "SELECT id FROM users WHERE id = ? LIMIT 1",
      parameters: [input.binding.createdBy],
    });
    if (!actor) conflict("ACTOR_NOT_FOUND");

    const qualificationJson = input.binding.qualificationJson ?? null;
    const provenanceJson = input.binding.provenanceJson ?? null;
    if (input.concept.conceptKey.startsWith("fixture:") || input.binding.factIdentityId.startsWith("fixture:")) {
      conflict("FIXTURE_IDENTITY_LEAKAGE");
    }
    validateGovernedMapping({ ...input.binding, qualificationJson, provenanceJson }, fact);

    const aliasCollision = await this.database.queryOne<Row>({
      sql: `SELECT oa.concept_id FROM ontology_aliases oa
        WHERE oa.normalized_alias IN (?, ?) AND oa.concept_id <> ? LIMIT 1`,
      parameters: [input.concept.normalizedLabel, input.concept.conceptKey, input.concept.id],
    });
    if (aliasCollision) conflict("REVIEW_REQUIRED");

    let concept = await this.database.queryOne<Row>({
      sql: "SELECT * FROM ontology_concepts WHERE concept_key = ? LIMIT 1",
      parameters: [input.concept.conceptKey],
    });
    let conceptOutcome: ConceptPersistenceResult["outcome"] = "NEW_SUCCESS";
    if (concept) {
      if (!sameConcept(concept, input.concept)) conflict("CONFLICT");
      conceptOutcome = "MAP_TO_EXISTING";
    } else {
      await this.database.execute({
        sql: `INSERT INTO ontology_concepts
          (id, concept_key, namespace, label, normalized_label, category, description,
           metadata_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)`,
        parameters: [
          input.concept.id,
          input.concept.conceptKey,
          input.concept.namespace ?? "securium",
          input.concept.label,
          input.concept.normalizedLabel,
          input.concept.category ?? "general",
          input.concept.description ?? "",
          input.binding.createdAt,
          input.binding.createdAt,
        ],
      });
      concept = await this.database.queryOne<Row>({
        sql: "SELECT * FROM ontology_concepts WHERE concept_key = ? LIMIT 1",
        parameters: [input.concept.conceptKey],
      });
    }
    if (!concept) conflict("CONFLICT");

    const existing = await this.database.queryOne<Row>({
      sql: `SELECT * FROM fact_concept_bindings
        WHERE fact_identity_id = ? AND concept_id = ?
          AND mapping_status IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED') LIMIT 1`,
      parameters: [input.binding.factIdentityId, string(concept, "id")],
    });
    const expected = governedBindingValues(input, string(concept, "id"), qualificationJson, provenanceJson);
    if (existing) {
      const mapped = mapGovernedConceptBinding(existing);
      if (sameRecord(mapped, expected)) {
        return { outcome: "EXACT_REPLAY", conceptId: mapped.conceptId, binding: mapped };
      }
      conflict("CONFLICT");
    }
    await this.database.execute({
      sql: `INSERT INTO fact_concept_bindings
        (id, fact_identity_id, concept_id, created_by, created_at, relation_type,
         qualification_json, mapping_basis, provenance_json, mapping_status,
         mapping_version, reviewed_by, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      parameters: expectedValues(expected),
    });
    const persisted = await this.database.queryOne<Row>({
      sql: "SELECT * FROM fact_concept_bindings WHERE id = ? LIMIT 1",
      parameters: [input.binding.id],
    });
    if (!persisted) conflict("CONFLICT");
    return {
      outcome: conceptOutcome,
      conceptId: string(concept, "id"),
      binding: mapGovernedConceptBinding(persisted),
    };
  }

  async approveFactConceptBinding(input: Readonly<{
    bindingId: string;
    reviewedBy: string;
    reviewedAt: string;
    provenanceJson: string;
    qualificationJson: string;
  }>): Promise<GovernedFactConceptBinding> {
    const actor = await this.database.queryOne<Row>({
      sql: "SELECT id FROM users WHERE id = ? LIMIT 1",
      parameters: [input.reviewedBy],
    });
    if (!actor) conflict("ACTOR_NOT_FOUND");
    const existing = await this.database.queryOne<Row>({
      sql: "SELECT * FROM fact_concept_bindings WHERE id = ? LIMIT 1",
      parameters: [input.bindingId],
    });
    if (!existing) conflict("CONFLICT");
    if (string(existing, "mapping_basis") === "AI_SUGGESTED" && string(existing, "mapping_status") !== "SUGGESTED") {
      conflict("REVIEW_REQUIRED");
    }
    const fact = await this.getFactIdentity(string(existing, "fact_identity_id"));
    if (!fact) conflict("PARENT_FACT_NOT_FOUND");
    validateGovernedMapping({
      ...mapGovernedConceptBinding(existing),
      mappingStatus: "APPROVED",
      reviewedBy: input.reviewedBy,
      reviewedAt: input.reviewedAt,
      provenanceJson: input.provenanceJson,
      qualificationJson: input.qualificationJson,
    }, fact);
    await this.database.execute({
      sql: `UPDATE fact_concept_bindings SET mapping_status = 'APPROVED',
        provenance_json = ?, qualification_json = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ? AND mapping_status = 'SUGGESTED'`,
      parameters: [input.provenanceJson, input.qualificationJson, input.reviewedBy, input.reviewedAt, input.bindingId],
    });
    const approved = await this.database.queryOne<Row>({
      sql: "SELECT * FROM fact_concept_bindings WHERE id = ? LIMIT 1",
      parameters: [input.bindingId],
    });
    if (!approved || string(approved, "mapping_status") !== "APPROVED") conflict("REVIEW_REQUIRED");
    return mapGovernedConceptBinding(approved);
  }

  async replaceWithGovernedVersion(
    input: ConceptPersistenceInput,
  ): Promise<ConceptPersistenceResult> {
    const current = await this.database.queryOne<Row>({
      sql: `SELECT * FROM fact_concept_bindings
        WHERE fact_identity_id = ? AND concept_id = ?
          AND mapping_status IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED') LIMIT 1`,
      parameters: [input.binding.factIdentityId, input.concept.id],
    });
    if (!current) conflict("CONFLICT");
    const currentVersion = numberValue(current, "mapping_version");
    if ((input.binding.mappingVersion ?? currentVersion + 1) <= currentVersion) {
      conflict("CONFLICT");
    }
    const fact = await this.getFactIdentity(input.binding.factIdentityId);
    if (!fact) conflict("PARENT_FACT_NOT_FOUND");
    const actor = await this.database.queryOne<Row>({
      sql: "SELECT id FROM users WHERE id = ? LIMIT 1",
      parameters: [input.binding.createdBy],
    });
    if (!actor) conflict("ACTOR_NOT_FOUND");
    const concept = await this.database.queryOne<Row>({
      sql: "SELECT * FROM ontology_concepts WHERE concept_key = ? LIMIT 1",
      parameters: [input.concept.conceptKey],
    });
    if (!concept || !sameConcept(concept, input.concept)) conflict("CONFLICT");
    const qualificationJson = input.binding.qualificationJson ?? null;
    const provenanceJson = input.binding.provenanceJson ?? null;
    if (input.concept.conceptKey.startsWith("fixture:") || input.binding.factIdentityId.startsWith("fixture:")) {
      conflict("FIXTURE_IDENTITY_LEAKAGE");
    }
    validateGovernedMapping({ ...input.binding, qualificationJson, provenanceJson }, fact);
    const expected = governedBindingValues(
      { ...input, binding: { ...input.binding, mappingVersion: input.binding.mappingVersion ?? currentVersion + 1 } },
      string(concept, "id"),
      qualificationJson,
      provenanceJson,
    );
    await this.database.transaction([
      {
        sql: `UPDATE fact_concept_bindings SET mapping_status = 'SUPERSEDED'
          WHERE id = ? AND mapping_status IN ('LEGACY_UNVERIFIED', 'SUGGESTED', 'APPROVED')`,
        parameters: [string(current, "id")],
      },
      {
        sql: `INSERT INTO fact_concept_bindings
          (id, fact_identity_id, concept_id, created_by, created_at, relation_type,
           qualification_json, mapping_basis, provenance_json, mapping_status,
           mapping_version, reviewed_by, reviewed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        parameters: expectedValues(expected),
      },
    ]);
    const persisted = await this.database.queryOne<Row>({
      sql: "SELECT * FROM fact_concept_bindings WHERE id = ? LIMIT 1",
      parameters: [expected.id],
    });
    if (!persisted) conflict("CONFLICT");
    return { outcome: "MAP_TO_EXISTING", conceptId: expected.conceptId, binding: mapGovernedConceptBinding(persisted) };
  }

  async createFactTrackBinding(input: FactTrackBinding): Promise<FactTrackBinding> {
    await this.database.execute({
      sql: `INSERT INTO fact_track_bindings
        (id, fact_identity_id, track_key, created_by, created_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      parameters: [
        input.id,
        input.factIdentityId,
        input.trackKey,
        input.createdBy,
        input.createdAt,
      ],
    });
    const row = await this.database.queryOne<Row>({
      sql: `SELECT * FROM fact_track_bindings
        WHERE fact_identity_id = ? AND track_key = ? LIMIT 1`,
      parameters: [input.factIdentityId, input.trackKey],
    });
    const mapped = row ? mapTrackBinding(row) : null;
    if (!mapped || !sameRecord(mapped, input)) {
      conflict("FACT_TRACK_BINDING_CONFLICT");
    }
    return mapped;
  }
}

function string(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") conflict("FACT_ROW_INVALID");
  return value;
}

function nullableString(row: Row, key: string): string | null {
  const value = row[key];
  if (value !== null && typeof value !== "string") conflict("FACT_ROW_INVALID");
  return value;
}

function mapFactIdentity(row: Row): FactIdentity {
  return Object.freeze({
    id: string(row, "id"),
    canonicalKey: string(row, "canonical_key"),
    domain: string(row, "domain"),
    canonicalLabel: string(row, "canonical_label"),
    normalizedSemanticIdentity: string(row, "normalized_semantic_identity"),
    scopeDiscriminator: string(row, "scope_discriminator"),
    lifecycleState: string(row, "lifecycle_state") as FactIdentity["lifecycleState"],
    createdBy: string(row, "created_by"),
    createdAt: string(row, "created_at"),
  });
}

function mapTemporalAssertion(row: Row): TemporalAssertion {
  return Object.freeze({
    id: string(row, "id"),
    factIdentityId: string(row, "fact_identity_id"),
    normalizedProposition: string(row, "normalized_proposition"),
    effectiveFrom: string(row, "effective_from"),
    effectiveTo: nullableString(row, "effective_to"),
    currentnessState: string(row, "currentness_state") as TemporalAssertion["currentnessState"],
    qualification: string(row, "qualification"),
    normativeStrength: string(row, "normative_strength") as TemporalAssertion["normativeStrength"],
    payloadJson: string(row, "payload_json"),
    provenanceJson: string(row, "provenance_json"),
    payloadHash: string(row, "payload_hash"),
    provenanceHash: string(row, "provenance_hash"),
    lifecycleState: string(row, "lifecycle_state") as "DRAFT",
    createdBy: string(row, "created_by"),
    createdAt: string(row, "created_at"),
  });
}

function mapSourceIdentity(row: Row): SourceIdentity {
  return Object.freeze({
    id: string(row, "id"),
    logicalSourceDocumentId: string(row, "canonical_key"),
    sourceKind: string(row, "source_type"),
    officialTitle: string(row, "canonical_label"),
    normalizedIdentity: string(row, "normalized_identity"),
    issuer: string(row, "publisher"),
    jurisdiction: string(row, "jurisdiction"),
    lifecycleState: string(row, "lifecycle_state") as "ACTIVE",
    createdBy: string(row, "created_by"),
    createdAt: string(row, "created_at"),
  });
}

function mapSourceBinding(row: Row): AssertionSourceBinding {
  return Object.freeze({
    id: string(row, "id"),
    temporalAssertionId: string(row, "temporal_assertion_id"),
    sourceIdentityId: string(row, "source_identity_id"),
    sourceRole: string(row, "source_role") as AssertionSourceBinding["sourceRole"],
    sourceVersion: string(row, "source_version"),
    sourceHash: string(row, "source_hash"),
    locator: string(row, "locator"),
    verificationMetadataJson: string(row, "verification_metadata_json"),
    createdBy: string(row, "created_by"),
    createdAt: string(row, "created_at"),
  });
}

function mapConceptBinding(row: Row): FactConceptBinding {
  return Object.freeze({
    id: string(row, "id"),
    factIdentityId: string(row, "fact_identity_id"),
    conceptId: string(row, "concept_id"),
    createdBy: string(row, "created_by"),
    createdAt: string(row, "created_at"),
  });
}

function mapGovernedConceptBinding(row: Row): GovernedFactConceptBinding {
  return Object.freeze({
    id: string(row, "id"),
    factIdentityId: string(row, "fact_identity_id"),
    conceptId: string(row, "concept_id"),
    createdBy: string(row, "created_by"),
    createdAt: string(row, "created_at"),
    relationType: string(row, "relation_type") as "MAPS_TO",
    qualificationJson: nullableString(row, "qualification_json"),
    mappingBasis: nullableString(row, "mapping_basis") as GovernedFactConceptBinding["mappingBasis"],
    provenanceJson: nullableString(row, "provenance_json"),
    mappingStatus: string(row, "mapping_status") as GovernedFactConceptBinding["mappingStatus"],
    mappingVersion: numberValue(row, "mapping_version"),
    reviewedBy: nullableString(row, "reviewed_by"),
    reviewedAt: nullableString(row, "reviewed_at"),
  });
}

function numberValue(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number") conflict("FACT_ROW_INVALID");
  return value;
}

function sameConcept(row: Row, input: ConceptPersistenceInput["concept"]): boolean {
  return string(row, "concept_key") === input.conceptKey &&
    string(row, "label") === input.label &&
    string(row, "normalized_label") === input.normalizedLabel &&
    string(row, "namespace") === (input.namespace ?? "securium") &&
    string(row, "category") === (input.category ?? "general") &&
    string(row, "description") === (input.description ?? "");
}

function governedBindingValues(
  input: ConceptPersistenceInput,
  conceptId: string,
  qualificationJson: string | null,
  provenanceJson: string | null,
): GovernedFactConceptBinding {
  return Object.freeze({
    id: input.binding.id,
    factIdentityId: input.binding.factIdentityId,
    conceptId,
    createdBy: input.binding.createdBy,
    createdAt: input.binding.createdAt,
    relationType: "MAPS_TO",
    qualificationJson,
    mappingBasis: input.binding.mappingBasis,
    provenanceJson,
    mappingStatus: input.binding.mappingStatus,
    mappingVersion: input.binding.mappingVersion ?? 1,
    reviewedBy: input.binding.reviewedBy ?? null,
    reviewedAt: input.binding.reviewedAt ?? null,
  });
}

function expectedValues(input: GovernedFactConceptBinding): readonly DatabaseValue[] {
  return [
    input.id,
    input.factIdentityId,
    input.conceptId,
    input.createdBy,
    input.createdAt,
    input.relationType,
    input.qualificationJson,
    input.mappingBasis,
    input.provenanceJson,
    input.mappingStatus,
    input.mappingVersion,
    input.reviewedBy,
    input.reviewedAt,
  ];
}

function validateGovernedMapping(
  input: Readonly<{
    mappingBasis: string | null;
    mappingStatus: string;
    qualificationJson: string | null;
    provenanceJson: string | null;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
  }>,
  fact: FactIdentity,
) {
  if (input.mappingStatus === "APPROVED" && input.mappingBasis === "AI_SUGGESTED") {
    conflict("REVIEW_REQUIRED");
  }
  if (input.mappingStatus === "APPROVED" && !input.provenanceJson) {
    conflict("PROVENANCE_REQUIRED");
  }
  if (input.mappingStatus === "APPROVED" && (!input.reviewedBy || !input.reviewedAt)) {
    conflict("REVIEW_REQUIRED");
  }
  if (input.provenanceJson) {
    try {
      const identity = JSON.parse(input.provenanceJson) as { package_id?: unknown };
      if (typeof identity.package_id === "string" && identity.package_id.startsWith("fixture:")) {
        conflict("FIXTURE_IDENTITY_LEAKAGE");
      }
    } catch {
      // The provenance parser below emits the authoritative error.
    }
  }
  if (!input.qualificationJson) {
    if (input.mappingStatus === "APPROVED" && fact.scopeDiscriminator !== "global") {
      conflict("QUALIFICATION_LOSS_BLOCKED");
    }
    return;
  }
  let qualification: unknown;
  let provenance: unknown;
  try {
    qualification = JSON.parse(input.qualificationJson);
  } catch {
    conflict("QUALIFICATION_INVALID");
  }
  if (input.provenanceJson) {
    try {
      provenance = JSON.parse(input.provenanceJson);
    } catch {
      conflict("PROVENANCE_REQUIRED");
    }
  }
  const parsedQualification = conceptMappingQualificationSchema.safeParse(qualification);
  if (!parsedQualification.success) conflict("QUALIFICATION_INVALID");
  if (input.mappingStatus === "APPROVED") {
    const parsedProvenance = conceptMappingProvenanceSchema.safeParse(provenance);
    if (!parsedProvenance.success) conflict("PROVENANCE_REQUIRED");
  }
  assertConceptMappingQualificationPreserved({
    factScope: fact.scopeDiscriminator,
    qualificationJson: input.qualificationJson,
    mappingStatus: input.mappingStatus as Parameters<typeof assertConceptMappingQualificationPreserved>[0]["mappingStatus"],
  });
}

function mapTrackBinding(row: Row): FactTrackBinding {
  return Object.freeze({
    id: string(row, "id"),
    factIdentityId: string(row, "fact_identity_id"),
    trackKey: string(row, "track_key"),
    createdBy: string(row, "created_by"),
    createdAt: string(row, "created_at"),
  });
}

function sameFactIdentity(left: FactIdentity, right: FactIdentity): boolean {
  return sameRecord(left, right);
}

function sameTemporalAssertion(left: TemporalAssertion, right: TemporalAssertion): boolean {
  return sameRecord(left, right);
}

function sameRecord(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return keys.size === Object.keys(left).length &&
    keys.size === Object.keys(right).length &&
    [...keys].every((key) => left[key] === right[key]);
}

function conflict(code: string): never {
  throw new AppError("Canonical Fact persistence conflict.", 409, code);
}

function sourceBindingInsertStatement(input: AssertionSourceBinding) {
  return {
    sql: `INSERT INTO assertion_source_bindings
      (id, temporal_assertion_id, source_identity_id, source_role, source_version,
       source_hash, locator, verification_metadata_json, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING`,
    parameters: [
      input.id,
      input.temporalAssertionId,
      input.sourceIdentityId,
      input.sourceRole,
      input.sourceVersion,
      input.sourceHash,
      input.locator,
      input.verificationMetadataJson,
      input.createdBy,
      input.createdAt,
    ],
  } as const;
}

function factIdentityInsertStatement(input: FactIdentity): DatabaseStatement {
  return {
    sql: `INSERT INTO fact_identities
      (id, canonical_key, domain, canonical_label, normalized_semantic_identity,
       scope_discriminator, lifecycle_state, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING`,
    parameters: factIdentityValues(input),
  };
}

function canonicalCandidateStateGuardStatement(
  factIdentity: FactIdentity,
  assertion: TemporalAssertion,
  bindings: readonly AssertionSourceBinding[],
): DatabaseStatement {
  const relevantState = [
    "EXISTS (SELECT 1 FROM fact_identities WHERE id = ? OR canonical_key = ?)",
    `EXISTS (SELECT 1 FROM temporal_assertions
      WHERE id = ? OR (fact_identity_id = ? AND payload_hash = ? AND provenance_hash = ?))`,
    "EXISTS (SELECT 1 FROM assertion_source_bindings WHERE temporal_assertion_id = ?)",
  ].join(" OR ");
  const exactBindings = bindings.length === 0
    ? "1 = 1"
    : bindings.map(() =>
      `EXISTS (SELECT 1 FROM assertion_source_bindings WHERE ${sourceBindingExactPredicate()})`
    ).join(" AND ");
  const exactState = [
    `EXISTS (SELECT 1 FROM fact_identities WHERE ${factIdentityExactPredicate()})`,
    `EXISTS (SELECT 1 FROM temporal_assertions WHERE ${temporalAssertionExactPredicate()})`,
    "(SELECT count(*) FROM assertion_source_bindings WHERE temporal_assertion_id = ?) = ?",
    exactBindings,
  ].join(" AND ");
  return canonicalGuardStatement(
    assertion,
    `(${relevantState}) AND NOT (${exactState})`,
    [
      factIdentity.id,
      factIdentity.canonicalKey,
      assertion.id,
      assertion.factIdentityId,
      assertion.payloadHash,
      assertion.provenanceHash,
      assertion.id,
      ...factIdentityValues(factIdentity),
      ...temporalAssertionPredicateValues(assertion),
      assertion.id,
      bindings.length,
      ...bindings.flatMap(sourceBindingValues),
    ],
  );
}

function canonicalFactGuardStatement(
  factIdentity: FactIdentity,
  assertion: TemporalAssertion,
): DatabaseStatement {
  return canonicalGuardStatement(
    assertion,
    `NOT EXISTS (SELECT 1 FROM fact_identities WHERE ${factIdentityExactPredicate()})`,
    factIdentityValues(factIdentity),
  );
}

function temporalAssertionInsertStatement(input: TemporalAssertion): DatabaseStatement {
  return {
    sql: `INSERT INTO temporal_assertions
      (id, fact_identity_id, normalized_proposition, effective_from, effective_to,
       currentness_state, qualification, normative_strength, payload_json,
       provenance_json, payload_hash, provenance_hash, lifecycle_state, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING`,
    parameters: temporalAssertionValues(input),
  };
}

function canonicalAssertionGuardStatement(input: TemporalAssertion): DatabaseStatement {
  return canonicalGuardStatement(
    input,
    `NOT EXISTS (SELECT 1 FROM temporal_assertions WHERE ${temporalAssertionExactPredicate()})`,
    temporalAssertionPredicateValues(input),
  );
}

function canonicalSourceBindingGuardStatement(
  input: TemporalAssertion,
  binding: AssertionSourceBinding,
): DatabaseStatement {
  return canonicalGuardStatement(
    input,
    `NOT EXISTS (SELECT 1 FROM assertion_source_bindings WHERE ${sourceBindingExactPredicate()})`,
    sourceBindingValues(binding),
  );
}

function canonicalBindingCountGuardStatement(
  input: TemporalAssertion,
  expectedBindingCount: number,
): DatabaseStatement {
  const violationPredicate = [
    `NOT EXISTS (SELECT 1 FROM temporal_assertions WHERE ${temporalAssertionExactPredicate()})`,
    `(SELECT count(*) FROM assertion_source_bindings WHERE temporal_assertion_id = ?) <> ?`,
  ].join(" OR ");
  return canonicalGuardStatement(input, violationPredicate, [
    ...temporalAssertionPredicateValues(input),
    input.id,
    expectedBindingCount,
  ]);
}

function canonicalGuardStatement(
  input: TemporalAssertion,
  violationPredicate: string,
  predicateParameters: readonly DatabaseValue[],
): DatabaseStatement {
  return {
    sql: `INSERT INTO temporal_assertions
      (id, fact_identity_id, normalized_proposition, effective_from, effective_to,
       currentness_state, qualification, normative_strength, payload_json,
       provenance_json, payload_hash, provenance_hash, lifecycle_state, created_by, created_at)
      SELECT NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE ${violationPredicate}`,
    parameters: [
      input.factIdentityId,
      input.normalizedProposition,
      input.effectiveFrom,
      input.effectiveTo,
      input.currentnessState,
      input.qualification,
      input.normativeStrength,
      input.payloadJson,
      input.provenanceJson,
      input.payloadHash,
      input.provenanceHash,
      input.lifecycleState,
      input.createdBy,
      input.createdAt,
      ...predicateParameters,
    ],
  };
}

function temporalAssertionValues(input: TemporalAssertion): readonly DatabaseValue[] {
  return [
    input.id,
    input.factIdentityId,
    input.normalizedProposition,
    input.effectiveFrom,
    input.effectiveTo,
    input.currentnessState,
    input.qualification,
    input.normativeStrength,
    input.payloadJson,
    input.provenanceJson,
    input.payloadHash,
    input.provenanceHash,
    input.lifecycleState,
    input.createdBy,
    input.createdAt,
  ];
}

function sourceBindingValues(input: AssertionSourceBinding): readonly DatabaseValue[] {
  return [
    input.id,
    input.temporalAssertionId,
    input.sourceIdentityId,
    input.sourceRole,
    input.sourceVersion,
    input.sourceHash,
    input.locator,
    input.verificationMetadataJson,
    input.createdBy,
    input.createdAt,
  ];
}

function temporalAssertionExactPredicate() {
  return `id = ? AND fact_identity_id = ? AND normalized_proposition = ?
    AND effective_from = ?
    AND (effective_to = ? OR (effective_to IS NULL AND CAST(? AS TEXT) IS NULL))
    AND currentness_state = ? AND qualification = ? AND normative_strength = ?
    AND payload_json = ? AND provenance_json = ? AND payload_hash = ?
    AND provenance_hash = ? AND lifecycle_state = ? AND created_by = ? AND created_at = ?`;
}

function sourceBindingExactPredicate() {
  return `id = ? AND temporal_assertion_id = ? AND source_identity_id = ?
    AND source_role = ? AND source_version = ? AND source_hash = ? AND locator = ?
    AND verification_metadata_json = ? AND created_by = ? AND created_at = ?`;
}

function factIdentityExactPredicate() {
  return `id = ? AND canonical_key = ? AND domain = ? AND canonical_label = ?
    AND normalized_semantic_identity = ? AND scope_discriminator = ?
    AND lifecycle_state = ? AND created_by = ? AND created_at = ?`;
}

function factIdentityValues(input: FactIdentity): readonly DatabaseValue[] {
  return [
    input.id,
    input.canonicalKey,
    input.domain,
    input.canonicalLabel,
    input.normalizedSemanticIdentity,
    input.scopeDiscriminator,
    input.lifecycleState,
    input.createdBy,
    input.createdAt,
  ];
}

function temporalAssertionPredicateValues(input: TemporalAssertion): readonly DatabaseValue[] {
  const values = temporalAssertionValues(input);
  return [...values.slice(0, 5), input.effectiveTo, ...values.slice(5)];
}

function isUniqueConstraintViolation(error: unknown) {
  if (error instanceof AppError && error.code === "DATABASE_UNIQUE_VIOLATION") {
    return true;
  }
  return error instanceof Error &&
    /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|duplicate key/i.test(error.message);
}

function isCanonicalGuardViolation(error: unknown) {
  return error instanceof Error &&
    /NOT NULL constraint failed: temporal_assertions\.id|null value in column ["']?id["']?.*not-null constraint/i
      .test(error.message);
}

async function assertBindingsMatchAssertion(
  assertion: TemporalAssertion,
  bindings: readonly AssertionSourceBinding[],
) {
  if (bindings.some((binding) => binding.temporalAssertionId !== assertion.id)) {
    conflict("ASSERTION_SOURCE_BINDING_ASSERTION_MISMATCH");
  }
  const manifest = provenanceManifestFromBindings(bindings);
  const expectedJson = canonicalizeFactJson(manifest);
  const expectedHash = await digestFactProvenance(bindings);
  if (assertion.provenanceJson !== expectedJson || assertion.provenanceHash !== expectedHash) {
    conflict("ASSERTION_PROVENANCE_BINDING_MISMATCH");
  }
  createFactProvenanceManifest(JSON.parse(assertion.provenanceJson));
}

async function assertPersistedBindingsMatch(
  repository: FactRepository,
  assertion: TemporalAssertion,
  expected: readonly AssertionSourceBinding[],
) {
  const persisted = await repository.listSourcesForAssertion(assertion.id);
  const byIdentity = (left: AssertionSourceBinding, right: AssertionSourceBinding) =>
    left.id.localeCompare(right.id);
  const persistedOrdered = [...persisted].sort(byIdentity);
  const expectedOrdered = [...expected].sort(byIdentity);
  if (
    persistedOrdered.length !== expectedOrdered.length ||
    persistedOrdered.some((binding, index) => !sameRecord(binding, expectedOrdered[index]))
  ) {
    conflict("ASSERTION_PROVENANCE_BINDING_MISMATCH");
  }
  await assertBindingsMatchAssertion(assertion, persisted);
}

type CanonicalCandidateState =
  | "ABSENT"
  | "EXACT"
  | "FACT_CONFLICT"
  | "ASSERTION_CONFLICT"
  | "PARTIAL";

async function inspectCanonicalCandidateState(
  repository: FactRepository,
  factIdentity: FactIdentity,
  assertion: TemporalAssertion,
  bindings: readonly AssertionSourceBinding[],
): Promise<CanonicalCandidateState> {
  const [factById, factByKey, persistedAssertion, persistedBindings] = await Promise.all([
    repository.getFactIdentity(factIdentity.id),
    repository.findFactByCanonicalKey(factIdentity.canonicalKey),
    repository.getTemporalAssertion(assertion.id),
    repository.listSourcesForAssertion(assertion.id),
  ]);
  const fact = factById ?? factByKey;
  if (!fact && !persistedAssertion && persistedBindings.length === 0) return "ABSENT";
  if (!fact || (factById && factByKey && factById.id !== factByKey.id)) {
    return "FACT_CONFLICT";
  }
  if (!sameFactIdentity(fact, factIdentity)) return "FACT_CONFLICT";
  if (!persistedAssertion) return "PARTIAL";
  if (!sameTemporalAssertion(persistedAssertion, assertion)) return "ASSERTION_CONFLICT";
  const byIdentity = (left: AssertionSourceBinding, right: AssertionSourceBinding) =>
    left.id.localeCompare(right.id);
  const persistedOrdered = [...persistedBindings].sort(byIdentity);
  const expectedOrdered = [...bindings].sort(byIdentity);
  if (
    persistedOrdered.length !== expectedOrdered.length ||
    persistedOrdered.some((binding, index) => !sameRecord(binding, expectedOrdered[index]))
  ) {
    return "PARTIAL";
  }
  return "EXACT";
}

function canonicalCandidateResult(
  outcome: CanonicalCandidatePersistenceResult["outcome"],
  factIdentity: FactIdentity,
  temporalAssertion: TemporalAssertion,
  sourceBindings: readonly AssertionSourceBinding[],
): CanonicalCandidatePersistenceResult {
  return Object.freeze({
    outcome,
    factIdentity,
    temporalAssertion,
    sourceBindings: Object.freeze([...sourceBindings]),
  });
}
