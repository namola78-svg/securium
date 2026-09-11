import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSecureCoding8HQuestionRuntimeMapping,
} from "../lib/services/secure-coding-8h-question-runtime-mapping.ts";
import {
  preflightSecureCoding8HQuestionMaterialization,
} from "../lib/services/secure-coding-8h-question-materialization-contract.ts";

const COURSE_ID = "developer-secure-coding-8h-python-vibe";
const CANDIDATE_ID =
  "securium-developer-secure-coding-8h-python-vibe-foundation-v1";

function clone(value) {
  return structuredClone(value);
}

async function expectCode(operation, code) {
  await assert.rejects(operation, (error) => error?.code === code, code);
}

test("validates the canonical projection and keeps unresolved authority blocked", async () => {
  const result = await preflightSecureCoding8HQuestionMaterialization();

  assert.equal(result.projectionStatus, "VERIFIED");
  assert.equal(result.foundationStatus, "VERIFIED");
  assert.equal(result.sourceRevisionStatus, "VERIFIED");
  assert.equal(result.sourceBindingStatus, "UNKNOWN");
  assert.equal(result.approvalStatus, "UNKNOWN");
  assert.equal(result.preflightStatus, "BLOCKED");
  assert.equal(result.persistenceStatus, "NOT_READY");
  assert.equal(result.runtimeMutation, "NOT_EXECUTED");
  assert.deepEqual(result.blockers, [
    "SOURCE_BINDING_AUTHORITY_UNAVAILABLE",
    "APPROVAL_AUTHORITY_UNAVAILABLE",
  ]);
  assert.deepEqual(result.counts, {
    questions: 40,
    choices: 160,
    versions: 40,
    courseBindings: 40,
  });
  assert.equal(result.approvalTarget.action, "MATERIALIZE_QUESTION_DEFINITIONS");
  assert.equal(result.approvalTarget.courseId, COURSE_ID);
  assert.equal(result.approvalTarget.candidateId, CANDIDATE_ID);
  assert.equal(result.approvalTarget.foundationVersion, "v1");
  assert.equal(result.approvalTarget.payloadHash, result.payload.canonicalHash);
  assert.equal(result.questionRows.length, 40);
  assert.equal(result.choiceRows.length, 160);
  assert.equal(result.versionRows.length, 40);
  assert.equal(result.courseBindingRows.length, 40);
  assert.deepEqual(result.questionRows.map((row) => row.id), [
    ...Array.from({ length: 40 }, (_, index) =>
      `question-${COURSE_ID}-Q${String(index + 1).padStart(2, "0")}`,
    ),
  ]);
  assert.equal(result.choiceRows.every((row) => row.questionId.startsWith(`question-${COURSE_ID}-`)), true);
  assert.equal(result.versionRows.every((row) => row.version === 1), true);
  assert.equal(result.courseBindingRows.every((row) => row.weight === 100), true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal("approvalEvidence" in result, false);
});

test("canonical input is deterministic and a valid submitted hash is not approval", async () => {
  const first = await preflightSecureCoding8HQuestionMaterialization();
  const second = await preflightSecureCoding8HQuestionMaterialization();
  assert.deepEqual(first, second);

  const mapping = await buildSecureCoding8HQuestionRuntimeMapping();
  const withTrustedComparisons = await preflightSecureCoding8HQuestionMaterialization({
    candidateMapping: mapping,
    submittedPayloadHash: first.payload.canonicalHash,
    expectedRevision: {
      candidateId: CANDIDATE_ID,
      version: "v1",
    },
    expectedSource: first.source,
  });
  assert.equal(withTrustedComparisons.payload.canonicalHash, first.payload.canonicalHash);
  assert.equal(withTrustedComparisons.preflightStatus, "BLOCKED");
  assert.equal(withTrustedComparisons.persistenceStatus, "NOT_READY");
  assert.equal(withTrustedComparisons.approvalStatus, "UNKNOWN");
  assert.equal(withTrustedComparisons.sourceBindingStatus, "UNKNOWN");
});

test("rejects same-count identity, duplicate, missing, extra, and payload mutations", async () => {
  const mapping = await buildSecureCoding8HQuestionRuntimeMapping();

  const sameCountIdentityMutation = clone(mapping);
  sameCountIdentityMutation.mappings[0].foundationQuestionId = "Q02";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping: sameCountIdentityMutation }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const duplicate = clone(mapping);
  duplicate.mappings[1] = duplicate.mappings[0];
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping: duplicate }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const missing = clone(mapping);
  missing.mappings.pop();
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping: missing }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const extra = clone(mapping);
  extra.mappings.push(clone(extra.mappings[0]));
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping: extra }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const payloadAndHashMutation = clone(mapping);
  payloadAndHashMutation.mappings[0].question.content += " caller spoof";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      candidateMapping: payloadAndHashMutation,
      submittedPayloadHash: "1".repeat(64),
    }),
    "MAPPING_PROJECTION_MISMATCH",
  );
});

test("rejects choice, version, course, and submitted hash tampering", async () => {
  const mapping = await buildSecureCoding8HQuestionRuntimeMapping();

  const choiceMutation = clone(mapping);
  choiceMutation.mappings[0].choices[0].questionId = "question-other-course-Q01";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping: choiceMutation }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const versionMutation = clone(mapping);
  versionMutation.mappings[0].version.id = "version-forged-v1";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping: versionMutation }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const courseMutation = clone(mapping);
  courseMutation.mappings[0].courseBinding.courseId = "course-forged";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping: courseMutation }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const canonical = await preflightSecureCoding8HQuestionMaterialization();
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      submittedPayloadHash: "0".repeat(64),
    }),
    "PAYLOAD_HASH_MISMATCH",
  );
  assert.equal(canonical.payload.canonicalHash.length, 64);
});

test("rejects revision/source/action replacement and caller-supplied authority", async () => {
  const canonical = await preflightSecureCoding8HQuestionMaterialization();

  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      expectedRevision: { candidateId: CANDIDATE_ID, version: "v2" },
    }),
    "FOUNDATION_REVISION_MISMATCH",
  );

  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      expectedSource: {
        ...canonical.source,
        manifestHash: "0".repeat(64),
      },
    }),
    "SOURCE_MANIFEST_MISMATCH",
  );

  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ requestedAction: "PUBLISH" }),
    "PREFLIGHT_ACTION_UNSUPPORTED",
  );

  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      approvalEvidence: { status: "APPROVED" },
    }),
    "UNTRUSTED_AUTHORITY_INPUT",
  );
});

test("rejects malformed direct-JS values before canonical serialization", async () => {
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization(null),
    "PREFLIGHT_INPUT_INVALID",
  );
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization([]),
    "PREFLIGHT_INPUT_INVALID",
  );
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ submittedPayloadHash: NaN }),
    "PREFLIGHT_INPUT_INVALID",
  );
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ submittedPayloadHash: Infinity }),
    "PREFLIGHT_INPUT_INVALID",
  );
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ requestedAction: undefined }),
    "PREFLIGHT_INPUT_INVALID",
  );

  const mapping = await buildSecureCoding8HQuestionRuntimeMapping();
  const nonFiniteMapping = clone(mapping);
  nonFiniteMapping.mappings[0].question.version = NaN;
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping: nonFiniteMapping }),
    "PREFLIGHT_INPUT_INVALID",
  );
});

test("snapshots caller input and does not expose a mutation path", async () => {
  const mapping = clone(await buildSecureCoding8HQuestionRuntimeMapping());
  const result = await preflightSecureCoding8HQuestionMaterialization({
    candidateMapping: mapping,
  });
  const hash = result.payload.canonicalHash;
  mapping.mappings[0].question.content = "mutated after preflight";

  assert.equal(result.payload.canonicalHash, hash);
  assert.notEqual(result.questionRows[0].content, "mutated after preflight");
  assert.equal(Object.isFrozen(result.questionRows[0]), true);
  assert.equal(Object.isFrozen(result.choiceRows), true);
  assert.equal(Object.isFrozen(result.versionRows), true);
});
