import assert from "node:assert/strict";
import test from "node:test";
import { aggregateCanonicalIdentity, readCanonicalDatabaseIdentity } from "../lib/services/canonical-database-identity.ts";

const columns: Record<string, string[]> = {
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
};

const tables = Object.keys(columns);
const postBaselineMigrations = [
  "0020_concept_persistence_cp_a",
  "0021_cs1a_governance_receipts",
  "0022_cs1a_audit_identity",
  "0023_content_final_review_authority",
  "0024_content_review_judgment_infrastructure",
  "0025_content_reviewer_separation_policy",
  "0026_content_reviewer_separation_enforcement",
  "0028_generic_content_revision_registration_v1",
  "0029_generic_review_currentness_domain",
];

class IdentityFixture {
  readonly kind = "supabase" as const;
  private readonly mode: string;
  constructor(mode = "valid") { this.mode = mode; }
  async healthCheck() { return true; }
  async query<T extends Record<string, unknown>>(statement: { sql: string; parameters?: readonly unknown[] }) {
    const sql = statement.sql.toLowerCase();
    if (sql.includes("app_schema_migrations")) return { rows: (this.mode === "migration-failure" || this.mode === "baseline-only" || this.mode === "wrong-baseline-partial" ? [] : postBaselineMigrations).map((id) => ({ id })) as unknown as T[], rowCount: 0, metadata: { provider: "supabase" as const } };
    if (sql.includes("information_schema.tables")) {
      const names = this.mode === "schema-failure" ? tables.filter((name) => name !== "content_review_judgments") : tables;
      return { rows: names.map((table_name) => ({ table_name })) as unknown as T[], rowCount: names.length, metadata: { provider: "supabase" as const } };
    }
    if (sql.includes("information_schema.columns")) {
      const rows = Object.entries(columns).flatMap(([table_name, names]) => names.map((column_name) => ({ table_name, column_name })));
      return { rows: (this.mode === "schema-failure" ? rows.filter((row) => row.column_name !== "registration_semantic_identity") : rows) as unknown as T[], rowCount: rows.length, metadata: { provider: "supabase" as const } };
    }
    if (sql.includes("pg_class")) {
      const rows = tables.filter((table) => table !== "app_schema_baseline_receipts").map((table_name) => ({
        table_name,
        rls_enabled: this.mode !== "rls-drift" || table_name !== "content_review_judgments",
        force_rls: this.mode !== "force-rls-drift" || table_name !== "content_review_judgments" ? !["app_schema_migrations", "admin_audit_logs", "courses", "content_revisions"].includes(table_name) : false,
      }));
      return { rows: rows as unknown as T[], rowCount: rows.length, metadata: { provider: "supabase" as const } };
    }
    if (sql.includes("has_table_privilege")) {
      const aliases = [...sql.matchAll(/as ([a-z_]+_\d+)/g)].map((match) => match[1]);
      const row = Object.fromEntries(aliases.map((alias) => [alias, this.mode !== "privilege-failure" && !alias.startsWith("anon_") && !alias.startsWith("authenticated_")])) as T;
      return { rows: [row], rowCount: 1, metadata: { provider: "supabase" as const } };
    }
    return { rows: [] as T[], rowCount: 0, metadata: { provider: "supabase" as const } };
  }
  async queryOne<T extends Record<string, unknown>>(statement: { sql: string }) {
    const sql = statement.sql.toLowerCase();
    if (sql.includes("current_database")) return { database_name: this.mode === "identity-failure" ? null : "securium", schema_name: "public", search_path: '"$user", public', database_user: "governance_runtime" } as unknown as T;
    if (sql.includes("from public.app_schema_baseline_receipts")) return this.mode === "wrong-baseline" || this.mode === "wrong-baseline-partial" ? { baseline_id: "POSTGRES_FRESH_BASELINE_V1", baseline_version: "1", schema_boundary: "0019", artifact_sha256: "wrong", schema_sha256: "wrong", security_sha256: "wrong", created_from_main_sha: "wrong" } as unknown as T : this.mode === "migration-failure" ? null : { baseline_id: "POSTGRES_FRESH_BASELINE_V1", baseline_version: "1", schema_boundary: "0019", artifact_sha256: "2742f0b0b2c11b596d9c7336deb35489f14737e451f4956278f19611ff73f32a", schema_sha256: "05539edb00d8aad15f7ef86e43fc736f9f889df7fa0f470131207c5b73ee5ea2", security_sha256: "61ce56b51c7169cf7c98e4ec5cdcddc8720e06c292a93543de4ecb2f43eb8ba0", created_from_main_sha: "f1f364ec95343e03118ebb699f70773940b95411" } as unknown as T;
    if (sql.includes("has_table_privilege")) {
      const aliases = [...sql.matchAll(/as ([a-z_]+_\d+)/g)].map((match) => match[1]);
      return Object.fromEntries(aliases.map((alias) => [alias, this.mode !== "privilege-failure" && !alias.startsWith("anon_") && !alias.startsWith("authenticated_")])) as T;
    }
    return null;
  }
  async execute() { return { affectedRows: 0, returnedRows: [], metadata: { provider: "supabase" as const } }; }
  async transaction() { return []; }
}

test("all canonical identity predicates must pass", async () => {
  const result = await readCanonicalDatabaseIdentity(new IdentityFixture());
  assert.equal(result.state, "CANONICAL_VERIFIED");
  assert.equal(aggregateCanonicalIdentity({ provider: "PASS", migrationBaseline: "PASS", schema: "PASS", genericReviewTables: "PASS", iseTables: "PASS", rls: "PASS", forceRls: "PASS", trustedPrivileges: "PASS" }), true);
});

test("approved fresh-baseline receipt can satisfy migration identity", async () => {
  const result = await readCanonicalDatabaseIdentity(new IdentityFixture("baseline-only"));
  assert.equal(result.state, "CANONICAL_VERIFIED");
});

test("complete approved migration chain can satisfy migration identity", async () => {
  const result = await readCanonicalDatabaseIdentity(new IdentityFixture("wrong-baseline"));
  assert.equal(result.state, "CANONICAL_VERIFIED");
});

for (const mode of ["wrong-baseline-partial", "identity-failure", "migration-failure", "schema-failure", "rls-drift", "force-rls-drift", "privilege-failure"]) {
  test(`${mode} never verifies canonical identity`, async () => {
    const result = await readCanonicalDatabaseIdentity(new IdentityFixture(mode));
    assert.equal(result.state, "CANONICAL_NOT_VERIFIED");
  });
}

test("non-Supabase provider fails closed", async () => {
  const result = await readCanonicalDatabaseIdentity({ kind: "d1" } as never);
  assert.equal(result.state, "CANONICAL_NOT_VERIFIED");
});

test("database read error is UNKNOWN and never verified", async () => {
  const result = await readCanonicalDatabaseIdentity({ kind: "supabase", async query() { throw new Error("FAKE_DATABASE_SECRET_MARKER"); } } as never);
  assert.equal(result.state, "CANONICAL_NOT_VERIFIED");
  assert.equal(result.blockerCode, "CANONICAL_PREFLIGHT_DATABASE_READ_FAILED");
});
