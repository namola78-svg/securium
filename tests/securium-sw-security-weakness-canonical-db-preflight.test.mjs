import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildSwSecurityWeaknessConceptCanonicalizationPackage } from "../lib/services/securium-sw-security-weakness-concept-canonicalization.ts";
import { REQUIRED_CANONICAL_MIGRATIONS, runSwSecurityWeaknessCanonicalDatabasePreflight } from "../lib/services/securium-sw-security-weakness-canonical-db-preflight.ts";

const tables = ["app_schema_migrations", "ontology_concepts", "ontology_aliases", "ontology_edges", "admin_audit_logs", "evidence_projections", "evidence_recompute_requests"];
const columns = {
  app_schema_migrations: ["id"],
  ontology_concepts: ["id", "concept_key", "namespace", "label", "normalized_label", "category", "description", "status", "metadata_json"],
  ontology_aliases: ["id", "concept_id", "alias", "normalized_alias", "language", "source"],
  ontology_edges: ["id", "edge_key", "course_id", "from_type", "from_id", "to_type", "to_id", "relation", "confidence", "evidence_json", "status"],
  admin_audit_logs: ["id", "actor_user_id", "actor_role", "action", "resource_type", "resource_id", "result", "metadata_json"],
  evidence_projections: ["concept_id"],
  evidence_recompute_requests: ["concept_id"],
};

class FakeProvider {
  kind = "supabase";
  constructor(mode = "clean") { this.mode = mode; }
  async query(statement) {
    const sql = statement.sql.toLowerCase();
    const p = statement.parameters ?? [];
    const pkg = buildSwSecurityWeaknessConceptCanonicalizationPackage();
    if (sql.includes("version()")) return { rows: [{ version: this.mode === "identity-unknown" ? null : "PostgreSQL 17.6", database_name: "securium", schema_name: "public", search_path: "\"$user\", public" }], rowCount: 1, metadata: { provider: "supabase" } };
    if (sql.includes("information_schema.tables")) {
      const rows = this.mode === "schema-failure" ? tables.filter((table_name) => table_name !== "ontology_edges").map((table_name) => ({ table_name })) : tables.map((table_name) => ({ table_name }));
      return { rows, rowCount: rows.length, metadata: { provider: "supabase" } };
    }
    if (sql.includes("information_schema.columns")) return { rows: Object.entries(columns).flatMap(([table_name, names]) => names.map((column_name) => ({ table_name, column_name }))), rowCount: 40, metadata: { provider: "supabase" } };
    if (sql.includes("app_schema_migrations")) {
      if (this.mode === "migration-error") throw new Error("migration read failure");
      const rows = this.mode === "false-identity" || this.mode === "false-identity-exact" || this.mode === "migration-unknown" ? [] : REQUIRED_CANONICAL_MIGRATIONS.map((id) => ({ id }));
      return { rows, rowCount: rows.length, metadata: { provider: "supabase" } };
    }
    if (sql.includes("to_regclass")) return { rows: [{ relation: this.mode === "migration-unknown" ? null : "app_schema_baseline_receipts" }], rowCount: 1, metadata: { provider: "supabase" } };
    if (sql.includes("app_schema_baseline_receipts")) return { rows: [{ baseline_id: "POSTGRES_FRESH_BASELINE_V1", baseline_version: "1", schema_boundary: "0019", artifact_sha256: this.mode === "false-identity" || this.mode === "false-identity-exact" ? "wrong" : "2742f0b0b2c11b596d9c7336deb35489f14737e451f4956278f19611ff73f32a", schema_sha256: "05539edb00d8aad15f7ef86e43fc736f9f889df7fa0f470131207c5b73ee5ea2", security_sha256: "61ce56b51c7169cf7c98e4ec5cdcddc8720e06c292a93543de4ecb2f43eb8ba0" }], rowCount: 1, metadata: { provider: "supabase" } };
    if (sql.includes("pg_class")) return { rows: tables.map((table_name) => ({ table_name, rls_enabled: this.mode === "rls-drift" && table_name === "ontology_edges" ? false : true, force_rls: table_name.startsWith("evidence_") })), rowCount: tables.length, metadata: { provider: "supabase" } };
    if (sql.includes("has_table_privilege")) return { rows: [{ concept_select: this.mode !== "privilege-failure", edge_select: true, evidence_select: true, recompute_select: true }], rowCount: 1, metadata: { provider: "supabase" } };
    if (sql.includes("status = 'active'")) return { rows: [{ count: 0 }], rowCount: 1, metadata: { provider: "supabase" } };
    if (sql.includes("evidence_projections")) {
      const rows = this.mode === "evidence-block" ? [{ reference: "ontology:securium:code-injection" }] : [];
      return { rows, rowCount: rows.length, metadata: { provider: "supabase" } };
    }
    if (sql.includes("evidence_recompute_requests")) return { rows: [], rowCount: 0, metadata: { provider: "supabase" } };
    if (sql.includes("ontology_aliases")) {
      const key = String(p[0]);
      const concept = pkg.concepts.find((item) => item.key === key || item.key === this.conceptIdFor(key));
      const rows = concept ? concept.aliases.map((alias) => ({ alias })) : [];
      return { rows, rowCount: rows.length, metadata: { provider: "supabase" } };
    }
    if (sql.includes("ontology_edges")) {
      if (this.mode === "clean" || this.mode.startsWith("partial-concept")) return { rows: [], rowCount: 0, metadata: { provider: "supabase" } };
      if (sql.includes("from_id in")) return { rows: pkg.edges.map((edge) => ({ edge_key: edge.key })), rowCount: pkg.edges.length, metadata: { provider: "supabase" } };
      const key = String(p[0]);
      const edge = pkg.edges.find((item) => item.key === key);
      if (!edge || (this.mode === "partial-edge" && key === pkg.edges[0].key)) return { rows: [], rowCount: 0, metadata: { provider: "supabase" } };
      const bad = this.mode === "edge-conflict" && key === pkg.edges[0].key;
      return { rows: [{ id: edge.key, key: edge.key, course_id: null, from_type: edge.fromType, from_id: edge.fromId, to_type: edge.toType, to_id: edge.toId, relation: bad ? "RELATED_TO" : edge.relation, confidence: 10000, evidence_json: JSON.stringify(edge.evidence), status: "DRAFT" }], rowCount: 1, metadata: { provider: "supabase" } };
    }
    if (sql.includes("ontology_concepts")) {
      const key = String(p[0]);
      const concept = pkg.concepts.find((item) => item.key === key);
      const absent = this.mode === "clean"
        || (this.mode === "partial-concept" && key !== pkg.concepts[0].key)
        || (this.mode === "partial-concept-2" && ![pkg.concepts[0].key, pkg.concepts[1].key].includes(key));
      if (!concept || absent) return { rows: [], rowCount: 0, metadata: { provider: "supabase" } };
      const bad = this.mode === "concept-conflict" && key === pkg.concepts[0].key;
      return { rows: [{ id: concept.key, key: concept.key, label: bad ? "Conflicting label" : concept.label, normalized_label: concept.normalizedLabel, namespace: concept.namespace, category: concept.category, description: concept.description, status: "DRAFT", metadata_json: JSON.stringify({ englishLabel: concept.englishLabel, aliases: [...concept.aliases], scope: concept.scope, provenance: concept.provenance }) }], rowCount: 1, metadata: { provider: "supabase" } };
    }
    throw new Error(`UNEXPECTED_READ_QUERY:${statement.sql}`);
  }
  conceptIdFor(value) { return value; }
}

for (const [mode, expected] of [["clean", "CLEAN"], ["exact", "EXACT_REPLAY"], ["partial-concept", "PARTIAL_PACKAGE"], ["partial-concept-2", "PARTIAL_PACKAGE"], ["partial-edge", "PARTIAL_PACKAGE"], ["concept-conflict", "INCOMPATIBLE_CONCEPT"], ["edge-conflict", "INCOMPATIBLE_EDGE"], ["evidence-block", "EVIDENCE_BLOCKED"]]) {
  test(`canonical read-only preflight classifies ${mode}`, async () => {
    const result = await runSwSecurityWeaknessCanonicalDatabasePreflight(new FakeProvider(mode));
    assert.equal(result.productionStateClassification, expected);
    assert.equal(result.package.conceptCount, 3);
    assert.equal(result.package.edgeCount, 4);
    if (mode === "clean" || mode === "exact") assert.equal(result.canonicalIdentity, "CANONICAL_VERIFIED");
  });
}

test("non-Supabase providers fail closed without writes", async () => {
  const result = await runSwSecurityWeaknessCanonicalDatabasePreflight({ kind: "d1" });
  assert.equal(result.productionStateClassification, "PREFLIGHT_UNKNOWN");
  assert.equal(result.status, "UNKNOWN");
});
test("repository failure fails closed without exposing infrastructure details", async () => {
  const result = await runSwSecurityWeaknessCanonicalDatabasePreflight({
    kind: "supabase",
    async query() { throw new Error("secret database detail"); },
  });
  assert.equal(result.productionStateClassification, "PREFLIGHT_UNKNOWN");
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.blockerCode, "CANONICAL_PREFLIGHT_DATABASE_READ_FAILED");
});

test("unmatched baseline evidence fails closed as non-canonical", async () => {
  const result = await runSwSecurityWeaknessCanonicalDatabasePreflight(new FakeProvider("false-identity"));
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.canonicalIdentity, "CANONICAL_NOT_VERIFIED");
  assert.equal(result.blockerCode, "SCHEMA_NOT_READY");
});

test("RLS drift fails closed as non-canonical", async () => {
  const result = await runSwSecurityWeaknessCanonicalDatabasePreflight(new FakeProvider("rls-drift"));
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.canonicalIdentity, "CANONICAL_NOT_VERIFIED");
  assert.equal(result.blockerCode, "CANONICAL_SECURITY_PREFLIGHT_FAILED");
});

for (const mode of ["migration-unknown", "migration-error", "schema-failure", "privilege-failure", "identity-unknown"]) {
  test(`${mode} never verifies canonical identity`, async () => {
    const result = await runSwSecurityWeaknessCanonicalDatabasePreflight(new FakeProvider(mode));
    assert.notEqual(result.canonicalIdentity, "CANONICAL_VERIFIED");
    assert.equal(result.status, "UNKNOWN");
  });
}

test("exact package data cannot mask invalid database identity", async () => {
  const result = await runSwSecurityWeaknessCanonicalDatabasePreflight(new FakeProvider("false-identity-exact"));
  assert.notEqual(result.canonicalIdentity, "CANONICAL_VERIFIED");
  assert.equal(result.status, "UNKNOWN");
});

test("admin preflight route is authenticated, read-only, and non-cacheable", async () => {
  const source = await readFile("app/api/admin/ontology/canonicalization-preflight/route.ts", "utf8");
  assert.match(source, /requireOntologyAdministrator/);
  assert.match(source, /assertSameOrigin/);
  assert.match(source, /GET\(/);
  assert.match(source, /no-store/);
  assert.doesNotMatch(source, /executePostgresSwSecurityWeaknessDraftRegistration|\.execute\(|\.transaction\(/);
  assert.doesNotMatch(source, /process\.env|DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /postgres(?:ql)?:\/\//);
});
