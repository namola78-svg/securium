import assert from "node:assert/strict";
import test from "node:test";
import type {
  DatabaseExecutionResult,
  DatabaseProvider,
  DatabaseQueryResult,
  DatabaseStatement,
} from "../db/provider/database-provider.ts";
import {
  buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories,
} from "../lib/services/ise-wave-a-canonical-repository-adapter.ts";

type Row = Record<string, unknown>;

const sourceRow = {
  id: "source-cq-ise-01",
  canonical_key: "cq-ise-scope",
  source_type: "OFFICIAL_SCOPE_REFERENCE",
  normalized_identity: "https://www.cq.or.kr/qh_quagm01_020.do",
  lifecycle_state: "ACTIVE",
};

class FakeCanonicalProvider implements DatabaseProvider {
  readonly kind = "supabase" as const;
  private readonly options: {
    courseRows?: Row[];
    sourceRows?: Row[];
    failCourse?: boolean;
    failSource?: boolean;
  };

  constructor(
    options: {
      courseRows?: Row[];
      sourceRows?: Row[];
      failCourse?: boolean;
      failSource?: boolean;
    } = {},
  ) {
    this.options = options;
  }

  async query<T extends Row>(statement: DatabaseStatement): Promise<DatabaseQueryResult<T>> {
    if (statement.sql.includes("FROM courses")) {
      if (this.options.failCourse) throw new Error("COURSE_REPOSITORY_OUTAGE");
      return { rows: (this.options.courseRows ?? [{ id: "course-ise", active: true, deleted_at: null }]) as T[], rowCount: (this.options.courseRows ?? []).length, metadata: { provider: this.kind } };
    }
    if (statement.sql.includes("FROM source_identities")) {
      if (this.options.failSource) throw new Error("SOURCE_REPOSITORY_OUTAGE");
      return { rows: (this.options.sourceRows ?? [sourceRow]) as T[], rowCount: (this.options.sourceRows ?? []).length, metadata: { provider: this.kind } };
    }
    throw new Error("UNEXPECTED_QUERY");
  }

  async queryOne<T extends Row>(statement: DatabaseStatement): Promise<T | null> {
    void statement;
    return null;
  }
  async execute(statement: DatabaseStatement): Promise<DatabaseExecutionResult> {
    void statement;
    throw new Error("WRITE_NOT_ALLOWED");
  }
  async transaction(statements: readonly DatabaseStatement[]): Promise<DatabaseExecutionResult[]> {
    void statements;
    throw new Error("WRITE_NOT_ALLOWED");
  }
  async healthCheck(): Promise<boolean> { return true; }
}

test("canonical repository orchestration requires both canonical reads", async () => {
  const state = await buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(new FakeCanonicalProvider());
  assert.equal(state.qualification, "course-ise");
  assert.equal(state.revisions.length, 2);
  assert.equal(state.readiness, "CANONICAL_REVISION_PROVENANCE_READY_FOR_REVIEW");
  assert.equal(state.revisions[0].provenance.rightsState, "REVIEW_REQUIRED");
  assert.equal(state.revisions[0].provenance.currentnessState, "REVIEW_REQUIRED");
});

test("missing or wrong canonical course fails closed", async () => {
  await assert.rejects(
    () => buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(new FakeCanonicalProvider({ courseRows: [] })),
    /ISE_WAVE_A_QUALIFICATION_UNRESOLVED/,
  );
  await assert.rejects(
    () => buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(new FakeCanonicalProvider({ courseRows: [{ id: "course-other", active: true, deleted_at: null }] })),
    /ISE_WAVE_A_QUALIFICATION_UNRESOLVED/,
  );
});

test("course repository outage fails closed and source cannot substitute it", async () => {
  await assert.rejects(
    () => buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(new FakeCanonicalProvider({ failCourse: true })),
    /COURSE_REPOSITORY_OUTAGE/,
  );
  await assert.rejects(
    () => buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(new FakeCanonicalProvider({ sourceRows: [] })),
    /ISE_WAVE_A_REQUIRED_CANONICAL_SOURCE_UNRESOLVED/,
  );
});

test("ambiguous or substituted canonical source fails closed", async () => {
  await assert.rejects(
    () => buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(new FakeCanonicalProvider({ sourceRows: [sourceRow, sourceRow] })),
    /ISE_WAVE_A_REQUIRED_CANONICAL_SOURCE_UNRESOLVED/,
  );
  await assert.rejects(
    () => buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(new FakeCanonicalProvider({ sourceRows: [{ ...sourceRow, normalized_identity: "https://unexpected.example/source" }] })),
    /ISE_WAVE_A_CANONICAL_SOURCE_SUBSTITUTION/,
  );
});

test("metadata-only source cannot satisfy the canonical orchestration", async () => {
  const provider = new FakeCanonicalProvider({ sourceRows: [] });
  await assert.rejects(
    () => buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(provider),
    /ISE_WAVE_A_REQUIRED_CANONICAL_SOURCE_UNRESOLVED/,
  );
});
