import type {
  DatabaseProvider,
  DatabaseValue,
} from "../../db/provider/database-provider.ts";
import {
  buildSwSecurityWeaknessConceptCanonicalizationPackage,
  preflightSwSecurityWeaknessConceptCanonicalization,
  validateSwSecurityWeaknessConceptCanonicalizationPackage,
  type ExistingConceptRecord,
  type ExistingEdgeRecord,
  type SwCanonicalizationConcept,
  type SwCanonicalizationEdge,
  type SwCanonicalizationPackage,
} from "./securium-sw-security-weakness-concept-canonicalization.ts";

export const REQUIRED_CANONICAL_MIGRATIONS = Object.freeze([
  "0001_d1_compatibility_schema",
  "0002_server_only_rls_lockdown",
  "0003_curriculum_tree",
  "0004_shared_content_lesson",
  "0005_course_lesson_lesson_progress",
  "0006_question_attempt_lookup_index",
  "0007_ai_explainability_feedback",
  "0008_ontology_graph_storage",
  "0009_security_certification_taxonomy_cleanup",
  "0010_practical_attempt_evaluation_foundation",
  "0011_canonical_fact_foundation",
  "0012_fact_concept_mapping_governance",
  "0013_question_governance_foundation",
  "0014_learning_event_version_revision_governance",
  "0015_evidence_projection_foundation",
  "0016_theory_revision_governance",
  "0017_evidence_e1_core_remediation",
  "0018_practical_revision_governance",
  "0019_evidence_e2_a_recompute_operations",
] as const);

const APPROVED_BASELINE_RECEIPT = Object.freeze({
  baselineId: "POSTGRES_FRESH_BASELINE_V1",
  baselineVersion: "1",
  schemaBoundary: "0019",
  artifactSha256: "2742f0b0b2c11b596d9c7336deb35489f14737e451f4956278f19611ff73f32a",
  schemaSha256: "05539edb00d8aad15f7ef86e43fc736f9f889df7fa0f470131207c5b73ee5ea2",
  securitySha256: "61ce56b51c7169cf7c98e4ec5cdcddc8720e06c292a93543de4ecb2f43eb8ba0",
} as const);

const REQUIRED_TABLES = Object.freeze([
  "app_schema_migrations",
  "ontology_concepts",
  "ontology_aliases",
  "ontology_edges",
  "admin_audit_logs",
  "evidence_projections",
  "evidence_recompute_requests",
] as const);

const REQUIRED_COLUMNS = Object.freeze({
  app_schema_migrations: ["id"],
  ontology_concepts: [
    "id", "concept_key", "namespace", "label", "normalized_label",
    "category", "description", "status", "metadata_json",
  ],
  ontology_aliases: ["id", "concept_id", "alias", "normalized_alias", "language", "source"],
  ontology_edges: [
    "id", "edge_key", "course_id", "from_type", "from_id", "to_type",
    "to_id", "relation", "confidence", "evidence_json", "status",
  ],
  admin_audit_logs: [
    "id", "actor_user_id", "actor_role", "action", "resource_type",
    "resource_id", "result", "metadata_json",
  ],
  evidence_projections: ["concept_id"],
  evidence_recompute_requests: ["concept_id"],
} as const);

const RLS_EXPECTATIONS = Object.freeze({
  app_schema_migrations: { enabled: true, force: false },
  ontology_concepts: { enabled: true, force: false },
  ontology_aliases: { enabled: true, force: false },
  ontology_edges: { enabled: true, force: false },
  admin_audit_logs: { enabled: true, force: false },
  evidence_projections: { enabled: true, force: true },
  evidence_recompute_requests: { enabled: true, force: true },
} as const);

export type CanonicalPreflightState =
  | "CLEAN"
  | "EXACT_REPLAY"
  | "INCOMPATIBLE_CONCEPT"
  | "INCOMPATIBLE_EDGE"
  | "PARTIAL_PACKAGE"
  | "EVIDENCE_BLOCKED"
  | "PREFLIGHT_UNKNOWN";

export type CanonicalPreflightResult = {
  operation: "READ_ONLY_PREFLIGHT";
  status: "PASS" | "BLOCK" | "UNKNOWN";
  canonicalIdentity: "CANONICAL_VERIFIED" | "CANONICAL_NOT_VERIFIED";
  identity: {
    provider: "supabase" | "not-supabase";
    database: string;
    schema: string;
    searchPath: string;
    postgresqlVersion: string;
  };
  migration: {
    ready: boolean;
    appliedCount: number;
    requiredCount: number;
    missingCount: number;
  };
  schema: {
    ready: boolean;
    requiredTables: number;
    presentTables: number;
    missingColumns: number;
  };
  rls: "PASS" | "DRIFT" | "UNKNOWN";
  forceRls: "PASS" | "DRIFT" | "UNKNOWN";
  trustedServer: "PASS" | "DENY" | "UNKNOWN";
  package: {
    conceptCount: 3;
    edgeCount: 4;
    state: "DRAFT";
    conceptKeys: readonly string[];
    edgeKeys: readonly string[];
  };
  evidencePreflight: "PASS" | "BLOCK" | "UNKNOWN";
  productionStateClassification: CanonicalPreflightState;
  existingState: {
    conceptsFound: number;
    edgesFound: number;
    exactConcepts: number;
    exactEdges: number;
    extraEdges: number;
  };
  runtimeVisibility: {
    draftConceptsVisible: number;
    draftEdgesVisible: number;
  };
  blockerCode?: string;
};

type Row = Record<string, unknown>;

export async function runSwSecurityWeaknessCanonicalDatabasePreflight(
  provider: DatabaseProvider,
): Promise<CanonicalPreflightResult> {
  const packageValue = buildSwSecurityWeaknessConceptCanonicalizationPackage();
  validateSwSecurityWeaknessConceptCanonicalizationPackage(packageValue);
  const emptyState = {
    conceptsFound: 0,
    edgesFound: 0,
    exactConcepts: 0,
    exactEdges: 0,
    extraEdges: 0,
  };
  const base = (overrides: Partial<CanonicalPreflightResult>): CanonicalPreflightResult => ({
    operation: "READ_ONLY_PREFLIGHT",
    status: "UNKNOWN",
    canonicalIdentity: "CANONICAL_NOT_VERIFIED",
    identity: {
      provider: provider.kind === "supabase" ? "supabase" : "not-supabase",
      database: "UNKNOWN",
      schema: "UNKNOWN",
      searchPath: "UNKNOWN",
      postgresqlVersion: "UNKNOWN",
    },
    migration: {
      ready: false,
      appliedCount: 0,
      requiredCount: REQUIRED_CANONICAL_MIGRATIONS.length,
      missingCount: REQUIRED_CANONICAL_MIGRATIONS.length,
    },
    schema: {
      ready: false,
      requiredTables: REQUIRED_TABLES.length,
      presentTables: 0,
      missingColumns: 0,
    },
    rls: "UNKNOWN",
    forceRls: "UNKNOWN",
    trustedServer: "UNKNOWN",
    package: {
      conceptCount: 3,
      edgeCount: 4,
      state: "DRAFT",
      conceptKeys: packageValue.concepts.map((concept) => concept.key),
      edgeKeys: packageValue.edges.map((edge) => edge.key),
    },
    evidencePreflight: "UNKNOWN",
    productionStateClassification: "PREFLIGHT_UNKNOWN",
    existingState: emptyState,
    runtimeVisibility: { draftConceptsVisible: 0, draftEdgesVisible: 0 },
    ...overrides,
  });

  if (provider.kind !== "supabase") {
    return base({ blockerCode: "CANONICAL_DATABASE_PROVIDER_NOT_SUPABASE" });
  }

  let identity: Row;
  let tables: Set<string>;
  let columns: Map<string, Set<string>>;
  let migrationIds: Set<string>;
  let baselineReceipt: Row | null;
  let rlsRows: Map<string, { enabled: boolean; force: boolean }>;
  let trustedServer: "PASS" | "DENY" | "UNKNOWN";
  try {
    identity = await queryOne(provider, `SELECT version() AS version, current_database() AS database_name, current_schema() AS schema_name, current_setting('search_path') AS search_path`);
    tables = new Set((await queryRows(provider, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (${placeholders(REQUIRED_TABLES.length)}) ORDER BY table_name`, REQUIRED_TABLES)).map((row) => String(row.table_name)));
    const columnRows = await queryRows(provider, `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN (${placeholders(REQUIRED_TABLES.length)})`, REQUIRED_TABLES);
    columns = new Map();
    for (const row of columnRows) {
      const name = String(row.table_name);
      columns.set(name, new Set([...(columns.get(name) ?? []), String(row.column_name)]));
    }
    migrationIds = new Set((await queryRows(provider, `SELECT id FROM public.app_schema_migrations ORDER BY id`)).map((row) => String(row.id)));
    const baselineRelation = await queryOne<Row>(provider, `SELECT to_regclass('public.app_schema_baseline_receipts') AS relation`);
    baselineReceipt = baselineRelation?.relation
      ? await queryOne<Row>(provider, `SELECT baseline_id, baseline_version, schema_boundary, artifact_sha256, schema_sha256, security_sha256 FROM public.app_schema_baseline_receipts WHERE baseline_id = ? LIMIT 1`, [APPROVED_BASELINE_RECEIPT.baselineId])
      : null;
    const rlsResult = await queryRows(provider, `SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN (${placeholders(REQUIRED_TABLES.length)})`, REQUIRED_TABLES);
    rlsRows = new Map(rlsResult.map((row) => [String(row.table_name), { enabled: Boolean(row.rls_enabled), force: Boolean(row.force_rls) }]));
    const privilege = await queryOne(provider, `SELECT has_table_privilege(current_user, 'public.ontology_concepts', 'SELECT') AS concept_select, has_table_privilege(current_user, 'public.ontology_edges', 'SELECT') AS edge_select, has_table_privilege(current_user, 'public.evidence_projections', 'SELECT') AS evidence_select, has_table_privilege(current_user, 'public.evidence_recompute_requests', 'SELECT') AS recompute_select`);
    trustedServer = privilege && Boolean(privilege.concept_select) && Boolean(privilege.edge_select) && Boolean(privilege.evidence_select) && Boolean(privilege.recompute_select) ? "PASS" : "DENY";
  } catch {
    return base({ blockerCode: "CANONICAL_PREFLIGHT_DATABASE_READ_FAILED" });
  }

  const missingColumns = Object.entries(REQUIRED_COLUMNS).reduce((count, [table, required]) =>
    count + required.filter((column) => !columns.get(table)?.has(column)).length, 0);
  const missingMigrations = REQUIRED_CANONICAL_MIGRATIONS.filter((id) => !migrationIds.has(id));
  const baselineReady = baselineReceiptMatches(baselineReceipt);
  const migrationReady = missingMigrations.length === 0 || baselineReady;
  const schemaReady = tables.size === REQUIRED_TABLES.length && missingColumns === 0;
  const rlsStatus = classifyRls(rlsRows);
  const identityData = {
    provider: "supabase" as const,
    database: String(identity.database_name ?? "UNKNOWN"),
    schema: String(identity.schema_name ?? "UNKNOWN"),
    searchPath: String(identity.search_path ?? "UNKNOWN"),
    postgresqlVersion: String(identity.version ?? "UNKNOWN"),
  };
  const canonicalIdentityVerified = aggregateCanonicalIdentity({
    providerIdentity: provider.kind === "supabase" && Object.values(identityData).every((value) => value !== "UNKNOWN" && value.length > 0),
    migrationReady,
    schemaReady,
    rls: rlsStatus.rls,
    forceRls: rlsStatus.forceRls,
    trustedServer,
  });
  const schemaOverrides = {
    migration: {
      ready: migrationReady,
      appliedCount: migrationReady ? REQUIRED_CANONICAL_MIGRATIONS.length : REQUIRED_CANONICAL_MIGRATIONS.length - missingMigrations.length,
      requiredCount: REQUIRED_CANONICAL_MIGRATIONS.length,
      missingCount: migrationReady ? 0 : missingMigrations.length,
    },
    schema: {
      ready: schemaReady,
      requiredTables: REQUIRED_TABLES.length,
      presentTables: tables.size,
      missingColumns,
    },
    identity: identityData,
    canonicalIdentity: canonicalIdentityVerified ? "CANONICAL_VERIFIED" as const : "CANONICAL_NOT_VERIFIED" as const,
    rls: rlsStatus.rls,
    forceRls: rlsStatus.forceRls,
    trustedServer,
  };
  if (!canonicalIdentityVerified) {
    return base({ ...schemaOverrides, blockerCode: !schemaReady || !migrationReady ? "SCHEMA_NOT_READY" : "CANONICAL_SECURITY_PREFLIGHT_FAILED" });
  }

  const state = await readPackageState(provider, packageValue);
  const evidencePreflight = await readEvidencePreflight(provider, packageValue);
  const stateClassification = classifyState(state, evidencePreflight);
  const runtimeVisibility = await readRuntimeVisibility(provider, packageValue);
  const status = stateClassification === "PREFLIGHT_UNKNOWN" ? "UNKNOWN" : stateClassification === "CLEAN" || stateClassification === "EXACT_REPLAY" ? "PASS" : "BLOCK";
  return base({
    ...schemaOverrides,
    status,
    evidencePreflight,
    productionStateClassification: stateClassification,
    existingState: state,
    runtimeVisibility,
    blockerCode: stateClassification === "PREFLIGHT_UNKNOWN" ? "CANONICAL_PREFLIGHT_UNKNOWN" : stateClassification === "CLEAN" || stateClassification === "EXACT_REPLAY" ? undefined : `CANONICAL_STATE_${stateClassification}`,
  });
}
function createPreflightStore(provider: DatabaseProvider) {
  return {
    findConcept: async (key: string): Promise<ExistingConceptRecord | null> => {
      const row = await queryOne<Row>(provider, `SELECT concept_key AS key, label, normalized_label AS "normalizedLabel", namespace, description, status FROM public.ontology_concepts WHERE concept_key = ? LIMIT 1`, [key]);
      return row as ExistingConceptRecord | null;
    },
    findEdge: async (key: string): Promise<ExistingEdgeRecord | null> => {
      const row = await queryOne<Row>(provider, `SELECT edge_key AS key, from_type AS "fromType", from_id AS "fromId", to_type AS "toType", to_id AS "toId", relation, status FROM public.ontology_edges WHERE edge_key = ? LIMIT 1`, [key]);
      return row as ExistingEdgeRecord | null;
    },
    findRuntimeReferences: async (keys: readonly string[]) => {
      try {
        const references: string[] = [];
        for (const key of keys) {
          const evidence = await queryRows<Row>(provider, `SELECT DISTINCT ep.concept_id AS reference FROM public.evidence_projections ep LEFT JOIN public.ontology_concepts oc ON oc.id = ep.concept_id WHERE ep.concept_id = ? OR oc.concept_key = ?`, [key, key]);
          const recompute = await queryRows<Row>(provider, `SELECT DISTINCT er.concept_id AS reference FROM public.evidence_recompute_requests er LEFT JOIN public.ontology_concepts oc ON oc.id = er.concept_id WHERE er.concept_id = ? OR oc.concept_key = ?`, [key, key]);
          references.push(
            ...evidence.map((row) => String(row.reference ?? "")),
            ...recompute.map((row) => String(row.reference ?? "")),
          );
        }
        return { status: "PASS" as const, references };
      } catch {
        return { status: "UNKNOWN" as const, references: [] };
      }
    },
  };
}

async function readEvidencePreflight(provider: DatabaseProvider, packageValue: SwCanonicalizationPackage) {
  try {
    await preflightSwSecurityWeaknessConceptCanonicalization(createPreflightStore(provider), packageValue);
    return "PASS" as const;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
    if (code === "SW_CANONICAL_RUNTIME_REFERENCE_FOUND") return "BLOCK" as const;
    if (code === "SW_CANONICAL_REFERENCE_PREFLIGHT_UNKNOWN") return "UNKNOWN" as const;
    if (code === "SW_CANONICAL_IDENTITY_COLLISION") return "PASS" as const;
    return "UNKNOWN" as const;
  }
}

async function readPackageState(provider: DatabaseProvider, packageValue: SwCanonicalizationPackage) {
  const conceptResults = await Promise.all(packageValue.concepts.map(async (expected) => {
    const row = await queryOne<Row>(provider, `SELECT id, concept_key AS key, label, normalized_label, namespace, category, description, status, metadata_json FROM public.ontology_concepts WHERE concept_key = ? LIMIT 1`, [expected.key]);
    if (!row) return { exists: false, exact: false };
    const aliases = await queryRows<Row>(provider, `SELECT alias FROM public.ontology_aliases WHERE concept_id = ? ORDER BY normalized_alias`, [String(row.id)]);
    return { exists: true, exact: exactConcept(row, aliases, expected) };
  }));
  const edgeResults = await Promise.all(packageValue.edges.map(async (expected) => {
    const row = await queryOne<Row>(provider, `SELECT id, edge_key AS key, course_id, from_type, from_id, to_type, to_id, relation, confidence, evidence_json, status FROM public.ontology_edges WHERE edge_key = ? LIMIT 1`, [expected.key]);
    if (!row) return { exists: false, exact: false };
    return { exists: true, exact: exactEdge(row, expected) };
  }));
  const edgeKeys = packageValue.edges.map((edge) => edge.key);
  const conceptKeys = packageValue.concepts.map((concept) => concept.key);
  const extras = await queryRows<Row>(provider, `SELECT edge_key FROM public.ontology_edges WHERE from_id IN (${placeholders(conceptKeys.length)}) OR to_id IN (${placeholders(conceptKeys.length)})`, [...conceptKeys, ...conceptKeys]);
  const known = new Set(edgeKeys);
  return {
    conceptsFound: conceptResults.filter((item) => item.exists).length,
    edgesFound: edgeResults.filter((item) => item.exists).length,
    exactConcepts: conceptResults.filter((item) => item.exact).length,
    exactEdges: edgeResults.filter((item) => item.exact).length,
    extraEdges: extras.filter((row) => !known.has(String(row.edge_key))).length,
  };
}

function classifyState(state: Awaited<ReturnType<typeof readPackageState>>, evidencePreflight: "PASS" | "BLOCK" | "UNKNOWN"): CanonicalPreflightState {
  if (evidencePreflight === "UNKNOWN") return "PREFLIGHT_UNKNOWN";
  if (evidencePreflight === "BLOCK") return "EVIDENCE_BLOCKED";
  if (state.conceptsFound === 0 && state.edgesFound === 0) return "CLEAN";
  if (state.conceptsFound > state.exactConcepts) return "INCOMPATIBLE_CONCEPT";
  if (state.edgesFound > state.exactEdges || state.extraEdges > 0) return "INCOMPATIBLE_EDGE";
  if (state.conceptsFound === 3 && state.edgesFound === 4) return "EXACT_REPLAY";
  return "PARTIAL_PACKAGE";
}

async function readRuntimeVisibility(provider: DatabaseProvider, packageValue: SwCanonicalizationPackage) {
  const conceptKeys = packageValue.concepts.map((concept) => concept.key);
  const edgeKeys = packageValue.edges.map((edge) => edge.key);
  const concepts = await queryOne<{ count: number }>(provider, `SELECT count(*)::int AS count FROM public.ontology_concepts WHERE concept_key IN (${placeholders(conceptKeys.length)}) AND status = 'ACTIVE'`, conceptKeys);
  const edges = await queryOne<{ count: number }>(provider, `SELECT count(*)::int AS count FROM public.ontology_edges WHERE edge_key IN (${placeholders(edgeKeys.length)}) AND status = 'ACTIVE'`, edgeKeys);
  return { draftConceptsVisible: Number(concepts?.count ?? 0), draftEdgesVisible: Number(edges?.count ?? 0) };
}

function exactConcept(row: Row, aliases: Row[], expected: SwCanonicalizationConcept) {
  const metadata = parseObject(row.metadata_json);
  const expectedAliases = [...expected.aliases].sort();
  const storedAliases = aliases.map((alias) => String(alias.alias)).sort();
  const metadataAliases = Array.isArray(metadata.aliases) ? metadata.aliases.map(String).sort() : [];
  return String(row.id) === expected.key && String(row.key) === expected.key && String(row.label) === expected.label && String(row.normalized_label) === expected.normalizedLabel && String(row.namespace) === expected.namespace && String(row.category) === expected.category && String(row.description) === expected.description && String(row.status) === "DRAFT" && String(metadata.englishLabel) === expected.englishLabel && String(metadata.scope) === expected.scope && JSON.stringify(metadata.provenance) === JSON.stringify(expected.provenance) && JSON.stringify(metadataAliases) === JSON.stringify(expectedAliases) && JSON.stringify(storedAliases) === JSON.stringify(expectedAliases);
}

function exactEdge(row: Row, expected: SwCanonicalizationEdge) {
  return String(row.id) === expected.key && String(row.key) === expected.key && row.course_id == null && String(row.from_type) === expected.fromType && String(row.from_id) === expected.fromId && String(row.to_type) === expected.toType && String(row.to_id) === expected.toId && String(row.relation) === expected.relation && Number(row.confidence) === 10000 && String(row.status) === "DRAFT" && JSON.stringify(parseArray(row.evidence_json)) === JSON.stringify([...expected.evidence]);
}

function classifyRls(rows: Map<string, { enabled: boolean; force: boolean }>) {
  let rls = "PASS" as "PASS" | "DRIFT" | "UNKNOWN";
  let forceRls = "PASS" as "PASS" | "DRIFT" | "UNKNOWN";
  for (const [table, expected] of Object.entries(RLS_EXPECTATIONS)) {
    const actual = rows.get(table);
    if (!actual) { rls = "UNKNOWN"; forceRls = "UNKNOWN"; continue; }
    if (actual.enabled !== expected.enabled) rls = "DRIFT";
    if (actual.force !== expected.force) forceRls = "DRIFT";
  }
  return { rls, forceRls };
}

function aggregateCanonicalIdentity(input: {
  providerIdentity: boolean;
  migrationReady: boolean;
  schemaReady: boolean;
  rls: "PASS" | "DRIFT" | "UNKNOWN";
  forceRls: "PASS" | "DRIFT" | "UNKNOWN";
  trustedServer: "PASS" | "DENY" | "UNKNOWN";
}) {
  return input.providerIdentity
    && input.migrationReady
    && input.schemaReady
    && input.rls === "PASS"
    && input.forceRls === "PASS"
    && input.trustedServer === "PASS";
}

function baselineReceiptMatches(row: Row | null) {
  if (!row) return false;
  return String(row.baseline_id) === APPROVED_BASELINE_RECEIPT.baselineId
    && String(row.baseline_version) === APPROVED_BASELINE_RECEIPT.baselineVersion
    && String(row.schema_boundary) === APPROVED_BASELINE_RECEIPT.schemaBoundary
    && String(row.artifact_sha256) === APPROVED_BASELINE_RECEIPT.artifactSha256
    && String(row.schema_sha256) === APPROVED_BASELINE_RECEIPT.schemaSha256
    && String(row.security_sha256) === APPROVED_BASELINE_RECEIPT.securitySha256;
}

async function queryRows<T extends Row>(provider: DatabaseProvider, sql: string, parameters: readonly DatabaseValue[] = []) {
  return (await provider.query<T>({ sql, parameters })).rows;
}

async function queryOne<T extends Row>(provider: DatabaseProvider, sql: string, parameters: readonly DatabaseValue[] = []) {
  return (await provider.query<T>({ sql, parameters })).rows[0] ?? null;
}

function placeholders(count: number) {
  return Array.from({ length: count }, () => "?").join(", ");
}

function parseObject(value: unknown): Record<string, unknown> {
  try { return JSON.parse(String(value ?? "{}")) as Record<string, unknown>; } catch { return {}; }
}

function parseArray(value: unknown): unknown[] {
  try { return JSON.parse(String(value ?? "[]")) as unknown[]; } catch { return []; }
}
