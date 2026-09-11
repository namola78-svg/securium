import assert from "node:assert/strict";
import test from "node:test";
import { sha256Canonical } from "../lib/policy/stable-canonical-hash.ts";
import {
  buildSecureCoding8HQuestionRuntimeMapping,
} from "../lib/services/secure-coding-8h-question-runtime-mapping.ts";
import {
  preflightSecureCoding8HQuestionMaterialization,
} from "../lib/services/secure-coding-8h-question-materialization-contract.ts";

const COURSE_ID = "developer-secure-coding-8h-python-vibe";
const CANDIDATE_ID =
  "securium-developer-secure-coding-8h-python-vibe-foundation-v1";
const REVISION_CONTEXT = {
  sourceRevisionId: "q36-answer-binding-repair-candidate",
  sourceRevisionVersion: "candidate-1",
  questionVersionOverrides: { Q36: 2 },
};

function clone(value) {
  return structuredClone(value);
}

async function expectCode(operation, code) {
  await assert.rejects(operation, (error) => error?.code === code, code);
}

test("validates the canonical projection and keeps unresolved authority blocked", async () => {
  const result = await preflightSecureCoding8HQuestionMaterialization({
    candidateRevisionContext: REVISION_CONTEXT,
  });

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
  assert.equal(result.versionRows.filter((row) => row.version === 1).length, 39);
  assert.equal(result.versionRows.filter((row) => row.version === 2).length, 1);
  assert.equal(result.courseBindingRows.every((row) => row.weight === 100), true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal("approvalEvidence" in result, false);
});

test("canonical input is deterministic and a valid submitted hash is not approval", async () => {
  const first = await preflightSecureCoding8HQuestionMaterialization({
    candidateRevisionContext: REVISION_CONTEXT,
  });
  const second = await preflightSecureCoding8HQuestionMaterialization({
    candidateRevisionContext: REVISION_CONTEXT,
  });
  assert.deepEqual(first, second);

  const mapping = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);
  const withTrustedComparisons = await preflightSecureCoding8HQuestionMaterialization({
    candidateRevisionContext: REVISION_CONTEXT,
    candidateMapping: mapping,
    submittedPayloadHash: first.payload.canonicalHash,
    expectedRevision: {
      candidateId: CANDIDATE_ID,
      version: "v1",
      questionVersionOverrides: { Q36: 2 },
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
  const mapping = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);

  const sameCountIdentityMutation = clone(mapping);
  sameCountIdentityMutation.mappings[0].foundationQuestionId = "Q02";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, candidateMapping: sameCountIdentityMutation }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const duplicate = clone(mapping);
  duplicate.mappings[1] = duplicate.mappings[0];
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, candidateMapping: duplicate }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const missing = clone(mapping);
  missing.mappings.pop();
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, candidateMapping: missing }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const extra = clone(mapping);
  extra.mappings.push(clone(extra.mappings[0]));
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, candidateMapping: extra }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const payloadAndHashMutation = clone(mapping);
  payloadAndHashMutation.mappings[0].question.content += " caller spoof";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      candidateRevisionContext: REVISION_CONTEXT,
      candidateMapping: payloadAndHashMutation,
      submittedPayloadHash: "1".repeat(64),
    }),
    "MAPPING_PROJECTION_MISMATCH",
  );
});

test("rejects choice, version, course, and submitted hash tampering", async () => {
  const mapping = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);

  const choiceMutation = clone(mapping);
  choiceMutation.mappings[0].choices[0].questionId = "question-other-course-Q01";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, candidateMapping: choiceMutation }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const versionMutation = clone(mapping);
  versionMutation.mappings[0].version.id = "version-forged-v1";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, candidateMapping: versionMutation }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const courseMutation = clone(mapping);
  courseMutation.mappings[0].courseBinding.courseId = "course-forged";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, candidateMapping: courseMutation }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const canonical = await preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT });
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      candidateRevisionContext: REVISION_CONTEXT,
      submittedPayloadHash: "0".repeat(64),
    }),
    "PAYLOAD_HASH_MISMATCH",
  );
  assert.equal(canonical.payload.canonicalHash.length, 64);
});

test("rejects revision/source/action replacement and caller-supplied authority", async () => {
  const canonical = await preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT });

  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      candidateRevisionContext: REVISION_CONTEXT,
      expectedRevision: { candidateId: CANDIDATE_ID, version: "v2" },
    }),
    "FOUNDATION_REVISION_MISMATCH",
  );

  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      candidateRevisionContext: REVISION_CONTEXT,
      expectedSource: {
        ...canonical.source,
        manifestHash: "0".repeat(64),
      },
    }),
    "SOURCE_MANIFEST_MISMATCH",
  );

  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, requestedAction: "PUBLISH" }),
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

  const mapping = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);
  const nonFiniteMapping = clone(mapping);
  nonFiniteMapping.mappings[0].question.version = NaN;
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, candidateMapping: nonFiniteMapping }),
    "PREFLIGHT_INPUT_INVALID",
  );
});

test("rejects sparse, decorated, accessor, cyclic, and non-plain inputs at the entrypoint boundary", async () => {
  const mapping = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);

  const sparse = clone(mapping);
  sparse.mappings = new Array(40);
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, candidateMapping: sparse }),
    "PREFLIGHT_INPUT_INVALID",
  );

  const arrayExtra = clone(mapping);
  arrayExtra.mappings.extra = "unsupported";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT, candidateMapping: arrayExtra }),
    "PREFLIGHT_INPUT_INVALID",
  );

  const symbolKey = { candidateMapping: mapping };
  Object.defineProperty(symbolKey, Symbol("unsupported"), {
    enumerable: true,
    value: true,
  });
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization(symbolKey),
    "PREFLIGHT_INPUT_INVALID",
  );

  const nonEnumerableKey = { candidateMapping: mapping };
  Object.defineProperty(nonEnumerableKey, "unsupported", {
    enumerable: false,
    value: true,
  });
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization(nonEnumerableKey),
    "PREFLIGHT_INPUT_INVALID",
  );

  let topLevelGetterCalls = 0;
  const accessorInput = {};
  Object.defineProperty(accessorInput, "candidateMapping", {
    enumerable: true,
    get() {
      topLevelGetterCalls += 1;
      return mapping;
    },
  });
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization(accessorInput),
    "PREFLIGHT_INPUT_INVALID",
  );
  assert.equal(topLevelGetterCalls, 0);

  const nestedAccessorMapping = clone(mapping);
  let nestedGetterCalls = 0;
  Object.defineProperty(nestedAccessorMapping.mappings[0].question, "content", {
    configurable: true,
    enumerable: true,
    get() {
      nestedGetterCalls += 1;
      return mapping.mappings[0].question.content;
    },
  });
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping: nestedAccessorMapping }),
    "PREFLIGHT_INPUT_INVALID",
  );
  assert.equal(nestedGetterCalls, 0);

  const cycle = { candidateMapping: mapping };
  cycle.cycle = cycle;
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization(cycle),
    "PREFLIGHT_INPUT_INVALID",
  );

  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping: new Date("2026-01-01T00:00:00Z") }),
    "PREFLIGHT_INPUT_INVALID",
  );

  const missingFields = await preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT });
  assert.equal(missingFields.preflightStatus, "BLOCKED");
  assert.equal(missingFields.approvalStatus, "UNKNOWN");
});

test("rejects a self-consistent hash over a caller-mutated payload", async () => {
  const trusted = await preflightSecureCoding8HQuestionMaterialization({ candidateRevisionContext: REVISION_CONTEXT });
  const mutated = clone(await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT));
  mutated.mappings[0].question.content += " caller mutation";
  const forgedHash = await sha256Canonical({
    contractVersion: trusted.contractVersion,
    requestedAction: trusted.requestedAction,
    course: {
      id: mutated.courseId,
      slug: mutated.courseSlug,
    },
    foundation: {
      candidateId: mutated.foundationCandidateId,
      version: mutated.foundationVersion,
    },
    source: {
      manifestHash: trusted.source.manifestHash,
      revisionBindingHash: trusted.source.revisionBindingHash,
    },
    mappings: mutated.mappings.map((entry) => ({
      foundationQuestionId: entry.foundationQuestionId,
      foundationVersion: entry.foundationVersion,
      moduleId: entry.moduleId,
      objectiveIds: [...entry.objectiveIds].sort(),
      semanticHash: entry.semanticHash,
      runtimeQuestionId: entry.runtimeQuestionId,
      runtimeQuestionVersionId: entry.runtimeQuestionVersionId,
      question: entry.question,
      choices: entry.choices,
      courseBinding: entry.courseBinding,
      version: entry.version,
    })),
  });

  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      candidateRevisionContext: REVISION_CONTEXT,
      candidateMapping: mutated,
      submittedPayloadHash: forgedHash,
    }),
    "MAPPING_PROJECTION_MISMATCH",
  );
});

test("snapshots caller input and does not expose a mutation path", async () => {
  const mapping = clone(await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT));
  const preflightPromise = preflightSecureCoding8HQuestionMaterialization({
    candidateRevisionContext: REVISION_CONTEXT,
    candidateMapping: mapping,
  });
  mapping.mappings[0].question.content = "mutated before await";
  const result = await preflightPromise;
  const hash = result.payload.canonicalHash;
  mapping.mappings[0].question.content = "mutated after preflight";

  assert.equal(result.payload.canonicalHash, hash);
  assert.notEqual(result.questionRows[0].content, "mutated before await");
  assert.notEqual(result.questionRows[0].content, "mutated after preflight");
  assert.equal(result.payload.questionSemanticHashes[0].runtimeQuestionId, result.questionRows[0].id);
  assert.equal(result.versionRows[0].questionId, result.questionRows[0].id);
  assert.equal(result.courseBindingRows[0].questionId, result.questionRows[0].id);
  assert.equal(Object.isFrozen(result.questionRows[0]), true);
  assert.equal(Object.isFrozen(result.choiceRows), true);
  assert.equal(Object.isFrozen(result.versionRows), true);
  let mutationThrew = false;
  try {
    result.questionRows[0].content = "attempted result mutation";
  } catch {
    mutationThrew = true;
  }
  assert.equal(mutationThrew, true);
  assert.notEqual(result.questionRows[0].content, "attempted result mutation");
  let choiceMutationThrew = false;
  try {
    result.choiceRows[0].content = "attempted choice mutation";
  } catch {
    choiceMutationThrew = true;
  }
  assert.equal(choiceMutationThrew, true);
  assert.notEqual(result.choiceRows[0].content, "attempted choice mutation");
});
