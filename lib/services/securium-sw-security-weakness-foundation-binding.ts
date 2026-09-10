import { createHash } from "node:crypto";
import { AppError } from "../errors.ts";
import {
  buildSwSecurityWeaknessRuntimeProjection,
  SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY,
  type RuntimeCourseIdentity,
  type SwQuestionProjection,
} from "./securium-sw-security-weakness-runtime-adapter.ts";

export const SW_FOUNDATION_BINDING_CONTRACT_VERSION =
  "sw-foundation-question-binding.v1" as const;

export const SW_FOUNDATION_BINDING_LIFECYCLE_STATES = [
  "ACTIVE",
  "RETIRED",
] as const;

export type SwFoundationBindingLifecycleState =
  (typeof SW_FOUNDATION_BINDING_LIFECYCLE_STATES)[number];

export type SwFoundationQuestionBindingSeed = Readonly<{
  id: string;
  courseId: string;
  foundationBindingKey: string;
  foundationVersion: string;
  foundationQuestionId: string;
  semanticHash: string;
  lifecycleState: "ACTIVE";
}>;

export type SwFoundationQuestionBindingRecord = Readonly<{
  id: string;
  courseId: string;
  foundationBindingKey: string;
  foundationVersion: string;
  foundationQuestionId: string;
  semanticHash: string;
  lifecycleState: string;
  createdAt?: string | null;
  retiredAt?: string | null;
}>;

function fail(code: string, message: string): never {
  throw new AppError(message, 409, code);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

function bindingIdentity(input: Readonly<{
  courseId: string;
  foundationBindingKey: string;
  foundationVersion: string;
  foundationQuestionId: string;
}>): string {
  return [
    SW_FOUNDATION_BINDING_CONTRACT_VERSION,
    input.courseId,
    input.foundationBindingKey,
    input.foundationVersion,
    input.foundationQuestionId,
  ].join("\u001f");
}

function semanticPayload(
  runtimeCourse: RuntimeCourseIdentity,
  question: SwQuestionProjection,
) {
  return {
    contractVersion: SW_FOUNDATION_BINDING_CONTRACT_VERSION,
    courseId: runtimeCourse.id,
    foundationBindingKey: runtimeCourse.bindingKey,
    foundationVersion: runtimeCourse.bindingKey,
    question: {
      type: "SHORT_ANSWER",
      id: question.id,
      triadId: question.triadId,
      topic: question.topic,
      role: question.role,
      moduleId: question.moduleId,
      objectiveIds: [...question.objectiveIds],
      theoryId: question.theoryId,
      purpose: question.purpose,
      stem: question.stem,
      case: {
        code: question.case.code,
        source: question.case.source,
        validationOrTransformation: question.case.validationOrTransformation,
        sinkOrSensitiveOperation: question.case.sinkOrSensitiveOperation,
        assumptions: [...question.case.assumptions],
        evidence: [...question.case.evidence],
      },
      answerKey: {
        verdict: question.answerKey.verdict,
        diagnosticConclusion: question.answerKey.diagnosticConclusion,
      },
      feedback: {
        classification: question.feedback.classification,
        reason: question.feedback.reason,
        vulnerabilityReason: question.feedback.vulnerabilityReason,
        mitigationReason: question.feedback.mitigationReason,
        nonExploitabilityReason: question.feedback.nonExploitabilityReason,
        assumptions: [...question.feedback.assumptions],
        evidence: [...question.feedback.evidence],
        validationOrTransformation: question.feedback.validationOrTransformation,
        diagnosticConclusion: question.feedback.diagnosticConclusion,
        explanation: question.feedback.explanation,
      },
      language: question.language,
      provenance: question.provenance,
      safeEducationalBoundary: question.safeEducationalBoundary,
    },
  } as const;
}

export function deriveSwFoundationQuestionBindingSeed(
  runtimeCourse: RuntimeCourseIdentity,
  question: SwQuestionProjection,
): SwFoundationQuestionBindingSeed {
  if (
    runtimeCourse.id !== SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId ||
    runtimeCourse.code !== SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.code ||
    runtimeCourse.slug !== SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.slug ||
    runtimeCourse.bindingKey !==
      SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.bindingKey
  ) {
    fail("SW_FOUNDATION_COURSE_MISMATCH", "SW Foundation course identity mismatch");
  }
  const foundationVersion = runtimeCourse.bindingKey;
  const identity = {
    courseId: runtimeCourse.id,
    foundationBindingKey: runtimeCourse.bindingKey,
    foundationVersion,
    foundationQuestionId: question.id,
  } as const;
  return Object.freeze({
    id: `sw-fb-v1-${sha256(bindingIdentity(identity))}`,
    ...identity,
    semanticHash: sha256(canonicalJson(semanticPayload(runtimeCourse, question))),
    lifecycleState: "ACTIVE" as const,
  });
}

export function buildSwFoundationQuestionBindingSeeds(
  runtimeCourse: RuntimeCourseIdentity,
): readonly SwFoundationQuestionBindingSeed[] {
  const projection = buildSwSecurityWeaknessRuntimeProjection(runtimeCourse);
  const seeds = projection.questions.map((question) =>
    deriveSwFoundationQuestionBindingSeed(runtimeCourse, question),
  );
  const ids = new Set(seeds.map((seed) => seed.id));
  if (seeds.length !== 21 || ids.size !== seeds.length) {
    fail(
      "SW_FOUNDATION_BINDING_CARDINALITY_INVALID",
      "SW Foundation binding projection must contain 21 unique questions",
    );
  }
  return Object.freeze(seeds);
}

export function getSwFoundationQuestionBindingSeed(
  runtimeCourse: RuntimeCourseIdentity,
  foundationQuestionId: string,
): SwFoundationQuestionBindingSeed {
  const seed = buildSwFoundationQuestionBindingSeeds(runtimeCourse).find(
    (candidate) => candidate.foundationQuestionId === foundationQuestionId,
  );
  if (!seed) {
    fail(
      "SW_FOUNDATION_QUESTION_NOT_FOUND",
      `Unknown SW Foundation question: ${foundationQuestionId}`,
    );
  }
  return seed;
}

export function assertSwFoundationBindingMatches(
  expected: SwFoundationQuestionBindingSeed,
  actual: SwFoundationQuestionBindingRecord,
): void {
  const matches =
    actual.id === expected.id &&
    actual.courseId === expected.courseId &&
    actual.foundationBindingKey === expected.foundationBindingKey &&
    actual.foundationVersion === expected.foundationVersion &&
    actual.foundationQuestionId === expected.foundationQuestionId &&
    actual.semanticHash === expected.semanticHash &&
    actual.lifecycleState === expected.lifecycleState &&
    actual.retiredAt == null;
  if (!matches) {
    fail(
      "SW_FOUNDATION_BINDING_MISMATCH",
      `Immutable SW Foundation binding mismatch for ${expected.foundationQuestionId}`,
    );
  }
}

export function assertSwFoundationAttemptCourse(
  runtimeCourse: RuntimeCourseIdentity,
): void {
  if (
    runtimeCourse.id !== SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId ||
    runtimeCourse.code !== SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.code ||
    runtimeCourse.slug !== SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.slug ||
    runtimeCourse.bindingKey !== SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.bindingKey ||
    runtimeCourse.active !== true ||
    runtimeCourse.published !== true ||
    runtimeCourse.isSample !== false ||
    runtimeCourse.deletedAt != null
  ) {
    fail(
      "SW_FOUNDATION_COURSE_LIFECYCLE_INVALID",
      "SW Foundation attempts require the exact active, published, non-sample course",
    );
  }
}
