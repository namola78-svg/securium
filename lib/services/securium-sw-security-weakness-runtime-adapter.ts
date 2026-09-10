import foundationCandidate from "../../content-drafts/securium-sw-security-weakness-foundation-current-main/foundation-candidate.json" with { type: "json" };
import { AppError } from "../errors.ts";
import {
  gradeQuestion,
  type GradeResult,
  type GradingQuestion,
  type SubmittedAnswer,
} from "./grading-service.ts";

export const SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY = Object.freeze({
  courseId: "course-sw-vuln",
  code: "SW_VULN_DIAG",
  slug: "sw-vulnerability-diagnostician",
  bindingKey: "sw-vuln-foundation-current-main-v1",
} as const);

const EXPECTED_COUNTS = Object.freeze({
  modules: 6,
  objectives: 12,
  theory: 8,
  questions: 21,
  triads: 7,
} as const);

export const SW_DIAGNOSTIC_ROLES = [
  "VULNERABLE",
  "SECURE",
  "FALSE_POSITIVE",
] as const;

export type SwDiagnosticRole = (typeof SW_DIAGNOSTIC_ROLES)[number];

export type SwRuntimeAdapterErrorCode =
  | "FOUNDATION_NOT_FOUND"
  | "FOUNDATION_INVALID"
  | "COURSE_ID_MISMATCH"
  | "SLUG_MISMATCH"
  | "BINDING_KEY_MISMATCH"
  | "PUBLICATION_STATE_CONFLICT"
  | "SAMPLE_STATE_CONFLICT"
  | "MODULE_MAPPING_CONFLICT"
  | "QUESTION_MAPPING_CONFLICT"
  | "TRIAD_INCOMPLETE"
  | "TRIAD_DUPLICATE_ROLE"
  | "TRIAD_CROSS_CATEGORY"
  | "FALSE_POSITIVE_REASONING_MISSING"
  | "GRADING_CONTRACT_MISMATCH"
  | "COUNT_MISMATCH"
  | "PROVIDER_PARITY_MISMATCH"
  | "INTERNAL_ERROR";

export class SwSecurityWeaknessRuntimeAdapterError extends AppError {
  constructor(code: SwRuntimeAdapterErrorCode, message: string = code) {
    super(message, 409, code);
  }
}

type FoundationCase = {
  readonly code: string;
  readonly source: string;
  readonly validationOrTransformation: string;
  readonly sinkOrSensitiveOperation: string;
  readonly assumptions: readonly string[];
  readonly evidence: readonly string[];
};

type FoundationCourse = {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly duplicateCourseAuthorities: number;
  readonly authorityKind: string;
};

type FoundationModule = {
  readonly id: string;
  readonly title: string;
  readonly order: number;
  readonly sourceRole: string;
  readonly objectives: readonly string[];
};

type FoundationObjective = {
  readonly id: string;
  readonly statement: string;
  readonly moduleId: string;
};

type FoundationTheory = {
  readonly id: string;
  readonly title: string;
  readonly moduleId: string;
  readonly decision: string;
  readonly provenance: string;
  readonly sourceRefs: readonly string[];
};

type FoundationQuestion = {
  readonly id: string;
  readonly topic: string;
  readonly role: SwDiagnosticRole;
  readonly moduleId: string;
  readonly objectiveIds: readonly string[];
  readonly theoryId: string;
  readonly purpose: string;
  readonly stem: string;
  readonly case: FoundationCase;
  readonly answerKey: {
    readonly verdict: SwDiagnosticRole;
    readonly diagnosticConclusion: string;
  };
  readonly vulnerabilityReason?: string;
  readonly mitigationReason?: string;
  readonly nonExploitabilityReason?: string;
  readonly answerAuthority: string;
  readonly explanation: string;
  readonly explanationComplete: boolean;
  readonly language: string;
  readonly provenance: string;
  readonly safeEducationalBoundary: string;
};

type FoundationTriad = {
  readonly topic: string;
  readonly weaknessId: string;
  readonly questionIds: readonly string[];
};

type CanonicalFoundation = {
  readonly publication: string;
  readonly course: FoundationCourse;
  readonly authority: {
    readonly curriculumAuthorityId: string;
  };
  readonly curriculum: readonly FoundationModule[];
  readonly objectives: readonly FoundationObjective[];
  readonly theory: readonly FoundationTheory[];
  readonly acceptedDiagnosticTriads: readonly FoundationTriad[];
  readonly questions: readonly FoundationQuestion[];
};

export type RuntimeCourseIdentity = {
  readonly id: string;
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly bindingKey: string;
  readonly active: boolean;
  readonly published: boolean;
  readonly isSample: boolean;
  readonly deletedAt?: string | null;
};

export type SwRuntimeVisibility =
  | "REGISTERED_UNPUBLISHED"
  | "PUBLISHED_CANONICAL";

export type SwModuleProjection = {
  readonly id: string;
  readonly runtimeId: string;
  readonly title: string;
  readonly order: number;
  readonly objectiveIds: readonly string[];
};

export type SwObjectiveProjection = {
  readonly id: string;
  readonly runtimeId: string;
  readonly statement: string;
  readonly moduleId: string;
};

export type SwTheoryProjection = {
  readonly id: string;
  readonly runtimeId: string;
  readonly title: string;
  readonly moduleId: string;
  readonly decision: string;
  readonly provenance: string;
  readonly sourceRefs: readonly string[];
};

export type SwDiagnosticFeedback = {
  readonly classification: SwDiagnosticRole;
  readonly reason: string;
  readonly vulnerabilityReason: string | null;
  readonly mitigationReason: string | null;
  readonly nonExploitabilityReason: string | null;
  readonly assumptions: readonly string[];
  readonly evidence: readonly string[];
  readonly validationOrTransformation: string;
  readonly diagnosticConclusion: string;
  readonly explanation: string;
};

export type SwQuestionProjection = {
  readonly id: string;
  readonly runtimeId: string;
  readonly triadId: string;
  readonly topic: string;
  readonly role: SwDiagnosticRole;
  readonly moduleId: string;
  readonly objectiveIds: readonly string[];
  readonly theoryId: string;
  readonly purpose: string;
  readonly stem: string;
  readonly case: FoundationCase;
  readonly answerKey: FoundationQuestion["answerKey"];
  readonly language: string;
  readonly provenance: string;
  readonly safeEducationalBoundary: string;
  readonly feedback: SwDiagnosticFeedback;
};

export type SwTriadMember = {
  readonly questionId: string;
  readonly role: SwDiagnosticRole;
  readonly question: SwQuestionProjection;
};

export type SwTriadProjection = {
  readonly id: string;
  readonly weaknessId: string;
  readonly topic: string;
  readonly moduleId: string;
  readonly questionIds: readonly [string, string, string];
  readonly members: readonly [SwTriadMember, SwTriadMember, SwTriadMember];
};

export type SwPracticeQuestion = {
  readonly id: string;
  readonly runtimeId: string;
  readonly questionVersionId: null;
  readonly title: string;
  readonly content: string;
  readonly type: "SHORT_ANSWER";
  readonly difficulty: "ADVANCED";
  readonly courseId: string;
  readonly automaticGradingAvailable: true;
  readonly choices: readonly [];
  readonly diagnosticRole: SwDiagnosticRole;
  readonly triadId: string;
  readonly weaknessId: string;
  readonly topic: string;
  readonly purpose: string;
  readonly stem: string;
  readonly case: FoundationCase;
  readonly language: string;
  readonly safeEducationalBoundary: string;
};

export type SwDiagnosticResult = {
  readonly questionId: string;
  readonly triadId: string;
  readonly caseRole: SwDiagnosticRole;
  readonly diagnosis: SwDiagnosticRole | "UNKNOWN";
  readonly supported: boolean;
  readonly isCorrect: boolean | null;
  readonly score: number | null;
  readonly normalizedAnswer: readonly string[];
  readonly correctAnswer: readonly string[];
  readonly feedback: SwDiagnosticFeedback;
};

export type SwRuntimeCourseProjection = {
  readonly course: {
    readonly id: string;
    readonly code: string;
    readonly slug: string;
    readonly name: string;
    readonly bindingKey: string;
    readonly version: string;
    readonly active: boolean;
    readonly published: boolean;
    readonly isSample: boolean;
    readonly deletedAt: string | null;
    readonly visibility: SwRuntimeVisibility;
  };
  readonly counts: typeof EXPECTED_COUNTS;
  readonly modules: readonly SwModuleProjection[];
  readonly objectives: readonly SwObjectiveProjection[];
  readonly theory: readonly SwTheoryProjection[];
  readonly questions: readonly SwQuestionProjection[];
  readonly triads: readonly SwTriadProjection[];
  readonly practice: {
    readonly questions: readonly SwPracticeQuestion[];
    readonly triads: readonly {
      readonly id: string;
      readonly weaknessId: string;
      readonly topic: string;
      readonly members: readonly [
        SwPracticeQuestion,
        SwPracticeQuestion,
        SwPracticeQuestion,
      ];
    }[];
  };
};

const canonicalFoundation = foundationCandidate as unknown as CanonicalFoundation;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new SwSecurityWeaknessRuntimeAdapterError(
      "FOUNDATION_INVALID",
      field + " must be an object",
    );
  }
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new SwSecurityWeaknessRuntimeAdapterError(
      "FOUNDATION_INVALID",
      field + " must be a non-empty string",
    );
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field);
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new SwSecurityWeaknessRuntimeAdapterError(
      "FOUNDATION_INVALID",
      field + " must be boolean",
    );
  }
  return value;
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SwSecurityWeaknessRuntimeAdapterError(
      "FOUNDATION_INVALID",
      field + " must be a finite number",
    );
  }
  return value;
}

function requiredArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new SwSecurityWeaknessRuntimeAdapterError(
      "FOUNDATION_INVALID",
      field + " must be an array",
    );
  }
  return value;
}

function requiredStringArray(value: unknown, field: string): readonly string[] {
  return requiredArray(value, field).map((item, index) =>
    requiredString(item, field + "[" + index + "]")
  );
}

function requiredRole(value: unknown, field: string): SwDiagnosticRole {
  if (
    typeof value !== "string" ||
    !SW_DIAGNOSTIC_ROLES.includes(value as SwDiagnosticRole)
  ) {
    throw new SwSecurityWeaknessRuntimeAdapterError(
      "FOUNDATION_INVALID",
      field + " is not a supported diagnostic role",
    );
  }
  return value as SwDiagnosticRole;
}

function fail(
  code: SwRuntimeAdapterErrorCode,
  message: string,
): never {
  throw new SwSecurityWeaknessRuntimeAdapterError(code, message);
}

function parseCase(value: unknown, field: string): FoundationCase {
  const record = requiredRecord(value, field);
  return {
    code: requiredString(record.code, field + ".code"),
    source: requiredString(record.source, field + ".source"),
    validationOrTransformation: requiredString(
      record.validationOrTransformation,
      field + ".validationOrTransformation",
    ),
    sinkOrSensitiveOperation: requiredString(
      record.sinkOrSensitiveOperation,
      field + ".sinkOrSensitiveOperation",
    ),
    assumptions: requiredStringArray(record.assumptions, field + ".assumptions"),
    evidence: requiredStringArray(record.evidence, field + ".evidence"),
  };
}

function parseQuestion(value: unknown, index: number): FoundationQuestion {
  const field = "questions[" + index + "]";
  const record = requiredRecord(value, field);
  const role = requiredRole(record.role, field + ".role");
  const answerKey = requiredRecord(record.answerKey, field + ".answerKey");
  const verdict = requiredRole(answerKey.verdict, field + ".answerKey.verdict");
  if (verdict !== role) {
    fail(
      "QUESTION_MAPPING_CONFLICT",
      field + ".answerKey.verdict does not match role",
    );
  }
  const explanationComplete = requiredBoolean(
    record.explanationComplete,
    field + ".explanationComplete",
  );
  if (!explanationComplete) {
    fail("FOUNDATION_INVALID", field + ".explanationComplete is false");
  }

  const question: FoundationQuestion = {
    id: requiredString(record.id, field + ".id"),
    topic: requiredString(record.topic, field + ".topic"),
    role,
    moduleId: requiredString(record.moduleId, field + ".moduleId"),
    objectiveIds: requiredStringArray(record.objectiveIds, field + ".objectiveIds"),
    theoryId: requiredString(record.theoryId, field + ".theoryId"),
    purpose: requiredString(record.purpose, field + ".purpose"),
    stem: requiredString(record.stem, field + ".stem"),
    case: parseCase(record.case, field + ".case"),
    answerKey: {
      verdict,
      diagnosticConclusion: requiredString(
        answerKey.diagnosticConclusion,
        field + ".answerKey.diagnosticConclusion",
      ),
    },
    vulnerabilityReason: optionalString(
      record.vulnerabilityReason,
      field + ".vulnerabilityReason",
    ),
    mitigationReason: optionalString(
      record.mitigationReason,
      field + ".mitigationReason",
    ),
    nonExploitabilityReason: optionalString(
      record.nonExploitabilityReason,
      field + ".nonExploitabilityReason",
    ),
    answerAuthority: requiredString(record.answerAuthority, field + ".answerAuthority"),
    explanation: requiredString(record.explanation, field + ".explanation"),
    explanationComplete,
    language: requiredString(record.language, field + ".language"),
    provenance: requiredString(record.provenance, field + ".provenance"),
    safeEducationalBoundary: requiredString(
      record.safeEducationalBoundary,
      field + ".safeEducationalBoundary",
    ),
  };

  if (
    question.role === "FALSE_POSITIVE" &&
    !question.nonExploitabilityReason
  ) {
    fail(
      "FALSE_POSITIVE_REASONING_MISSING",
      field + " is missing nonExploitabilityReason",
    );
  }
  return question;
}

function parseFoundation(
  value: unknown,
  canonicalWeaknessByQuestionSet?: ReadonlyMap<string, string>,
): CanonicalFoundation {
  const candidate = requiredRecord(value, "foundation");
  const course = requiredRecord(candidate.course, "course");
  const authority = requiredRecord(candidate.authority, "authority");

  const curriculum = requiredArray(candidate.curriculum, "curriculum").map(
    (item, index): FoundationModule => {
      const record = requiredRecord(item, "curriculum[" + index + "]");
      return {
        id: requiredString(record.id, "curriculum[" + index + "].id"),
        title: requiredString(record.title, "curriculum[" + index + "].title"),
        order: requiredNumber(record.order, "curriculum[" + index + "].order"),
        sourceRole: requiredString(
          record.sourceRole,
          "curriculum[" + index + "].sourceRole",
        ),
        objectives: requiredStringArray(
          record.objectives,
          "curriculum[" + index + "].objectives",
        ),
      };
    },
  );

  const objectives = requiredArray(candidate.objectives, "objectives").map(
    (item, index): FoundationObjective => {
      const record = requiredRecord(item, "objectives[" + index + "]");
      return {
        id: requiredString(record.id, "objectives[" + index + "].id"),
        statement: requiredString(
          record.statement,
          "objectives[" + index + "].statement",
        ),
        moduleId: requiredString(
          record.moduleId,
          "objectives[" + index + "].moduleId",
        ),
      };
    },
  );

  const theory = requiredArray(candidate.theory, "theory").map(
    (item, index): FoundationTheory => {
      const record = requiredRecord(item, "theory[" + index + "]");
      return {
        id: requiredString(record.id, "theory[" + index + "].id"),
        title: requiredString(record.title, "theory[" + index + "].title"),
        moduleId: requiredString(record.moduleId, "theory[" + index + "].moduleId"),
        decision: requiredString(record.decision, "theory[" + index + "].decision"),
        provenance: requiredString(
          record.provenance,
          "theory[" + index + "].provenance",
        ),
        sourceRefs: requiredStringArray(
          record.sourceRefs,
          "theory[" + index + "].sourceRefs",
        ),
      };
    },
  );

  const acceptedDiagnosticTriads = requiredArray(
    candidate.acceptedDiagnosticTriads,
    "acceptedDiagnosticTriads",
  ).map((item, index): FoundationTriad => {
    const record = requiredRecord(
      item,
      "acceptedDiagnosticTriads[" + index + "]",
    );
    return {
      topic: requiredString(
        record.topic,
        "acceptedDiagnosticTriads[" + index + "].topic",
      ),
      weaknessId: requiredString(
        record.weaknessId,
        "acceptedDiagnosticTriads[" + index + "].weaknessId",
      ),
      questionIds: requiredStringArray(
        record.questionIds,
        "acceptedDiagnosticTriads[" + index + "].questionIds",
      ),
    };
  });

  const questions = requiredArray(candidate.questions, "questions").map(
    parseQuestion,
  );

  const result: CanonicalFoundation = {
    publication: requiredString(candidate.publication, "publication"),
    course: {
      id: requiredString(course.id, "course.id"),
      code: requiredString(course.code, "course.code"),
      slug: requiredString(course.slug, "course.slug"),
      name: requiredString(course.name, "course.name"),
      duplicateCourseAuthorities: requiredNumber(
        course.duplicateCourseAuthorities,
        "course.duplicateCourseAuthorities",
      ),
      authorityKind: requiredString(course.authorityKind, "course.authorityKind"),
    },
    authority: {
      curriculumAuthorityId: requiredString(
        authority.curriculumAuthorityId,
        "authority.curriculumAuthorityId",
      ),
    },
    curriculum,
    objectives,
    theory,
    acceptedDiagnosticTriads,
    questions,
  };

  validateFoundationRelationships(result, canonicalWeaknessByQuestionSet);
  return result;
}

function assertUnique(values: readonly string[], field: string) {
  if (new Set(values).size !== values.length) {
    fail("FOUNDATION_INVALID", field + " contains duplicate IDs");
  }
}

function triadQuestionSetKey(questionIds: readonly string[]): string {
  return [...questionIds].sort().join("\u0000");
}

function canonicalWeaknessBindings(
  foundation: CanonicalFoundation,
): ReadonlyMap<string, string> {
  const bindings = new Map<string, string>();
  for (const triad of foundation.acceptedDiagnosticTriads) {
    const key = triadQuestionSetKey(triad.questionIds);
    if (bindings.has(key)) {
      fail(
        "TRIAD_CROSS_CATEGORY",
        "canonical Foundation contains duplicate question-set weakness bindings",
      );
    }
    bindings.set(key, triad.weaknessId);
  }
  return bindings;
}

function validateFoundationRelationships(
  foundation: CanonicalFoundation,
  canonicalWeaknessByQuestionSet?: ReadonlyMap<string, string>,
) {
  if (foundation.publication !== "NOT_AUTHORIZED") {
    fail("FOUNDATION_INVALID", "publication authorization changed");
  }
  if (foundation.course.duplicateCourseAuthorities !== 0) {
    fail("FOUNDATION_INVALID", "duplicate Foundation authority detected");
  }

  const modules = foundation.curriculum;
  const objectives = foundation.objectives;
  const theory = foundation.theory;
  const questions = foundation.questions;
  const triads = foundation.acceptedDiagnosticTriads;

  if (
    modules.length !== EXPECTED_COUNTS.modules ||
    objectives.length !== EXPECTED_COUNTS.objectives ||
    theory.length !== EXPECTED_COUNTS.theory ||
    questions.length !== EXPECTED_COUNTS.questions ||
    triads.length !== EXPECTED_COUNTS.triads
  ) {
    fail("COUNT_MISMATCH", "Foundation count vector is not 6/12/8/21/7");
  }

  assertUnique(modules.map((item) => item.id), "module IDs");
  assertUnique(objectives.map((item) => item.id), "objective IDs");
  assertUnique(theory.map((item) => item.id), "theory IDs");
  assertUnique(questions.map((item) => item.id), "question IDs");
  assertUnique(triads.map((item) => item.weaknessId), "triad IDs");

  const moduleIds = new Set(modules.map((item) => item.id));
  const objectiveById = new Map(objectives.map((item) => [item.id, item]));
  const theoryById = new Map(theory.map((item) => [item.id, item]));
  const questionById = new Map(questions.map((item) => [item.id, item]));

  for (const curriculumModule of modules) {
    for (const objectiveId of curriculumModule.objectives) {
      const objective = objectiveById.get(objectiveId);
      if (!objective || objective.moduleId !== curriculumModule.id) {
        fail(
          "MODULE_MAPPING_CONFLICT",
          "objective " + objectiveId + " does not resolve to module " + curriculumModule.id,
        );
      }
    }
  }

  for (const objective of objectives) {
    if (!moduleIds.has(objective.moduleId)) {
      fail(
        "MODULE_MAPPING_CONFLICT",
        "objective " + objective.id + " has an unknown module",
      );
    }
  }

  for (const unit of theory) {
    if (!moduleIds.has(unit.moduleId)) {
      fail(
        "MODULE_MAPPING_CONFLICT",
        "theory " + unit.id + " has an unknown module",
      );
    }
  }

  const roleCounts: Record<SwDiagnosticRole, number> = {
    VULNERABLE: 0,
    SECURE: 0,
    FALSE_POSITIVE: 0,
  };
  for (const question of questions) {
    roleCounts[question.role] += 1;
    if (!moduleIds.has(question.moduleId)) {
      fail(
        "QUESTION_MAPPING_CONFLICT",
        "question " + question.id + " has an unknown module",
      );
    }
    const questionTheory = theoryById.get(question.theoryId);
    if (!questionTheory || questionTheory.moduleId !== question.moduleId) {
      fail(
        "QUESTION_MAPPING_CONFLICT",
        "question " + question.id + " has an invalid theory mapping",
      );
    }
    for (const objectiveId of question.objectiveIds) {
      const objective = objectiveById.get(objectiveId);
      if (!objective || objective.moduleId !== question.moduleId) {
        fail(
          "QUESTION_MAPPING_CONFLICT",
          "question " + question.id + " has an invalid objective mapping",
        );
      }
    }
  }
  if (
    roleCounts.VULNERABLE !== 7 ||
    roleCounts.SECURE !== 7 ||
    roleCounts.FALSE_POSITIVE !== 7
  ) {
    fail("COUNT_MISMATCH", "Foundation role counts are not 7/7/7");
  }

  const triadQuestionIds: string[] = [];
  for (const triad of triads) {
    if (triad.questionIds.length !== 3) {
      fail(
        "TRIAD_INCOMPLETE",
        "triad " + triad.weaknessId + " does not contain three questions",
      );
    }
    assertUnique(triad.questionIds, "triad " + triad.weaknessId + " question IDs");
    const members = triad.questionIds.map((questionId) => {
      const question = questionById.get(questionId);
      if (!question) {
        fail(
          "TRIAD_INCOMPLETE",
          "triad " + triad.weaknessId + " references a missing question",
        );
      }
      if (question.topic !== triad.topic) {
        fail(
          "TRIAD_CROSS_CATEGORY",
          "triad " + triad.weaknessId + " crosses diagnostic topics",
        );
      }
      triadQuestionIds.push(questionId);
      return question;
    });

    if (canonicalWeaknessByQuestionSet) {
      const expectedWeaknessId = canonicalWeaknessByQuestionSet.get(
        triadQuestionSetKey(triad.questionIds),
      );
      if (!expectedWeaknessId || triad.weaknessId !== expectedWeaknessId) {
        fail(
          "TRIAD_CROSS_CATEGORY",
          "triad " + triad.weaknessId + " is not bound to its canonical question group",
        );
      }
    }

    const moduleId = members[0].moduleId;
    if (members.some((question) => question.moduleId !== moduleId)) {
      fail(
        "TRIAD_CROSS_CATEGORY",
        "triad " + triad.weaknessId + " crosses modules",
      );
    }
    const triadRoles = members.map((question) => question.role);
    const triadRoleCounts = {
      VULNERABLE: triadRoles.filter((role) => role === "VULNERABLE").length,
      SECURE: triadRoles.filter((role) => role === "SECURE").length,
      FALSE_POSITIVE: triadRoles.filter((role) => role === "FALSE_POSITIVE").length,
    };
    if (
      triadRoleCounts.VULNERABLE !== 1 ||
      triadRoleCounts.SECURE !== 1 ||
      triadRoleCounts.FALSE_POSITIVE !== 1
    ) {
      if (new Set(triadRoles).size !== triadRoles.length) {
        fail(
          "TRIAD_DUPLICATE_ROLE",
          "triad " + triad.weaknessId + " has a duplicate role",
        );
      }
      fail(
        "TRIAD_INCOMPLETE",
        "triad " + triad.weaknessId + " does not contain one of each role",
      );
    }
  }

  if (
    triadQuestionIds.length !== EXPECTED_COUNTS.questions ||
    new Set(triadQuestionIds).size !== EXPECTED_COUNTS.questions ||
    questions.some((question) => !triadQuestionIds.includes(question.id))
  ) {
    fail(
      "TRIAD_INCOMPLETE",
      "triads do not cover every canonical question exactly once",
    );
  }
}

/**
 * Read-only boundary validation. The runtime entrypoint always validates the
 * fixed imported Foundation; this export exists to test fail-closed
 * validation against disposable mutated copies without accepting a file path.
 */
export function validateSwSecurityWeaknessFoundation(
  candidate: unknown,
): void {
  const canonical = parseFoundation(canonicalFoundation);
  parseFoundation(candidate, canonicalWeaknessBindings(canonical));
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const object = value as unknown as Record<string, unknown>;
  if (Object.isFrozen(object)) return value;
  Object.freeze(object);
  for (const child of Object.values(object)) deepFreeze(child);
  return value;
}

function runtimeKey(kind: string, id: string) {
  return SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId + ":" + kind + ":" + id;
}

function validateRuntimeIdentity(
  runtimeCourse: RuntimeCourseIdentity,
  foundation: CanonicalFoundation,
) {
  if (runtimeCourse.id !== foundation.course.id) {
    fail("COURSE_ID_MISMATCH", "runtime course ID does not match Foundation");
  }
  if (runtimeCourse.code !== foundation.course.code) {
    fail("COURSE_ID_MISMATCH", "runtime course code does not match Foundation");
  }
  if (runtimeCourse.slug !== foundation.course.slug) {
    fail("SLUG_MISMATCH", "runtime course slug does not match Foundation");
  }
  if (
    runtimeCourse.bindingKey !== foundation.authority.curriculumAuthorityId
  ) {
    fail("BINDING_KEY_MISMATCH", "runtime binding key does not match Foundation");
  }
  if (runtimeCourse.name !== foundation.course.name) {
    fail("COURSE_ID_MISMATCH", "runtime course name does not match Foundation");
  }
  if (
    runtimeCourse.active !== true ||
    (runtimeCourse.deletedAt ?? null) !== null
  ) {
    fail(
      "PUBLICATION_STATE_CONFLICT",
      "runtime course is inactive or deleted",
    );
  }
  if (runtimeCourse.isSample === true) {
    fail(
      "SAMPLE_STATE_CONFLICT",
      "runtime sample state cannot expose canonical Foundation",
    );
  }
}

function diagnosticReason(question: FoundationQuestion): string {
  if (question.role === "FALSE_POSITIVE" && !question.nonExploitabilityReason) {
    fail(
      "FALSE_POSITIVE_REASONING_MISSING",
      "question " + question.id + " has no false-positive reasoning",
    );
  }
  return question.role === "VULNERABLE"
    ? question.vulnerabilityReason ?? question.explanation
    : question.role === "SECURE"
      ? question.mitigationReason ?? question.explanation
      : question.nonExploitabilityReason as string;
}

function buildFeedback(question: FoundationQuestion): SwDiagnosticFeedback {
  return {
    classification: question.role,
    reason: diagnosticReason(question),
    vulnerabilityReason: question.vulnerabilityReason ?? null,
    mitigationReason: question.mitigationReason ?? null,
    nonExploitabilityReason: question.nonExploitabilityReason ?? null,
    assumptions: question.case.assumptions,
    evidence: question.case.evidence,
    validationOrTransformation: question.case.validationOrTransformation,
    diagnosticConclusion: question.answerKey.diagnosticConclusion,
    explanation: question.explanation,
  };
}

function buildPracticeContent(question: FoundationQuestion): string {
  return [
    question.stem,
    "Purpose: " + question.purpose,
    "Code (" + question.language + "):",
    question.case.code,
    "Source: " + question.case.source,
    "Validation or transformation: " +
      question.case.validationOrTransformation,
    "Sink or sensitive operation: " +
      question.case.sinkOrSensitiveOperation,
    "Assumptions: " + question.case.assumptions.join("; "),
    "Evidence: " + question.case.evidence.join(", "),
    "Educational boundary: " + question.safeEducationalBoundary,
  ].join("\n\n");
}

function toSharedGradingQuestion(
  question: SwQuestionProjection,
): GradingQuestion {
  if (!SW_DIAGNOSTIC_ROLES.includes(question.answerKey.verdict)) {
    fail(
      "GRADING_CONTRACT_MISMATCH",
      "question " + question.id + " has an unsupported grading verdict",
    );
  }
  return {
    type: "SHORT_ANSWER",
    choices: [],
    answerConfig: {
      ignoreCase: true,
      normalizeWhitespace: true,
      acceptedAnswers: [question.answerKey.verdict],
    },
  };
}

function toPracticeQuestion(
  question: FoundationQuestion,
  triadId: string,
): SwPracticeQuestion {
  return {
    id: question.id,
    runtimeId: runtimeKey("question", question.id),
    questionVersionId: null,
    title: question.topic + " diagnostic case",
    content: buildPracticeContent(question),
    type: "SHORT_ANSWER",
    difficulty: "ADVANCED",
    courseId: SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId,
    automaticGradingAvailable: true,
    choices: [],
    diagnosticRole: question.role,
    triadId,
    weaknessId: triadId.slice(triadId.lastIndexOf(":") + 1),
    topic: question.topic,
    purpose: question.purpose,
    stem: question.stem,
    case: question.case,
    language: question.language,
    safeEducationalBoundary: question.safeEducationalBoundary,
  };
}

function normalizeDiagnosis(
  answer: SubmittedAnswer,
): SwDiagnosticRole | "UNKNOWN" {
  const first = Array.isArray(answer) ? answer[0] : answer;
  const normalized = String(first ?? "").trim().toUpperCase();
  return SW_DIAGNOSTIC_ROLES.includes(normalized as SwDiagnosticRole)
    ? (normalized as SwDiagnosticRole)
    : "UNKNOWN";
}

function buildProjection(
  runtimeCourse: RuntimeCourseIdentity,
  foundation: CanonicalFoundation,
): SwRuntimeCourseProjection {
  validateRuntimeIdentity(runtimeCourse, foundation);

  const moduleIds = new Set(foundation.curriculum.map((module) => module.id));
  const triadIdByQuestionId = new Map<string, string>();
  const triadsById = new Map<string, FoundationTriad>();

  for (const triad of foundation.acceptedDiagnosticTriads) {
    const id =
      SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId +
      ":triad:" +
      triad.weaknessId;
    if (triadsById.has(id)) {
      fail("TRIAD_CROSS_CATEGORY", "duplicate triad identity " + id);
    }
    triadsById.set(id, triad);
    for (const questionId of triad.questionIds) {
      if (triadIdByQuestionId.has(questionId)) {
        fail(
          "TRIAD_DUPLICATE_ROLE",
          "question " + questionId + " is assigned to multiple triads",
        );
      }
      triadIdByQuestionId.set(questionId, id);
    }
  }

  const canonicalQuestionsById = new Map(
    foundation.questions.map((question) => [question.id, question]),
  );
  const questions: SwQuestionProjection[] = foundation.questions.map(
    (question) => {
      const triadId = triadIdByQuestionId.get(question.id);
      if (!triadId) {
        fail(
          "TRIAD_INCOMPLETE",
          "question " + question.id + " has no deterministic triad",
        );
      }
      return {
        id: question.id,
        runtimeId: runtimeKey("question", question.id),
        triadId,
        topic: question.topic,
        role: question.role,
        moduleId: question.moduleId,
        objectiveIds: question.objectiveIds,
        theoryId: question.theoryId,
        purpose: question.purpose,
        stem: question.stem,
        case: question.case,
        answerKey: question.answerKey,
        language: question.language,
        provenance: question.provenance,
        safeEducationalBoundary: question.safeEducationalBoundary,
        feedback: buildFeedback(question),
      };
    },
  );
  const questionProjectionById = new Map(
    questions.map((question) => [question.id, question]),
  );

  const triads: SwTriadProjection[] = foundation.acceptedDiagnosticTriads.map(
    (triad) => {
      const id =
        SW_SECURITY_WEAKNESS_RUNTIME_IDENTITY.courseId +
        ":triad:" +
        triad.weaknessId;
      const members = triad.questionIds.map((questionId) => {
        const rawQuestion = canonicalQuestionsById.get(questionId);
        const question = questionProjectionById.get(questionId);
        if (!rawQuestion || !question) {
          fail(
            "TRIAD_INCOMPLETE",
            "triad " + id + " references a missing question",
          );
        }
        return {
          questionId,
          role: rawQuestion.role,
          question,
        };
      });
      const roles = members.map((member) => member.role);
      if (
        roles.filter((role) => role === "VULNERABLE").length !== 1 ||
        roles.filter((role) => role === "SECURE").length !== 1 ||
        roles.filter((role) => role === "FALSE_POSITIVE").length !== 1
      ) {
        fail("TRIAD_DUPLICATE_ROLE", "triad " + id + " lost a distinct role");
      }
      if (
        new Set(members.map((member) => member.question.moduleId)).size !== 1
      ) {
        fail("TRIAD_CROSS_CATEGORY", "triad " + id + " crosses modules");
      }
      const moduleId = members[0].question.moduleId;
      if (!moduleIds.has(moduleId)) {
        fail("MODULE_MAPPING_CONFLICT", "triad " + id + " has an unknown module");
      }
      return {
        id,
        weaknessId: triad.weaknessId,
        topic: triad.topic,
        moduleId,
        questionIds: [
          triad.questionIds[0],
          triad.questionIds[1],
          triad.questionIds[2],
        ],
        members: [members[0], members[1], members[2]],
      };
    },
  );

  const practiceQuestions = questions.map((question) => {
    const rawQuestion = canonicalQuestionsById.get(question.id);
    if (!rawQuestion) {
      fail(
        "QUESTION_MAPPING_CONFLICT",
        "question " + question.id + " disappeared during projection",
      );
    }
    return toPracticeQuestion(rawQuestion, question.triadId);
  });
  const practiceById = new Map(
    practiceQuestions.map((question) => [question.id, question]),
  );
  const practiceTriads = triads.map((triad) => {
    const members = triad.questionIds.map((questionId) => {
      const question = practiceById.get(questionId);
      if (!question) {
        fail(
          "TRIAD_INCOMPLETE",
          "practice triad " + triad.id + " references a missing question",
        );
      }
      return question;
    });
    const practiceMembers: readonly [
      SwPracticeQuestion,
      SwPracticeQuestion,
      SwPracticeQuestion,
    ] = [members[0], members[1], members[2]];
    return {
      id: triad.id,
      weaknessId: triad.weaknessId,
      topic: triad.topic,
      members: practiceMembers,
    };
  });

  const visibility: SwRuntimeVisibility = runtimeCourse.published
    ? "PUBLISHED_CANONICAL"
    : "REGISTERED_UNPUBLISHED";

  return deepFreeze({
    course: {
      id: runtimeCourse.id,
      code: runtimeCourse.code,
      slug: runtimeCourse.slug,
      name: runtimeCourse.name,
      bindingKey: foundation.authority.curriculumAuthorityId,
      version: foundation.authority.curriculumAuthorityId,
      active: runtimeCourse.active,
      published: runtimeCourse.published,
      isSample: runtimeCourse.isSample,
      deletedAt: runtimeCourse.deletedAt ?? null,
      visibility,
    },
    counts: EXPECTED_COUNTS,
    modules: foundation.curriculum.map((module) => ({
      id: module.id,
      runtimeId: runtimeKey("module", module.id),
      title: module.title,
      order: module.order,
      objectiveIds: module.objectives,
    })),
    objectives: foundation.objectives.map((objective) => ({
      id: objective.id,
      runtimeId: runtimeKey("objective", objective.id),
      statement: objective.statement,
      moduleId: objective.moduleId,
    })),
    theory: foundation.theory.map((unit) => ({
      id: unit.id,
      runtimeId: runtimeKey("theory", unit.id),
      title: unit.title,
      moduleId: unit.moduleId,
      decision: unit.decision,
      provenance: unit.provenance,
      sourceRefs: unit.sourceRefs,
    })),
    questions,
    triads,
    practice: {
      questions: practiceQuestions,
      triads: practiceTriads,
    },
  });
}

/**
 * Server-owned runtime entrypoint. The Foundation source is fixed at module
 * scope; callers can supply runtime identity only, never a Foundation path.
 */
export function buildSwSecurityWeaknessRuntimeProjection(
  runtimeCourse: RuntimeCourseIdentity,
): SwRuntimeCourseProjection {
  if (!canonicalFoundation) {
    fail("FOUNDATION_NOT_FOUND", "fixed SW Foundation is unavailable");
  }
  const validatedFoundation = parseFoundation(canonicalFoundation);
  return buildProjection(runtimeCourse, validatedFoundation);
}

export function getSwSecurityWeaknessPracticeQuestion(
  runtimeCourse: RuntimeCourseIdentity,
  questionId: string,
): SwPracticeQuestion | null {
  const projection = buildSwSecurityWeaknessRuntimeProjection(runtimeCourse);
  return projection.practice.questions.find(
    (question) => question.id === questionId,
  ) ?? null;
}

export function gradeSwSecurityWeaknessQuestion(
  runtimeCourse: RuntimeCourseIdentity,
  questionId: string,
  answer: SubmittedAnswer,
): SwDiagnosticResult {
  const projection = buildSwSecurityWeaknessRuntimeProjection(runtimeCourse);
  const question = projection.questions.find((item) => item.id === questionId);
  if (!question) {
    fail(
      "QUESTION_MAPPING_CONFLICT",
      "question " + questionId + " is not in the canonical Foundation",
    );
  }

  let grade: GradeResult;
  try {
    grade = gradeQuestion(toSharedGradingQuestion(question), answer);
  } catch {
    fail(
      "GRADING_CONTRACT_MISMATCH",
      "shared grader rejected question " + question.id,
    );
  }
  if (!grade.supported) {
    fail(
      "GRADING_CONTRACT_MISMATCH",
      "shared grader does not support question " + question.id,
    );
  }

  return deepFreeze({
    questionId: question.id,
    triadId: question.triadId,
    caseRole: question.role,
    diagnosis: normalizeDiagnosis(answer),
    supported: grade.supported,
    isCorrect: grade.isCorrect,
    score: grade.score,
    normalizedAnswer: grade.normalizedAnswer,
    correctAnswer: grade.correctAnswer,
    feedback: question.feedback,
  });
}
