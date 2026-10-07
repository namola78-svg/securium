import assert from "node:assert/strict";
import { test } from "node:test";
import { PRACTICAL_SERVER_AUTHORITY_REQUIRED } from "../lib/policy/practical-registration-authority.ts";
import {
  registerGovernedPracticalVersion,
  resolveCanonicalConcept,
} from "../lib/practical/practical-registration.ts";

const concepts = [
  { id: "oc-evidence", concept_key: "forensics.evidence", status: "ACTIVE" },
  { id: "oc-integrity", concept_key: "forensics.integrity", status: "DRAFT" },
];
const aliases = [
  { id: "oc-evidence", concept_key: "forensics.evidence", status: "ACTIVE" },
];

const governance = {
  version: 1,
  semanticHash: "a".repeat(64),
  humanReviewHash: "b".repeat(64),
  safetyReviewHash: "c".repeat(64),
  rightsBinding: "SECURIUM_ORIGINAL",
  provenanceBinding: "manifest:digital-forensics",
  theoryDependencyJson: "{}",
  currentnessReference: "current:2026-09-08",
  lifecycle: "DRAFT",
  createdBy: "system:content-governance",
  rubricVersionId: "rv-df-l01-v1",
  rubricId: "rubric:df:l01",
  rubricVersion: 1,
  evaluationSemanticHash: "d".repeat(64),
  evaluationMethod: "RULE_BASED",
  evidenceClassification: "ELIGIBLE_PERFORMANCE_EVIDENCE",
  rubricSnapshotJson: "{}",
  rubricSnapshotDigest: "e".repeat(64),
  reviewerMaterialId: "reviewer-material:df-l01-v1",
  reviewerMaterialJson: "{}",
  reviewerMaterialDigest: "f".repeat(64),
};

class FakeDatabase {
  constructor() {
    this.transactions = [];
    this.queries = [];
    this.executions = [];
    this.repositoryReads = 0;
    this.aliasRows = aliases;
  }

  async query(statement) {
    this.queries.push(statement);
    if (statement.sql.includes("FROM ontology_concepts") && statement.sql.includes("WHERE id")) {
      return { rows: concepts.filter((row) => row.id === statement.parameters[0]), rowCount: 1, metadata: { provider: "d1" } };
    }
    if (statement.sql.includes("FROM ontology_concepts") && statement.sql.includes("concept_key")) {
      return { rows: concepts.filter((row) => row.concept_key === statement.parameters[0]), rowCount: 1, metadata: { provider: "d1" } };
    }
    if (statement.sql.includes("FROM ontology_aliases")) {
      return { rows: this.aliasRows, rowCount: this.aliasRows.length, metadata: { provider: "d1" } };
    }
    return { rows: [], rowCount: 0, metadata: { provider: "d1" } };
  }

  async queryOne() {
    this.repositoryReads += 1;
    return null;
  }

  async transaction(statements) {
    this.transactions.push(statements);
    return statements.map(() => ({ affectedRows: 1, returnedRows: [], metadata: { provider: "d1" } }));
  }

  async execute(statement) {
    this.executions.push(statement);
    return { affectedRows: 1, returnedRows: [], metadata: { provider: "d1" } };
  }

  async healthCheck() {
    return true;
  }
}

function input(overrides = {}) {
  return {
    courseId: "course-digital-forensics-8h",
    memberIdentity: "DF-L01",
    memberType: "EXECUTABLE_LAB",
    namespace: "digital-forensics",
    intentKey: "df-l01",
    semanticKey: "practical.digital-forensics.df-l01",
    governance,
    conceptCandidates: [
      {
        reference: { conceptKey: "forensics.evidence" },
        mappingSource: "manifest:digital-forensics",
        qualification: { sourceMember: "DF-L01" },
      },
    ],
    ...overrides,
  };
}

test("canonical key and registered alias resolution are read-only", async () => {
  const db = new FakeDatabase();
  const byKey = await resolveCanonicalConcept(db, { conceptKey: "forensics.evidence" });
  assert.equal(byKey.id, "oc-evidence");
  assert.equal(byKey.matchedBy, "CANONICAL_KEY");
  const byAlias = await resolveCanonicalConcept(db, { registeredAlias: "evidence" });
  assert.equal(byAlias.matchedBy, "REGISTERED_ALIAS");
  const byId = await resolveCanonicalConcept(db, { conceptId: "oc-evidence", conceptKey: "forensics.evidence" });
  assert.equal(byId.matchedBy, "CANONICAL_ID");
  assert.equal(db.transactions.length, 0);
});

test("label-only and unknown concepts fail closed before practical writes", async () => {
  const db = new FakeDatabase();
  await assert.rejects(
    () => resolveCanonicalConcept(db, { label: "Evidence" }),
    /CANONICAL_CONCEPT_REFERENCE_REQUIRED/,
  );
  await assert.rejects(
    () => registerGovernedPracticalVersion(db, input({ conceptCandidates: [{ reference: { conceptKey: "missing" }, mappingSource: "manifest:digital-forensics" }] })),
    /CANONICAL_CONCEPT_NOT_FOUND/,
  );
  assert.equal(db.transactions.length, 0);
});

test("ambiguous registered aliases fail closed", async () => {
  const db = new FakeDatabase();
  db.aliasRows = [
    { id: "oc-evidence", concept_key: "forensics.evidence", status: "ACTIVE" },
    { id: "oc-integrity", concept_key: "forensics.integrity", status: "DRAFT" },
  ];
  await assert.rejects(
    () => resolveCanonicalConcept(db, { registeredAlias: "shared" }),
    /CANONICAL_CONCEPT_AMBIGUOUS/,
  );
  assert.equal(db.transactions.length, 0);
});

test("valid registration intent resolves Concepts but cannot persist without server authority", async () => {
  const db = new FakeDatabase();
  await assert.rejects(() => registerGovernedPracticalVersion(db, input()), {
    name: "AppError", code: PRACTICAL_SERVER_AUTHORITY_REQUIRED, status: 503,
  });
  assert.equal(db.queries.length, 1);
  assert.equal(db.repositoryReads, 0);
  assert.deepEqual(db.transactions, []);
  assert.deepEqual(db.executions, []);
});

const callerClaims = [
  ["review hashes", { governance: { ...governance, humanReviewHash: "1".repeat(64), safetyReviewHash: "2".repeat(64) } }],
  ["rights and provenance approvals", { governance: { ...governance, rightsBinding: "APPROVED:ORIGINAL", provenanceBinding: "APPROVED:CURRENT" } }],
  ["human-approved lifecycle", { governance: { ...governance, lifecycle: "HUMAN_APPROVED" } }],
  ["canonical-unpublished lifecycle", { governance: { ...governance, lifecycle: "CANONICAL_UNPUBLISHED" } }],
  ["approved mapping", { conceptCandidates: [{ reference: { conceptKey: "forensics.evidence" }, mappingSource: "caller:approved", mappingStatus: "APPROVED" }] }],
  ["mutation label", { mutation: "CANONICAL_CONTENT_REGISTRATION", mutationLabel: "APPROVED_PRACTICAL_WRITE" }],
  ["replay state", { outcome: "EXACT_REPLAY", replay: { accepted: true, authorityId: "caller-authority" } }],
  ["capability state", { capability: { authorized: true, revoked: false, token: "caller-token" } }],
  ["theory authority", { authority: { registrationPurpose: "COURSE_THEORY_DRAFT", lifecycle: "APPROVED_ACTIVE" }, authorization: { approved: true } }],
];

for (const [claim, overrides] of callerClaims) {
  test(`caller ${claim} cannot authorize practical registration`, async () => {
    const db = new FakeDatabase();
    const intent = JSON.parse(JSON.stringify(input(overrides)));
    for (let replay = 0; replay < 2; replay += 1) {
      await assert.rejects(() => registerGovernedPracticalVersion(db, intent), {
        name: "AppError", code: PRACTICAL_SERVER_AUTHORITY_REQUIRED, status: 503,
      });
    }
    assert.equal(db.repositoryReads, 0);
    assert.deepEqual(db.transactions, []);
    assert.deepEqual(db.executions, []);
  });
}

test("duplicate semantic Concept mappings fail before persistence", async () => {
  const db = new FakeDatabase();
  await assert.rejects(
    () => registerGovernedPracticalVersion(db, input({ conceptCandidates: [
      { reference: { conceptKey: "forensics.evidence" }, mappingSource: "manifest:digital-forensics" },
      { reference: { conceptId: "oc-evidence" }, mappingSource: "manifest:digital-forensics" },
    ] })),
    /DUPLICATE_CONCEPT_MAPPING/,
  );
  assert.equal(db.transactions.length, 0);
});
