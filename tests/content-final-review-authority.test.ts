import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTENT_FINAL_REVIEW_AUTHORITY_V1,
  CONTENT_FINAL_REVIEW_DECISION,
  computeContentFinalReviewDecisionIdentity,
  normalizeContentFinalReviewDecision,
  validateContentFinalReviewDecision,
} from "../lib/policy/content-final-review-authority.ts";

const candidateA = "a".repeat(64);
const candidateB = "b".repeat(64);
const subjects8 = Array.from({ length: 8 }, (_, semanticOrdinal) => ({ subjectIdentity: `A-${semanticOrdinal + 1}`, semanticOrdinal }));
const subjects5 = Array.from({ length: 5 }, (_, semanticOrdinal) => ({ subjectIdentity: `B-${semanticOrdinal + 1}`, semanticOrdinal }));

function decision(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: CONTENT_FINAL_REVIEW_AUTHORITY_V1,
    decisionType: CONTENT_FINAL_REVIEW_DECISION,
    candidateIdentity: candidateA,
    resourceType: "CONTENT_REVISION",
    scope: "PACKAGE_A_V1",
    subjects: subjects8,
    decisionOutcome: "APPROVED",
    publicationAuthority: "NOT_GRANTED",
    ...overrides,
  };
}

test("normalizes the V1 decision and supports variable subject counts", () => {
  const normalized = normalizeContentFinalReviewDecision(decision());
  assert.equal(normalized.contractVersion, CONTENT_FINAL_REVIEW_AUTHORITY_V1);
  assert.equal(normalized.decisionType, CONTENT_FINAL_REVIEW_DECISION);
  assert.equal(normalized.subjects.length, 8);
  assert.equal(normalizeContentFinalReviewDecision(decision({ subjects: subjects5, scope: "PACKAGE_B_V1" })).subjects.length, 5);
  assert.equal(validateContentFinalReviewDecision(normalized).valid, true);
});

test("canonicalizes subject collection order while preserving semantic ordinals", () => {
  const reordered = [...subjects8].reverse();
  const first = normalizeContentFinalReviewDecision(decision({ subjects: subjects8 }));
  const second = normalizeContentFinalReviewDecision(decision({ subjects: reordered }));
  assert.deepEqual(first.subjects, second.subjects);
  assert.equal(computeContentFinalReviewDecisionIdentity(first), computeContentFinalReviewDecisionIdentity(second));
});

test("decision identity is deterministic and binds every semantic field", () => {
  const base = computeContentFinalReviewDecisionIdentity(decision());
  assert.equal(base, computeContentFinalReviewDecisionIdentity(decision()));
  for (const change of [
    { candidateIdentity: candidateB },
    { resourceType: "OTHER_RESOURCE" },
    { scope: "PACKAGE_B_V1" },
    { subjects: subjects8.slice(0, 7) },
    { decisionOutcome: "REJECTED" },
  ]) assert.notEqual(computeContentFinalReviewDecisionIdentity(decision(change)), base);
});

test("actor, timestamp, path, and machine metadata are excluded from identity", () => {
  const base = computeContentFinalReviewDecisionIdentity(decision());
  const withMetadata = computeContentFinalReviewDecisionIdentity(decision({ actor: "reviewer-1", timestamp: "2030-01-01", absolutePath: "C:\\other", machine: "host-2", gitSha: "deadbeef" }));
  assert.equal(withMetadata, base);
});

test("publication escalation, unknown values, and malformed identities fail closed", () => {
  for (const invalid of [
    { publicationAuthority: "GRANTED" },
    { contractVersion: "CONTENT_FINAL_REVIEW_AUTHORITY_V2" },
    { decisionType: "OTHER_DECISION" },
    { decisionOutcome: "PENDING" },
    { candidateIdentity: "not-a-hash" },
    { resourceType: "" },
    { scope: " PACKAGE_A_V1" },
  ]) {
    assert.equal(validateContentFinalReviewDecision(decision(invalid)).valid, false);
    assert.throws(() => computeContentFinalReviewDecisionIdentity(decision(invalid)));
  }
});

test("empty, duplicate, and malformed subjects fail closed", () => {
  for (const subjects of [[], [{ subjectIdentity: "A-1", semanticOrdinal: 0 }, { subjectIdentity: "A-1", semanticOrdinal: 1 }], [{ subjectIdentity: "A-1", semanticOrdinal: 0 }, { subjectIdentity: "A-2", semanticOrdinal: 0 }], [{ subjectIdentity: "", semanticOrdinal: 0 }], [{ subjectIdentity: "A-1", semanticOrdinal: -1 }]]) {
    assert.equal(validateContentFinalReviewDecision(decision({ subjects })).valid, false);
  }
});

test("a valid semantic decision and its hash do not establish authority", () => {
  const normalized = normalizeContentFinalReviewDecision(decision());
  const identity = computeContentFinalReviewDecisionIdentity(normalized);
  assert.equal(validateContentFinalReviewDecision(normalized).valid, true);
  assert.equal(typeof identity, "string");
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "authorityState"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "authorized"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "persisted"), false);
});
