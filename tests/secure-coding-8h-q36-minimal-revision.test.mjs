import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gradeQuestion } from "../lib/services/grading-service.ts";
import {
  assertSecureCoding8HQuestionRuntimeMapping,
  buildSecureCoding8HQuestionRuntimeMapping,
  projectSecureCoding8HQuestionRuntimeMapping,
} from "../lib/services/secure-coding-8h-question-runtime-mapping.ts";
import { loadSecureCoding8HRuntimeModel } from "../lib/services/secure-coding-8h-runtime-adapter.ts";
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

function q36(manifest) {
  return manifest.mappings.find((entry) => entry.foundationQuestionId === "Q36");
}

function q36QuestionRows(preflight) {
  return preflight.questionRows.find((row) => row.id.endsWith("-Q36"));
}

test("keeps the approved Q36 content change minimal and updates the exact expectation", async () => {
  const questions = JSON.parse(
    await readFile("content-drafts/secure-coding-8h-foundation/questions.json", "utf8"),
  );
  const manifest = JSON.parse(
    await readFile("content-drafts/secure-coding-8h-foundation/manifest.json", "utf8"),
  );
  const current = questions.questions.find((question) => question.id === "Q36");
  assert.equal(current.answer, 1);
  assert.equal(
    current.options[1],
    "A review should consider source, integrity, owner, build context, and CI credential exposure",
  );
  assert.equal(manifest.questionDistribution.answerPositionDistribution["0"], 9);
  assert.equal(manifest.questionDistribution.answerPositionDistribution["1"], 11);
  assert.equal(manifest.questionDistribution.answerPositionDistribution["2"], 10);
  assert.equal(manifest.questionDistribution.answerPositionDistribution["3"], 10);

  assert.equal(
    current.prompt,
    "Which build-provenance statement is correct?",
  );
  assert.equal(current.id, "Q36");
  assert.equal(current.module, "M07");
  assert.deepEqual(current.objectiveIds, ["O28"]);
  assert.deepEqual(current.options, [
    "A locked version alone proves the package source is trustworthy",
    "A review should consider source, integrity, owner, build context, and CI credential exposure",
    "A model-generated dependency is approved by default",
    "Build tools have no security relevance",
  ]);
  assert.equal(current.options.length, 4);
  assert.equal(
    current.explanation,
    "Provenance is a set of assumptions and controls around source, integrity, ownership, execution context, and credentials; a lockfile is useful but not conclusive.",
  );
  assert.equal(current.explanation.length > 0, true);
  assert.doesNotMatch(
    await readFile("scripts/validate-secure-coding-8h-foundation.mjs", "utf8"),
    /max\s*[-–]\s*min|distribution.*<=\s*2/i,
  );
});

test("projects Q36 as an immutable candidate v2 while preserving the other 39", async () => {
  const baseline = await buildSecureCoding8HQuestionRuntimeMapping();
  const candidate = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);
  const baselineById = new Map(
    baseline.mappings.map((entry) => [entry.foundationQuestionId, entry]),
  );
  const candidateQ36 = q36(candidate);
  assert.equal(candidate.revisionContext.sourceRevisionId, REVISION_CONTEXT.sourceRevisionId);
  assert.equal(candidateQ36.question.version, 2);
  assert.equal(candidateQ36.version.version, 2);
  assert.equal(candidateQ36.runtimeQuestionVersionId.endsWith("-Q36-v2"), true);
  assert.equal(candidateQ36.choices[0].isCorrect, false);
  assert.equal(candidateQ36.choices[1].isCorrect, true);
  assert.equal(
    gradeQuestion(
      { type: candidateQ36.question.type, choices: candidateQ36.choices },
      candidateQ36.choices[1].id,
    ).score,
    100,
  );
  assert.equal(
    gradeQuestion(
      { type: candidateQ36.question.type, choices: candidateQ36.choices },
      candidateQ36.choices[0].id,
    ).score,
    0,
  );
  for (const entry of candidate.mappings) {
    if (entry.foundationQuestionId === "Q36") continue;
    assert.deepEqual(entry, baselineById.get(entry.foundationQuestionId));
  }
  assert.deepEqual(
    candidateQ36.choices.map((choice) => [choice.id, choice.displayOrder, choice.content]),
    baselineById.get("Q36").choices.map((choice) => [choice.id, choice.displayOrder, choice.content]),
  );
  assert.equal(candidateQ36.semanticHash, baselineById.get("Q36").semanticHash);

  const model = loadSecureCoding8HRuntimeModel({
    runtimeCourse: {
      id: COURSE_ID,
      slug: "secure-coding-8h-python-vibe",
      active: false,
      published: false,
      deletedAt: null,
    },
    exposure: "registration",
  });
  const oldSource = clone(model);
  oldSource.foundation.questions.questions.find((question) => question.id === "Q36").answer = 0;
  const oldV1 = await projectSecureCoding8HQuestionRuntimeMapping(oldSource);
  await expectCode(
    () => assertSecureCoding8HQuestionRuntimeMapping(oldV1, model),
    "MAPPING_PROJECTION_MISMATCH",
  );
  await expectCode(
    () => buildSecureCoding8HQuestionRuntimeMapping({
      ...REVISION_CONTEXT,
      questionVersionOverrides: { Q01: 2 },
    }),
    "QUESTION_REVISION_CONTEXT_INVALID",
  );
});

test("preflight binds candidate hashes and versions without granting authority", async () => {
  const baseline = await preflightSecureCoding8HQuestionMaterialization();
  const candidateMapping = await buildSecureCoding8HQuestionRuntimeMapping(REVISION_CONTEXT);
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({ candidateMapping }),
    "MAPPING_PROJECTION_MISMATCH",
  );

  const candidate = await preflightSecureCoding8HQuestionMaterialization({
    candidateRevisionContext: REVISION_CONTEXT,
  });
  assert.equal(candidate.preflightStatus, "BLOCKED");
  assert.equal(candidate.persistenceStatus, "NOT_READY");
  assert.equal(candidate.sourceBindingStatus, "UNKNOWN");
  assert.equal(candidate.approvalStatus, "UNKNOWN");
  assert.equal(q36QuestionRows(candidate).version, 2);
  assert.equal(
    candidate.versionRows.find((row) => row.questionId.endsWith("-Q36")).version,
    2,
  );
  assert.equal(candidate.versionRows.filter((row) => row.version === 2).length, 1);
  assert.equal(candidate.versionRows.filter((row) => row.version === 1).length, 39);
  assert.deepEqual(candidate.source.revisionContext, REVISION_CONTEXT);

  const verifiedComparisons = await preflightSecureCoding8HQuestionMaterialization({
    candidateRevisionContext: REVISION_CONTEXT,
    candidateMapping,
    expectedRevision: {
      candidateId: CANDIDATE_ID,
      version: "v1",
      questionVersionOverrides: { Q36: 2 },
    },
    expectedSource: candidate.source,
    submittedPayloadHash: candidate.payload.canonicalHash,
  });
  assert.equal(verifiedComparisons.payload.canonicalHash, candidate.payload.canonicalHash);
  assert.equal(verifiedComparisons.preflightStatus, "BLOCKED");
  assert.equal(verifiedComparisons.persistenceStatus, "NOT_READY");

  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      candidateRevisionContext: REVISION_CONTEXT,
      submittedPayloadHash: baseline.payload.canonicalHash,
    }),
    "PAYLOAD_HASH_MISMATCH",
  );
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      candidateRevisionContext: REVISION_CONTEXT,
      expectedRevision: {
        candidateId: CANDIDATE_ID,
        version: "v1",
        questionVersionOverrides: { Q01: 2 },
      },
    }),
    "FOUNDATION_REVISION_INVALID",
  );
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      candidateRevisionContext: REVISION_CONTEXT,
      approvalEvidence: { status: "APPROVED" },
    }),
    "UNTRUSTED_AUTHORITY_INPUT",
  );

  const staleCandidate = clone(candidateMapping);
  staleCandidate.mappings.find((entry) => entry.foundationQuestionId === "Q36").version.id =
    "version-question-developer-secure-coding-8h-python-vibe-Q36-v1";
  await expectCode(
    () => preflightSecureCoding8HQuestionMaterialization({
      candidateRevisionContext: REVISION_CONTEXT,
      candidateMapping: staleCandidate,
    }),
    "MAPPING_PROJECTION_MISMATCH",
  );
});
