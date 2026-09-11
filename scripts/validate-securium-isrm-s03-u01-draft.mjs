import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DRAFT_ROOT = resolve("content-drafts/securium-isrm-s03-u01-authoring");

async function readJson(fileName, root = DRAFT_ROOT) {
  return JSON.parse(await readFile(resolve(root, fileName), "utf8"));
}

function nonEmpty(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must not be empty`);
}

function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} contains duplicates`);
}

export async function validateDraft(root = DRAFT_ROOT) {
  const [manifest, objectives, theory, questions, claims] = await Promise.all([
    readJson("manifest.json", root),
    readJson("objectives.json", root),
    readJson("theory.json", root),
    readJson("questions.json", root),
    readJson("source-claims.json", root),
  ]);

  assert.equal(manifest.schema, "securium.isrm.s03_u01.authoring_draft.v1");
  assert.equal(manifest.status, "DRAFT_UNPUBLISHED_REVIEW_REQUIRED");
  assert.equal(manifest.courseId, "course-isrm");
  assert.equal(manifest.subjectId, "isrm-2025-2027-s03");
  assert.equal(manifest.learningUnitId, "isrm-2025-2027-s03-u01");
  assert.equal(manifest.titleAuthority, "SECURIUM_DRAFT_TITLE_NOT_OFFICIAL_UNIT_TITLE");
  assert.deepEqual(manifest.officialScopeAnchor.subitems, [
    "식별된 위험에 대한 처리 전략 및 보호대책 수립",
    "보호대책 구현 시 고려사항",
    "보호대책 구현 완료 후 이행점검",
  ]);
  assert.equal(manifest.sourcePolicy.sourceExpressionReuse, 0);
  assert.equal(manifest.sourcePolicy.officialQuestionReconstruction, 0);
  assert.equal(manifest.governance.canonicalApproval, "NOT_REQUESTED");
  assert.equal(manifest.governance.revisionBinding, "NOT_ISSUED");
  assert.equal(manifest.governance.publication, "NOT_AUTHORIZED");
  assert.equal(manifest.governance.runtimeImport, "NONE");
  assert.equal(manifest.governance.runtimeRegistration, 0);
  assert.equal(manifest.governance.runtimeDbIo, 0);
  assert.equal(manifest.currentness.officialSemanticVersion, "UNKNOWN");
  assert.equal(manifest.currentness.unitIdYearRangeNotUsedAsEvidence, true);
  assert.deepEqual(manifest.existingCanonicalAuthorityRows, [
    { id: "isrm-q-v2-12", answerAuthority: "PRESENT", explanation: "PRESENT", decision: "ACCEPT", bodyPayloadPresent: false },
    { id: "isrm-q-v2-13", answerAuthority: "PRESENT", explanation: "PRESENT", decision: "ACCEPT", bodyPayloadPresent: false },
    { id: "isrm-q-v2-14", answerAuthority: "PRESENT", explanation: "PRESENT", decision: "ACCEPT", bodyPayloadPresent: false },
    { id: "isrm-q-v2-28", answerAuthority: "PRESENT", explanation: "PRESENT", decision: "ACCEPT", bodyPayloadPresent: false },
  ]);

  const objectiveIds = objectives.objectives.map((objective) => objective.id);
  assert.deepEqual(objectiveIds, ["ISRM-S03-U01-O01", "ISRM-S03-U01-O02"]);
  unique(objectiveIds, "objective IDs");
  assert.deepEqual(objectives.objectives[0].questionIds, ["isrm-q-v2-12", "isrm-q-v2-13", "isrm-q-v2-28"]);
  assert.deepEqual(objectives.objectives[1].questionIds, ["isrm-q-v2-14"]);
  for (const objective of objectives.objectives) {
    assert.equal(objective.provenance, "SECURIUM_INDEPENDENTLY_AUTHORED_DRAFT");
    nonEmpty(objective.outcome, `${objective.id}.outcome`);
    assert.deepEqual(objective.theoryIds, ["ISRM-S03-U01-T01"]);
  }

  assert.equal(theory.schema, "securium.isrm.s03_u01.theory_draft.v1");
  assert.equal(theory.status, "DRAFT_UNPUBLISHED_REVIEW_REQUIRED");
  assert.equal(theory.id, "ISRM-S03-U01-T01");
  assert.equal(theory.learningUnitId, manifest.learningUnitId);
  assert.equal(theory.sourceExpressionReuse, 0);
  assert.equal(theory.canonicalApproval, "NOT_REQUESTED");
  assert.equal(theory.publication, "NOT_AUTHORIZED");
  assert.ok(theory.sections.length >= 9, "theory must include the full draft structure");
  for (const section of theory.sections) {
    nonEmpty(section.id, `${section.id}.id`);
    nonEmpty(section.heading, `${section.id}.heading`);
    assert.ok(section.body || section.summary || section.steps || section.items || section.selfCheck, `${section.id} must have content`);
  }
  assert.equal(theory.sections.find((section) => section.id === "fictional-case").fictional, true);
  const bridge = theory.sections.find((section) => section.id === "bridge-from-s02");
  assert.ok(bridge.body.includes("S02-U02"), "theory must connect to S02-U02");

  const questionsById = new Map(questions.questions.map((question) => [question.id, question]));
  const expectedQuestionIds = ["isrm-q-v2-12", "isrm-q-v2-13", "isrm-q-v2-14", "isrm-q-v2-28"];
  assert.deepEqual([...questionsById.keys()], expectedQuestionIds);
  unique([...questionsById.keys()], "question IDs");
  for (const question of questions.questions) {
    assert.equal(question.status, "DRAFT_UNPUBLISHED");
    assert.equal(question.type, "SINGLE_CHOICE");
    assert.equal(question.courseId, "course-isrm");
    assert.equal(question.subjectId, "isrm-2025-2027-s03");
    assert.equal(question.learningUnitId, manifest.learningUnitId);
    assert.equal(question.scenarioType, "SECURIUM_SYNTHETIC_SCENARIO");
    assert.equal(question.fictional, true);
    nonEmpty(question.prompt, `${question.id}.prompt`);
    assert.equal(question.options.length, 4, `${question.id} must have four options`);
    unique(question.options.map((option) => option.id), `${question.id} option IDs`);
    assert.ok(question.options.every((option) => option.text.trim().length > 0), `${question.id} options must be non-empty`);
    assert.equal(question.options.filter((option) => option.id === question.correctOptionId).length, 1, `${question.id} must have one answer option`);
    const wrongOptionIds = question.options.filter((option) => option.id !== question.correctOptionId).map((option) => option.id);
    assert.deepEqual(Object.keys(question.incorrectExplanations).sort(), [...wrongOptionIds].sort(), `${question.id} must explain every incorrect option`);
    nonEmpty(question.answerExplanation, `${question.id}.answerExplanation`);
    assert.equal(question.ambiguityReview, "ONE_BEST_ANSWER");
    assert.equal(question.provenance, "SECURIUM_INDEPENDENTLY_AUTHORED_DRAFT");
    assert.equal(question.sourceExpressionReuse, 0);
    assert.equal(question.officialQuestionReconstruction, 0);
    assert.equal(question.canonicalRevisionBinding, "NOT_ISSUED");
  }
  for (const objective of objectives.objectives) {
    for (const questionId of objective.questionIds) {
      const linked = questionsById.get(questionId);
      assert.ok(linked, `${objective.id} references an unknown question ${questionId}`);
      assert.ok(linked.objectiveIds.includes(objective.id), `${linked.id} must link back to ${objective.id}`);
    }
  }
  for (const question of questions.questions) {
    for (const objectiveId of question.objectiveIds) {
      assert.ok(objectiveIds.includes(objectiveId), `${question.id} references an unknown objective ${objectiveId}`);
    }
  }

  const claimIds = claims.claims.map((claim) => claim.id);
  unique(claimIds, "claim IDs");
  const claimSet = new Set(claimIds);
  for (const claim of claims.claims) {
    nonEmpty(claim.claim, `${claim.id}.claim`);
    nonEmpty(claim.sourceType, `${claim.id}.sourceType`);
    nonEmpty(claim.sourceLocation, `${claim.id}.sourceLocation`);
    nonEmpty(claim.currentness, `${claim.id}.currentness`);
  }
  for (const ref of [
    ...manifest.officialScopeAnchor.claimIds,
    ...theory.claimIds,
    ...objectives.objectives.flatMap((objective) => objective.claimIds),
    ...theory.sections.flatMap((section) => section.claimIds ?? []),
    ...questions.questions.flatMap((question) => question.claimIds),
  ]) {
    assert.ok(claimSet.has(ref), `unresolved claim reference: ${ref}`);
  }
  assert.equal(claims.gate.officialExpressionReusePermission, "UNKNOWN_BLOCKED");
  assert.equal(claims.gate.officialSemanticVersion, "UNKNOWN");
  assert.equal(claims.gate.commercialSourcesUsed, 0);
  assert.equal(claims.gate.officialQuestionReproduction, 0);
  assert.equal(claims.gate.sourceBindingApproval, "NOT_ISSUED");
  assert.equal(claims.gate.canonicalApproval, "NOT_REQUESTED");

  return {
    status: manifest.status,
    learningUnitId: manifest.learningUnitId,
    objectiveCount: objectiveIds.length,
    theoryCount: 1,
    questionCount: questions.questions.length,
    claimCount: claimIds.length,
    sourceExpressionReuse: 0,
    officialQuestionReconstruction: 0,
    canonicalApproval: manifest.governance.canonicalApproval,
    publication: manifest.governance.publication,
    runtimeImport: manifest.governance.runtimeImport,
    currentness: manifest.currentness.status,
    rights: claims.gate.officialExpressionReusePermission,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await validateDraft();
  console.log(JSON.stringify(result, null, 2));
}
