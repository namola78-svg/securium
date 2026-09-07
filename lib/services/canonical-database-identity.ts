import type {
  DatabaseProvider,
} from "../../db/provider/database-provider.ts";

export type CanonicalPredicateState = "PASS" | "FAIL" | "UNKNOWN";

export type CanonicalDatabaseIdentity = Readonly<{
  state: "CANONICAL_VERIFIED" | "CANONICAL_NOT_VERIFIED";
  provider: CanonicalPredicateState;
  migrationBaseline: CanonicalPredicateState;
  schema: CanonicalPredicateState;
  genericReviewTables: CanonicalPredicateState;
  iseTables: CanonicalPredicateState;
  rls: CanonicalPredicateState;
  forceRls: CanonicalPredicateState;
  trustedPrivileges: CanonicalPredicateState;
  blockerCode?: string;
}>;

const REQUIRED_POST_BASELINE_MIGRATIONS = Object.freeze([
  "0020_concept_persistence_cp_a",
  "0021_cs1a_governance_receipts",
  "0022_cs1a_audit_identity",
  "0023_content_final_review_authority",
  "0024_content_review_judgment_infrastructure",
  "0025_content_reviewer_separation_policy",
  "0026_content_reviewer_separation_enforcement",
  "0028_generic_content_revision_registration_v1",
  "0029_generic_review_currentness_domain",
] as const);

const BASELINE_RECEIPT = Object.freeze({
  baselineId: "POSTGRES_FRESH_BASELINE_V1",
  baselineVersion: "1",
  schemaBoundary: "0019",
  artifactSha256: "2742f0b0b2c11b596d9c7336deb35489f14737e451f4956278f19611ff73f32a",
  schemaSha256: "05539edb00d8aad15f7ef86e43fc736f9f889df7fa0f470131207c5b73ee5ea2",
  securitySha256: "61ce56b51c7169cf7c98e4ec5cdcddc8720e06c292a93543de4ecb2f43eb8ba0",
  createdFromMainSha: "f1f364ec95343e03118ebb699f70773940b95411",
} as const);

const REQUIRED_COLUMNS = Object.freeze({
  app_schema_migrations: ["id", "checksum"],
  app_schema_baseline_receipts: ["baseline_id", "baseline_version", "schema_boundary", "artifact_sha256", "schema_sha256", "security_sha256", "created_from_main_sha"],
  admin_audit_logs: ["id", "actor_user_id", "actor_role", "action", "resource_type", "resource_id", "result", "metadata_json"],
  courses: ["id", "active", "deleted_at"],
  content_revisions: ["id", "content_id", "content_type", "version", "course_id", "revision_status", "semantic_hash", "snapshot_json"],
  source_identities: ["id", "canonical_key", "source_type", "normalized_identity", "lifecycle_state"],
  content_final_review_authorities: ["authority_id", "candidate_identity", "resource_type", "scope", "authority_state"],
  content_final_review_authority_subjects: ["authority_id", "subject_identity", "semantic_ordinal"],
  content_review_judgments: ["judgment_id", "review_domain", "reviewed_input_identity", "semantic_review_identity", "result", "lifecycle_state", "reviewer_user_id", "audit_log_id", "idempotency_key", "conflict_slot_identity"],
  content_review_judgment_subjects: ["judgment_id", "subject_identity", "resource_revision_id", "content_semantic_hash", "semantic_ordinal"],
  content_review_findings: ["finding_id", "judgment_id", "finding_semantic_identity", "category", "severity", "disposition", "material_facts_json"],
  content_review_owner_attestations: ["attestation_id", "resource_type", "resource_id", "reviewed_input_identity", "owner_user_id", "semantic_identity", "idempotency_key", "lifecycle_state", "audit_log_id"],
  content_review_policy_evaluations: ["evaluation_id", "judgment_id", "reviewed_input_identity", "reviewer_user_id", "required_reviewer_count", "evaluation_result", "resource_type", "resource_id", "audit_log_id"],
  content_revision_registrations: ["id", "registration_contract_version", "resource_type", "qualification_id", "package_key", "package_semantic_identity", "provenance_aggregate_identity", "registration_semantic_identity", "state", "created_by", "audit_log_id"],
  content_revision_registration_subjects: ["id", "registration_id", "content_revision_id", "semantic_revision_id", "content_hash", "provenance_identity", "source_lineage", "rights_state", "originality_state", "currentness_state", "responsible_owner_state"],
  content_revision_registration_sources: ["id", "registration_subject_id", "source_identity_id", "binding_role", "locator", "expression_reuse"],
} as const);

const REQUIRED_TABLES = Object.freeze(Object.keys(REQUIRED_COLUMNS));
const GENERIC_REVIEW_TABLES = Object.freeze([
  "content_final_review_authorities",
  "content_final_review_authority_subjects",
  "content_review_judgments",
  "content_review_judgment_subjects",
  "content_review_findings",
  "content_review_owner_attestations",
  "content_review_policy_evaluations",
] as const);
const ISE_TABLES = Object.freeze([
  "content_revision_registrations",
  "content_revision_registration_subjects",
  "content_revision_registration_sources",
] as const);
const RLS_EXPECTATIONS = Object.freeze({
  app_schema_migrations: { enabled: true, force: false },
  admin_audit_logs: { enabled: true, force: false },
  courses: { enabled: true, force: false },
  content_revisions: { enabled: true, force: false },
  source_identities: { enabled: true, force: true },
  content_final_review_authorities: { enabled: true, force: true },
  content_final_review_authority_subjects: { enabled: true, force: true },
  content_review_judgments: { enabled: true, force: true },
  content_review_judgment_subjects: { enabled: true, force: true },
  content_review_findings: { enabled: true, force: true },
  content_review_owner_attestations: { enabled: true, force: true },
  content_review_policy_evaluations: { enabled: true, force: true },
  content_revision_registrations: { enabled: true, force: true },
  content_revision_registration_subjects: { enabled: true, force: true },
  content_revision_registration_sources: { enabled: true, force: true },
} as const);
const READ_TABLES = Object.freeze([
  ...REQUIRED_TABLES,
] as const);
const WRITE_TABLES = Object.freeze([
  "admin_audit_logs",
  "content_review_judgments",
  "content_review_judgment_subjects",
  "content_review_findings",
  "content_review_owner_attestations",
  "content_review_policy_evaluations",
] as const);

type Row = Record<string, unknown>;

/**
 * Aggregates canonical DB predicates. Every mandatory predicate must be PASS;
 * missing, malformed, or errored evidence never becomes canonical.
 */
export async function readCanonicalDatabaseIdentity(
  database: DatabaseProvider,
): Promise<CanonicalDatabaseIdentity> {
  const base = (overrides: Partial<CanonicalDatabaseIdentity>): CanonicalDatabaseIdentity => ({
    state: "CANONICAL_NOT_VERIFIED",
    provider: database.kind === "supabase" ? "UNKNOWN" : "FAIL",
    migrationBaseline: "UNKNOWN",
    schema: "UNKNOWN",
    genericReviewTables: "UNKNOWN",
    iseTables: "UNKNOWN",
    rls: "UNKNOWN",
    forceRls: "UNKNOWN",
    trustedPrivileges: "UNKNOWN",
    ...overrides,
  });

  if (database.kind !== "supabase") {
    return base({ provider: "FAIL", blockerCode: "CANONICAL_DATABASE_PROVIDER_NOT_SUPABASE" });
  }

  try {
    const identity = await database.queryOne<{
      database_name: unknown;
      schema_name: unknown;
      search_path: unknown;
      database_user: unknown;
    }>({
      sql: "SELECT current_database() AS database_name, current_schema() AS schema_name, current_setting('search_path') AS search_path, current_user AS database_user",
    });
    const identityPass = Boolean(
      identity &&
      nonUnknown(identity.database_name) &&
      identity.schema_name === "public" &&
      nonUnknown(identity.search_path) &&
      nonUnknown(identity.database_user),
    );

    const migrations = new Set(
      (await database.query<Row>({
        sql: `SELECT id FROM public.app_schema_migrations WHERE id IN (${placeholders(REQUIRED_POST_BASELINE_MIGRATIONS.length)}) ORDER BY id`,
        parameters: [...REQUIRED_POST_BASELINE_MIGRATIONS],
      })).rows.map((row) => String(row.id)),
    );
    const receipt = await database.queryOne<Row>({
      sql: "SELECT baseline_id, baseline_version, schema_boundary, artifact_sha256, schema_sha256, security_sha256, created_from_main_sha FROM public.app_schema_baseline_receipts WHERE baseline_id = ? LIMIT 1",
      parameters: [BASELINE_RECEIPT.baselineId],
    });
    const migrationPass = baselineReceiptMatches(receipt) || REQUIRED_POST_BASELINE_MIGRATIONS.every((id) => migrations.has(id));

    const tableRows = (await database.query<{ table_name: string }>({
      sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (${placeholders(REQUIRED_TABLES.length)})`,
      parameters: REQUIRED_TABLES,
    })).rows;
    const presentTables = new Set(tableRows.map((row) => row.table_name));
    const columnRows = (await database.query<{ table_name: string; column_name: string }>({
      sql: `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN (${placeholders(REQUIRED_TABLES.length)})`,
      parameters: REQUIRED_TABLES,
    })).rows;
    const columns = new Map<string, Set<string>>();
    for (const row of columnRows) {
      columns.set(row.table_name, new Set([...(columns.get(row.table_name) ?? []), row.column_name]));
    }
    const schemaPass = REQUIRED_TABLES.every((table) =>
      presentTables.has(table) && REQUIRED_COLUMNS[table as keyof typeof REQUIRED_COLUMNS].every((column) => columns.get(table)?.has(column)),
    );

    const rlsRows = (await database.query<{ table_name: string; rls_enabled: unknown; force_rls: unknown }>({
      sql: `SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN (${placeholders(Object.keys(RLS_EXPECTATIONS).length)})`,
      parameters: Object.keys(RLS_EXPECTATIONS),
    })).rows;
    const rlsMap = new Map(rlsRows.map((row) => [row.table_name, { enabled: toBoolean(row.rls_enabled), force: toBoolean(row.force_rls) }]));
    const rlsPass = Object.entries(RLS_EXPECTATIONS).every(([table, expected]) => {
      const actual = rlsMap.get(table);
      return actual !== undefined && actual.enabled === expected.enabled;
    });
    const forceRlsPass = Object.entries(RLS_EXPECTATIONS).every(([table, expected]) => {
      const actual = rlsMap.get(table);
      return actual !== undefined && actual.force === expected.force;
    });

    const privilegeColumns = READ_TABLES.flatMap((table, index) => [
      `has_table_privilege(current_user, 'public.${table}', 'SELECT') AS server_select_${index}`,
      `has_table_privilege('anon', 'public.${table}', 'SELECT') AS anon_select_${index}`,
      `has_table_privilege('authenticated', 'public.${table}', 'SELECT') AS authenticated_select_${index}`,
      `has_table_privilege('anon', 'public.${table}', 'INSERT') AS anon_insert_${index}`,
      `has_table_privilege('authenticated', 'public.${table}', 'INSERT') AS authenticated_insert_${index}`,
      `has_table_privilege('anon', 'public.${table}', 'UPDATE') AS anon_update_${index}`,
      `has_table_privilege('authenticated', 'public.${table}', 'UPDATE') AS authenticated_update_${index}`,
      `has_table_privilege('anon', 'public.${table}', 'DELETE') AS anon_delete_${index}`,
      `has_table_privilege('authenticated', 'public.${table}', 'DELETE') AS authenticated_delete_${index}`,
      ...(WRITE_TABLES.includes(table as (typeof WRITE_TABLES)[number])
        ? [`has_table_privilege(current_user, 'public.${table}', 'INSERT') AS server_insert_${index}`]
        : []),
    ]).join(", ");
    const privilege = await database.queryOne<Row>({ sql: `SELECT ${privilegeColumns}` });
    const trustedPrivileges = privilege && READ_TABLES.every((table, index) =>
      privilege[serverAlias("server_select", index)] === true &&
      privilege[serverAlias("anon_select", index)] === false &&
      privilege[serverAlias("authenticated_select", index)] === false &&
      privilege[serverAlias("anon_insert", index)] === false &&
      privilege[serverAlias("authenticated_insert", index)] === false &&
      privilege[serverAlias("anon_update", index)] === false &&
      privilege[serverAlias("authenticated_update", index)] === false &&
      privilege[serverAlias("anon_delete", index)] === false &&
      privilege[serverAlias("authenticated_delete", index)] === false &&
      (!WRITE_TABLES.includes(table as (typeof WRITE_TABLES)[number]) || privilege[serverAlias("server_insert", index)] === true),
    ) ? "PASS" : "FAIL";

    const provider = identityPass ? "PASS" : "FAIL";
    const migrationBaseline = migrationPass ? "PASS" : "FAIL";
    const schema = schemaPass ? "PASS" : "FAIL";
    const genericReviewTables = GENERIC_REVIEW_TABLES.every((table) => presentTables.has(table)) ? "PASS" : "FAIL";
    const iseTables = ISE_TABLES.every((table) => presentTables.has(table)) ? "PASS" : "FAIL";
    const verified = aggregateCanonicalIdentity({ provider, migrationBaseline, schema, genericReviewTables, iseTables, rls: rlsPass ? "PASS" : "FAIL", forceRls: forceRlsPass ? "PASS" : "FAIL", trustedPrivileges });
    return verified ? {
      state: "CANONICAL_VERIFIED",
      provider, migrationBaseline, schema, genericReviewTables, iseTables,
      rls: rlsPass ? "PASS" : "FAIL",
      forceRls: forceRlsPass ? "PASS" : "FAIL",
      trustedPrivileges,
    } : base({ provider, migrationBaseline, schema, genericReviewTables, iseTables, rls: rlsPass ? "PASS" : "FAIL", forceRls: forceRlsPass ? "PASS" : "FAIL", trustedPrivileges, blockerCode: "CANONICAL_SECURITY_PREFLIGHT_FAILED" });
  } catch {
    return base({ blockerCode: "CANONICAL_PREFLIGHT_DATABASE_READ_FAILED" });
  }
}

export function aggregateCanonicalIdentity(input: {
  provider: CanonicalPredicateState;
  migrationBaseline: CanonicalPredicateState;
  schema: CanonicalPredicateState;
  genericReviewTables: CanonicalPredicateState;
  iseTables: CanonicalPredicateState;
  rls: CanonicalPredicateState;
  forceRls: CanonicalPredicateState;
  trustedPrivileges: CanonicalPredicateState;
}): boolean {
  return Object.values(input).every((state) => state === "PASS");
}

function baselineReceiptMatches(row: Row | null): boolean {
  return Boolean(row) &&
    String(row?.baseline_id) === BASELINE_RECEIPT.baselineId &&
    String(row?.baseline_version) === BASELINE_RECEIPT.baselineVersion &&
    String(row?.schema_boundary) === BASELINE_RECEIPT.schemaBoundary &&
    String(row?.artifact_sha256) === BASELINE_RECEIPT.artifactSha256 &&
    String(row?.schema_sha256) === BASELINE_RECEIPT.schemaSha256 &&
    String(row?.security_sha256) === BASELINE_RECEIPT.securitySha256 &&
    String(row?.created_from_main_sha) === BASELINE_RECEIPT.createdFromMainSha;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function nonUnknown(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 && value !== "UNKNOWN";
}

function toBoolean(value: unknown): boolean | null {
  if (value === true || value === 1 || value === "1" || value === "t") return true;
  if (value === false || value === 0 || value === "0" || value === "f") return false;
  return null;
}

function serverAlias(prefix: string, index: number): string {
  return `${prefix}_${index}`;
}
