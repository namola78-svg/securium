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

export type FactConceptBinding = Readonly<{
  id: string;
  factIdentityId: string;
  conceptId: string;
  createdBy: string;
  createdAt: string;
}>;

export type FactTrackBinding = Readonly<{
  id: string;
  factIdentityId: string;
  trackKey: string;
  createdBy: string;
  createdAt: string;
}>;

type Row = Record<string, DatabaseValue>;

export class FactRepository {
  private readonly database: DatabaseProvider;

  constructor(database: DatabaseProvider) {
    this.database = database;
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
    await this.database.execute({
      sql: `INSERT INTO fact_concept_bindings
        (id, fact_identity_id, concept_id, created_by, created_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      parameters: [
        input.id,
        input.factIdentityId,
        input.conceptId,
        input.createdBy,
        input.createdAt,
      ],
    });
    const row = await this.database.queryOne<Row>({
      sql: `SELECT * FROM fact_concept_bindings
        WHERE fact_identity_id = ? AND concept_id = ? LIMIT 1`,
      parameters: [input.factIdentityId, input.conceptId],
    });
    const mapped = row ? mapConceptBinding(row) : null;
    if (!mapped || !sameRecord(mapped, input)) {
      conflict("FACT_CONCEPT_BINDING_CONFLICT");
    }
    return mapped;
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
