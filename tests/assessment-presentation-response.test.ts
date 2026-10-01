import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AssessmentPresentationResponseError,
  assertPresentationMetadataHasNoAuthority,
  createAssessmentPresentationResponseContract,
  resolveLegacyCaseAnalysis,
  serializeAssessmentPresentationResponse,
} from "../lib/services/assessment-presentation-response.ts";
import {
  gradeQuestion,
  gradingModeForResponseType,
} from "../lib/services/grading-service.ts";

const mismatch = (contract: Record<string, unknown>) => assert.throws(
  () => serializeAssessmentPresentationResponse({ contract: contract as never }),
  (error: unknown) => error instanceof AssessmentPresentationResponseError && error.code === "GRADING_MODE_DERIVATION_MISMATCH",
);

test("STANDARD + SINGLE_CHOICE derives AUTOMATIC", () => {
  assert.deepEqual(
    createAssessmentPresentationResponseContract({ presentationType: "STANDARD", responseType: "SINGLE_CHOICE" }),
    { presentationType: "STANDARD", responseType: "SINGLE_CHOICE", gradingMode: "AUTOMATIC" },
  );
});

test("SCENARIO + SINGLE_CHOICE derives AUTOMATIC", () => {
  assert.equal(createAssessmentPresentationResponseContract({ presentationType: "SCENARIO", responseType: "SINGLE_CHOICE" }).gradingMode, "AUTOMATIC");
});

test("SCENARIO + SHORT_ANSWER uses the existing automatic authority", () => {
  assert.equal(createAssessmentPresentationResponseContract({ presentationType: "SCENARIO", responseType: "SHORT_ANSWER" }).gradingMode, "AUTOMATIC");
});

test("SCENARIO + DESCRIPTIVE resolves to ESSAY manual review", () => {
  const contract = createAssessmentPresentationResponseContract({ presentationType: "SCENARIO", responseType: "DESCRIPTIVE" });
  assert.equal(contract.responseType, "ESSAY");
  assert.equal(contract.gradingMode, "MANUAL_REVIEW");
});

test("SCENARIO + SINGLE_CHOICE + MANUAL_REVIEW is rejected", () => {
  mismatch({ presentationType: "SCENARIO", responseType: "SINGLE_CHOICE", gradingMode: "MANUAL_REVIEW" });
});

test("STANDARD + SINGLE_CHOICE + MANUAL_REVIEW is rejected", () => {
  mismatch({ presentationType: "STANDARD", responseType: "SINGLE_CHOICE", gradingMode: "MANUAL_REVIEW" });
});

test("SCENARIO + SINGLE_CHOICE + AUTOMATIC is accepted", () => {
  const output = JSON.parse(serializeAssessmentPresentationResponse({
    contract: { presentationType: "SCENARIO", responseType: "SINGLE_CHOICE", gradingMode: "AUTOMATIC" },
  })) as { contract: { gradingMode: string } };
  assert.equal(output.contract.gradingMode, "AUTOMATIC");
});

test("presentation-only mutation preserves grading mode", () => {
  const standard = createAssessmentPresentationResponseContract({ presentationType: "STANDARD", responseType: "SINGLE_CHOICE" });
  const scenario = createAssessmentPresentationResponseContract({ presentationType: "SCENARIO", responseType: "SINGLE_CHOICE" });
  assert.equal(standard.gradingMode, scenario.gradingMode);
  assert.equal(standard.gradingMode, gradingModeForResponseType(standard.responseType));
});

test("response mutation re-derives grading mode", () => {
  const automatic = createAssessmentPresentationResponseContract({ presentationType: "SCENARIO", responseType: "SINGLE_CHOICE" });
  const manual = createAssessmentPresentationResponseContract({ presentationType: "SCENARIO", responseType: "ESSAY" });
  assert.equal(automatic.gradingMode, "AUTOMATIC");
  assert.equal(manual.gradingMode, "MANUAL_REVIEW");
});

test("unsafe-cast forged contract is rejected", () => {
  mismatch({ presentationType: "SCENARIO", responseType: "SINGLE_CHOICE", gradingMode: "MANUAL_REVIEW" });
});

test("legacy CASE_ANALYSIS without response is fail-closed", () => {
  assert.throws(
    () => resolveLegacyCaseAnalysis({ presentationType: "CASE" }),
    (error: unknown) => error instanceof AssessmentPresentationResponseError && error.code === "LEGACY_CASE_ANALYSIS_RESPONSE_TYPE_UNRESOLVED",
  );
});

test("DESCRIPTIVE response cannot claim AUTOMATIC grading", () => {
  mismatch({ presentationType: "SCENARIO", responseType: "ESSAY", gradingMode: "AUTOMATIC" });
});

test("valid DESCRIPTIVE manual-review contract is accepted", () => {
  const contract = createAssessmentPresentationResponseContract({ presentationType: "SCENARIO", responseType: "DESCRIPTIVE" });
  const output = JSON.parse(serializeAssessmentPresentationResponse({ contract })) as { contract: { responseType: string; gradingMode: string } };
  assert.deepEqual(output.contract, { responseType: "ESSAY", gradingMode: "MANUAL_REVIEW", presentationType: "SCENARIO" });
});

test("presentation metadata cannot change answer or grading authority", () => {
  assert.throws(
    () => assertPresentationMetadataHasNoAuthority({ context: { answerIndex: 0, gradingMode: "MANUAL_REVIEW" } }),
    (error: unknown) => error instanceof AssessmentPresentationResponseError && error.code === "PRESENTATION_METADATA_AUTHORITY_VIOLATION",
  );
});

test("direct CASE_ANALYSIS remains unsupported by gradeQuestion", () => {
  const result = gradeQuestion({ type: "CASE_ANALYSIS", choices: [] }, "a");
  assert.deepEqual(result, { supported: false, isCorrect: null, score: null, normalizedAnswer: [], correctAnswer: [] });
});

test("serialized output uses the canonical response-derived grading mode", () => {
  const contract = createAssessmentPresentationResponseContract({ presentationType: "STANDARD", responseType: "SINGLE_CHOICE" });
  const output = JSON.parse(serializeAssessmentPresentationResponse({ contract })) as { contract: { responseType: string; gradingMode: string } };
  assert.equal(output.contract.gradingMode, gradingModeForResponseType(output.contract.responseType as never));
});
