import { readFileSync } from "node:fs";
import { AppError } from "../errors.ts";

const FOUNDATION_ROOT = new URL(
  "../../content-drafts/secure-coding-8h-foundation/",
  import.meta.url,
);

const FOUNDATION_FILES = Object.freeze({
  manifest: "manifest.json",
  theory: "theory.json",
  objectives: "objectives.json",
  questions: "questions.json",
  diagnosticTriads: "diagnostic-triads.json",
  practicals: "practicals.json",
  futureRequirements: "future-requirements.json",
});

const EXPECTED = Object.freeze({
  courseId: "developer-secure-coding-8h-python-vibe",
  slug: "secure-coding-8h-python-vibe",
  candidateId: "securium-developer-secure-coding-8h-python-vibe-foundation-v1",
  title: "Securium Developer Secure Coding 8H",
  modules: 8,
  minutes: 480,
  objectives: 32,
  questions: 40,
  explanations: 40,
  codeExamples: 8,
  diagnosticTriads: 8,
  practicalSpecs: 8,
  executableLabs: 0,
});

export type SecureCoding8HRuntimeCourseContext = {
  id: string;
  slug: string;
  active: boolean;
  published: boolean;
  deletedAt?: string | null;
};

export type SecureCoding8HRuntimeAdapterInput = {
  runtimeCourse: SecureCoding8HRuntimeCourseContext;
  exposure: "registration" | "server-runtime";
};

export type SecureCoding8HRuntimeCounts = Readonly<{
  modules: number;
  minutes: number;
  objectives: number;
  questions: number;
  explanations: number;
  codeExamples: number;
  diagnosticTriads: number;
  practicalSpecs: number;
  executableLabs: number;
}>;

export type SecureCoding8HRuntimeModel = Readonly<{
  runtimeIdentity: Readonly<{
    courseId: typeof EXPECTED.courseId;
    slug: typeof EXPECTED.slug;
  }>;
  foundationIdentity: Readonly<{
    courseId: typeof EXPECTED.courseId;
    candidateId: typeof EXPECTED.candidateId;
  }>;
  display: Readonly<{
    name: typeof EXPECTED.title;
    shortName: "SC8H";
  }>;
  counts: SecureCoding8HRuntimeCounts;
  moduleIds: readonly string[];
  objectiveIds: readonly string[];
  questionIds: readonly string[];
  practicalIds: readonly string[];
  diagnosticTriadIds: readonly string[];
  practicalStatus: "SPEC_ONLY";
  exposure: SecureCoding8HRuntimeAdapterInput["exposure"];
  foundation: Readonly<Record<string, unknown>>;
}>;

/**
 * Binds the one approved runtime identity to the fixed Secure Coding
 * Foundation. This module has no database dependency and must only be
 * imported by server-side code.
 */
export function loadSecureCoding8HRuntimeModel(
  input: SecureCoding8HRuntimeAdapterInput,
): SecureCoding8HRuntimeModel {
  assertRuntimeContext(input);

  if (
    input.exposure === "server-runtime" &&
    (!input.runtimeCourse.active ||
      !input.runtimeCourse.published ||
      input.runtimeCourse.deletedAt != null)
  ) {
    throw new AppError(
      "The Secure Coding course is not publicly available.",
      404,
      "UNPUBLISHED_ACCESS_DENIED",
    );
  }

  if (
    input.exposure === "registration" &&
    (input.runtimeCourse.active || input.runtimeCourse.published || input.runtimeCourse.deletedAt != null)
  ) {
    throw new AppError(
      "Secure Coding registration must remain inactive and unpublished.",
      409,
      "UNPUBLISHED_ACCESS_DENIED",
    );
  }

  const bundle = loadFoundationBundle();
  const manifest = asRecord(bundle.manifest, "manifest");
  const identity = asRecord(
    manifest.canonicalCourseIdentity,
    "manifest.canonicalCourseIdentity",
  );

  if (
    identity.courseId !== EXPECTED.courseId ||
    manifest.candidateId !== EXPECTED.candidateId ||
    manifest.title !== EXPECTED.title
  ) {
    throw new AppError(
      "Secure Coding Foundation identity does not match the runtime contract.",
      409,
      "RUNTIME_IDENTITY_MISMATCH",
    );
  }

  const modules = arrayField(manifest, "modules", "manifest.modules");
  const objectives = arrayField(
    asRecord(bundle.objectives, "objectives"),
    "objectives",
    "objectives.objectives",
  );
  const questions = arrayField(
    asRecord(bundle.questions, "questions"),
    "questions",
    "questions.questions",
  );
  const theory = arrayField(
    asRecord(bundle.theory, "theory"),
    "theory",
    "theory.theory",
  );
  const triads = arrayField(
    asRecord(bundle.diagnosticTriads, "diagnostic-triads"),
    "triads",
    "diagnostic-triads.triads",
  );
  const practicals = arrayField(
    asRecord(bundle.practicals, "practicals"),
    "specifications",
    "practicals.specifications",
  );
  const futureRequirements = asRecord(
    bundle.futureRequirements,
    "future-requirements",
  );

  const moduleIds = sequentialIds(modules, "M", EXPECTED.modules, "MODULE_ID_CONFLICT");
  const objectiveIds = sequentialIds(
    objectives,
    "O",
    EXPECTED.objectives,
    "FOUNDATION_INVALID",
  );
  const questionIds = sequentialIds(
    questions,
    "Q",
    EXPECTED.questions,
    "QUESTION_ID_CONFLICT",
  );
  const practicalIds = sequentialIds(
    practicals,
    "P",
    EXPECTED.practicalSpecs,
    "FOUNDATION_INVALID",
  );
  const diagnosticTriadIds = uniqueIds(triads, "diagnostic triad");

  const minutes = modules.reduce<number>((total, item, index) => {
    const record = asRecord(item, `manifest.modules[${index}]`);
    return total + integerField(record, "minutes", `manifest.modules[${index}].minutes`);
  }, 0);
  const explanations = questions.filter((item, index) => {
    const record = asRecord(item, `questions.questions[${index}]`);
    return typeof record.explanation === "string" && record.explanation.trim() !== "";
  }).length;
  const codeExamples = theory.filter((item, index) => {
    const record = asRecord(item, `theory.theory[${index}]`);
    return (
      typeof record.pythonExample === "string" &&
      typeof record.vibeExample === "string"
    );
  }).length;
  const practicalStatuses = new Set(
    practicals.map((item, index) =>
      asRecord(item, `practicals.specifications[${index}]`).status,
    ),
  );
  const executableDeployment = asRecord(
    futureRequirements.executableLabRequirements,
    "future-requirements.executableLabRequirements",
  ).deploymentStatus;

  const counts: SecureCoding8HRuntimeCounts = Object.freeze({
    modules: modules.length,
    minutes,
    objectives: objectives.length,
    questions: questions.length,
    explanations,
    codeExamples,
    diagnosticTriads: triads.length,
    practicalSpecs: practicals.length,
    executableLabs: 0,
  });

  if (
    counts.modules !== EXPECTED.modules ||
    counts.minutes !== EXPECTED.minutes ||
    counts.objectives !== EXPECTED.objectives ||
    counts.questions !== EXPECTED.questions ||
    counts.explanations !== EXPECTED.explanations ||
    counts.codeExamples !== EXPECTED.codeExamples ||
    counts.diagnosticTriads !== EXPECTED.diagnosticTriads ||
    counts.practicalSpecs !== EXPECTED.practicalSpecs ||
    counts.executableLabs !== EXPECTED.executableLabs ||
    practicalStatuses.size !== 1 ||
    !practicalStatuses.has("SPEC_ONLY") ||
    executableDeployment !== "NOT_BUILT; NOT_DEPLOYED"
  ) {
    throw new AppError(
      "Secure Coding Foundation counts or execution status are invalid.",
      409,
      "COUNT_MISMATCH",
    );
  }

  const foundation = deepFreeze({
    manifest: bundle.manifest,
    theory: bundle.theory,
    objectives: bundle.objectives,
    questions: bundle.questions,
    diagnosticTriads: bundle.diagnosticTriads,
    practicals: bundle.practicals,
    futureRequirements: bundle.futureRequirements,
  });

  return Object.freeze({
    runtimeIdentity: Object.freeze({
      courseId: EXPECTED.courseId,
      slug: EXPECTED.slug,
    }),
    foundationIdentity: Object.freeze({
      courseId: EXPECTED.courseId,
      candidateId: EXPECTED.candidateId,
    }),
    display: Object.freeze({
      name: EXPECTED.title,
      shortName: "SC8H" as const,
    }),
    counts,
    moduleIds: Object.freeze(moduleIds),
    objectiveIds: Object.freeze(objectiveIds),
    questionIds: Object.freeze(questionIds),
    practicalIds: Object.freeze(practicalIds),
    diagnosticTriadIds: Object.freeze(diagnosticTriadIds),
    practicalStatus: "SPEC_ONLY" as const,
    exposure: input.exposure,
    foundation,
  });
}

function loadFoundationBundle() {
  return Object.fromEntries(
    Object.entries(FOUNDATION_FILES).map(([key, fileName]) => [
      key,
      readFoundationJson(fileName),
    ]),
  ) as Record<keyof typeof FOUNDATION_FILES, unknown>;
}

function readFoundationJson(fileName: string): unknown {
  try {
    return JSON.parse(readFileSync(new URL(fileName, FOUNDATION_ROOT), "utf8"));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new AppError(
        "The Secure Coding Foundation was not found.",
        404,
        "FOUNDATION_NOT_FOUND",
      );
    }
    throw new AppError(
      "The Secure Coding Foundation could not be loaded.",
      409,
      "FOUNDATION_INVALID",
    );
  }
}

function assertRuntimeContext(input: SecureCoding8HRuntimeAdapterInput): void {
  if (!input || typeof input !== "object") {
    throw new AppError("Runtime course context is required.", 400, "INTERNAL_ERROR");
  }
  if (
    !input.runtimeCourse ||
    typeof input.runtimeCourse.id !== "string" ||
    typeof input.runtimeCourse.slug !== "string" ||
    typeof input.runtimeCourse.active !== "boolean" ||
    typeof input.runtimeCourse.published !== "boolean" ||
    (input.runtimeCourse.deletedAt !== undefined &&
      input.runtimeCourse.deletedAt !== null &&
      typeof input.runtimeCourse.deletedAt !== "string")
  ) {
    throw new AppError("Runtime course context is invalid.", 400, "INTERNAL_ERROR");
  }
  if (input.runtimeCourse.id !== EXPECTED.courseId) {
    throw new AppError(
      "Runtime course identity does not match Secure Coding Foundation.",
      409,
      "RUNTIME_IDENTITY_MISMATCH",
    );
  }
  if (input.runtimeCourse.slug !== EXPECTED.slug) {
    throw new AppError(
      "Runtime course slug does not match Secure Coding Foundation.",
      409,
      "RUNTIME_IDENTITY_MISMATCH",
    );
  }
  if (input.exposure !== "registration" && input.exposure !== "server-runtime") {
    throw new AppError("Runtime exposure is invalid.", 400, "INTERNAL_ERROR");
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(`Foundation ${label} is invalid.`, 409, "FOUNDATION_INVALID");
  }
  return value as Record<string, unknown>;
}

function arrayField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): unknown[] {
  if (!Array.isArray(record[key])) {
    throw new AppError(`Foundation ${label} is invalid.`, 409, "FOUNDATION_INVALID");
  }
  return record[key] as unknown[];
}

function integerField(
  record: Record<string, unknown>,
  key: string,
  label: string,
): number {
  if (!Number.isInteger(record[key])) {
    throw new AppError(`Foundation ${label} is invalid.`, 409, "FOUNDATION_INVALID");
  }
  return record[key] as number;
}

function sequentialIds(
  items: unknown[],
  prefix: string,
  expectedLength: number,
  errorCode: "FOUNDATION_INVALID" | "MODULE_ID_CONFLICT" | "QUESTION_ID_CONFLICT",
): string[] {
  if (items.length !== expectedLength) {
    throw new AppError("Foundation identity cardinality is invalid.", 409, errorCode);
  }
  const ids = items.map((item, index) => {
    const id = asRecord(item, `${prefix}[${index}]`).id;
    return typeof id === "string" ? id : "";
  });
  const expected = ids.map((_, index) => `${prefix}${String(index + 1).padStart(2, "0")}`);
  if (
    ids.some((id, index) => id !== expected[index]) ||
    new Set(ids).size !== ids.length
  ) {
    throw new AppError("Foundation IDs are duplicated or out of order.", 409, errorCode);
  }
  return ids;
}

function uniqueIds(items: unknown[], label: string): string[] {
  const ids = items.map((item, index) => {
    const id = asRecord(item, `${label}[${index}]`).id;
    if (typeof id !== "string" || id.trim() === "") {
      throw new AppError(`${label} identity is invalid.`, 409, "FOUNDATION_INVALID");
    }
    return id;
  });
  if (new Set(ids).size !== ids.length) {
    throw new AppError(`${label} identities are duplicated.`, 409, "FOUNDATION_INVALID");
  }
  return ids;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
