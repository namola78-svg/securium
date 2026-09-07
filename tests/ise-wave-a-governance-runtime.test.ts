import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  assertIseWaveAGovernanceActor,
  assertCanonicalPostgresRuntime,
  isApprovedIseWaveADomain,
  isIseWaveAGovernanceRole,
} from "../lib/services/ise-wave-a-governance-runtime.ts";

class RuntimeProbeDatabase {
  readonly kind = "supabase" as const;
  private readonly options: {
    healthy?: boolean;
    migrations?: string[];
    schema?: boolean;
  };

  constructor(options: { healthy?: boolean; migrations?: string[]; schema?: boolean } = {}) {
    this.options = options;
  }

  async healthCheck() {
    return this.options.healthy ?? true;
  }

  async query<Row extends Record<string, unknown>>(statement: { sql: string }) {
    if (statement.sql.includes("app_schema_migrations")) {
      return {
        rows: (this.options.migrations ?? [
          "0023_content_final_review_authority",
          "0024_content_review_judgment_infrastructure",
          "0025_content_reviewer_separation_policy",
          "0026_content_reviewer_separation_enforcement",
          "0028_generic_content_revision_registration_v1",
          "0029_generic_review_currentness_domain",
        ]).map((id) => ({ id })) as unknown as Row[],
        rowCount: 0,
        metadata: { provider: "supabase" as const },
      };
    }
    return { rows: [] as Row[], rowCount: 0, metadata: { provider: "supabase" as const } };
  }

  async queryOne<Row extends Record<string, unknown>>(statement: { sql: string }) {
    if (statement.sql.includes("to_regclass")) {
      const value = this.options.schema === false ? null : "present";
      return {
        registration_table: value,
        registration_subject_table: value,
        review_owner_table: value,
        review_judgment_table: value,
        review_policy_table: value,
        revision_table: value,
        source_table: value,
      } as unknown as Row;
    }
    return null;
  }

  async execute() { return { affectedRows: 0, returnedRows: [], metadata: { provider: "supabase" as const } }; }
  async transaction() { return []; }
}

test("ISE governance actor eligibility is server-role based", () => {
  assert.equal(isIseWaveAGovernanceRole("CONTENT_REVIEWER"), true);
  assert.equal(isIseWaveAGovernanceRole("ADMIN"), true);
  assert.equal(isIseWaveAGovernanceRole("SUPER_ADMIN"), true);
  assert.equal(isIseWaveAGovernanceRole("USER"), false);
  assert.doesNotThrow(() =>
    assertIseWaveAGovernanceActor({ roles: ["CONTENT_REVIEWER"] }),
  );
  assert.throws(
    () => assertIseWaveAGovernanceActor({ roles: ["USER"] }),
    (error: unknown) =>
      (error as { code?: string }).code === "ISE_GOVERNANCE_ROLE_REQUIRED",
  );
});

test("ISE governance domain allowlist is exactly the five approved domains", () => {
  for (const domain of [
    "TECHNICAL",
    "SAFETY_SECURITY_CONTENT",
    "COPYRIGHT_RIGHTS",
    "CURRENTNESS",
    "SUPPORT_QUALIFICATION",
  ]) {
    assert.equal(isApprovedIseWaveADomain(domain), true);
  }
  assert.equal(isApprovedIseWaveADomain("AUTHORITY"), false);
  assert.equal(isApprovedIseWaveADomain("SECURE_CODING"), false);
});

test("canonical runtime probe rejects incomplete legacy probes and wrong providers", async () => {
  await assert.rejects(
    () => assertCanonicalPostgresRuntime(new RuntimeProbeDatabase()),
    (error: unknown) => (error as { code?: string }).code === "CANONICAL_SECURITY_PREFLIGHT_FAILED",
  );
  await assert.rejects(
    () => assertCanonicalPostgresRuntime(new RuntimeProbeDatabase({ healthy: false })),
    (error: unknown) =>
      (error as { code?: string }).code === "ISE_CANONICAL_RUNTIME_UNAVAILABLE",
  );
  await assert.rejects(
    () => assertCanonicalPostgresRuntime(new RuntimeProbeDatabase({ migrations: [] })),
    (error: unknown) => (error as { code?: string }).code === "CANONICAL_SECURITY_PREFLIGHT_FAILED",
  );
  await assert.rejects(
    () => assertCanonicalPostgresRuntime(new RuntimeProbeDatabase({ schema: false })),
    (error: unknown) => (error as { code?: string }).code === "CANONICAL_SECURITY_PREFLIGHT_FAILED",
  );
  await assert.rejects(
    () => assertCanonicalPostgresRuntime({ kind: "d1", healthCheck: async () => true } as never),
    (error: unknown) =>
      (error as { code?: string }).code === "ISE_CANONICAL_POSTGRES_REQUIRED",
  );
});

test("runtime route has no authority, ACTIVE, publication, arbitrary-resource, or caller-identity inputs", () => {
  const route = fs.readFileSync(
    path.join(process.cwd(), "app/api/admin/ise-wave-a/governance/route.ts"),
    "utf8",
  );
  const routeService = fs.readFileSync(
    path.join(process.cwd(), "lib/services/ise-wave-a-governance-route.ts"),
    "utf8",
  );
  assert.match(route, /requireApiUser/);
  assert.match(routeService, /assertSameOrigin/);
  assert.match(route, /getDatabaseProvider/);
  assert.match(routeService, /owner-attest/);
  assert.match(routeService, /review-domain/);
  assert.doesNotMatch(route, /authority-establish|transition-active|publish/);
  assert.doesNotMatch(route, /resourceType\s*:\s*z/);
  assert.doesNotMatch(route, /resourceId\s*:\s*z/);
  assert.doesNotMatch(route, /reviewerId\s*:\s*z/);
  assert.doesNotMatch(route, /ownerId\s*:\s*z/);
});
