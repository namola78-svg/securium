import { AppError } from "../errors.ts";
import {
  assertSecureCoding8HQuestionRuntimeMapping,
  buildSecureCoding8HQuestionRuntimeMapping,
  secureCoding8HRuntimeQuestionId,
  secureCoding8HRuntimeQuestionVersionId,
  type SecureCoding8HRuntimeQuestionChoice,
  type SecureCoding8HRuntimeQuestionMapping,
  type SecureCoding8HRuntimeQuestionMappingManifest,
} from "./secure-coding-8h-question-runtime-mapping.ts";
import {
  loadSecureCoding8HRuntimeModel,
  type SecureCoding8HRuntimeModel,
} from "./secure-coding-8h-runtime-adapter.ts";
import { sha256Canonical } from "../policy/stable-canonical-hash.ts";

export const SECURE_CODING_8H_QUESTION_PREFLIGHT_CONTRACT_V1 =
  "SECURIUM_SECURE_CODING_8H_QUESTION_PREFLIGHT_V1" as const;
export const SECURE_CODING_8H_SOURCE_SNAPSHOT_CONTRACT_V1 =
  "SECURIUM_SECURE_CODING_8H_SOURCE_SNAPSHOT_V1" as const;
export const SECURE_CODING_8H_QUESTION_MATERIALIZATION_ACTION =
  "MATERIALIZE_QUESTION_DEFINITIONS" as const;

const COURSE_ID = "developer-secure-coding-8h-python-vibe" as const;
const COURSE_SLUG = "secure-coding-8h-python-vibe" as const;
const FOUNDATION_CANDIDATE_ID =
  "securium-developer-secure-coding-8h-python-vibe-foundation-v1" as const;
const FOUNDATION_VERSION = "v1" as const;
const EXPECTED_QUESTION_COUNT = 40;
const EXPECTED_CHOICE_COUNT = 160;
const EXPECTED_VERSION_COUNT = 40;
const EXPECTED_COURSE_BINDING_COUNT = 40;

type PreflightInputObject = Readonly<{
  candidateMapping?: unknown;
  submittedPayloadHash?: unknown;
  expectedRevision?: unknown;
  expectedSource?: unknown;
  requestedAction?: unknown;
}>;

export type SecureCoding8HQuestionMaterializationPreflightInput =
  PreflightInputObject;

export type SecureCoding8HQuestionMaterializationCounts = Readonly<{
  questions: number;
  choices: number;
  versions: number;
  courseBindings: number;
}>;

export type SecureCoding8HQuestionMaterializationPreflight = Readonly<{
  contractVersion: typeof SECURE_CODING_8H_QUESTION_PREFLIGHT_CONTRACT_V1;
  requestedAction: typeof SECURE_CODING_8H_QUESTION_MATERIALIZATION_ACTION;
  courseId: typeof COURSE_ID;
  courseSlug: typeof COURSE_SLUG;
  counts: SecureCoding8HQuestionMaterializationCounts;
  projectionStatus: "VERIFIED";
  foundationStatus: "VERIFIED";
  sourceRevisionStatus: "VERIFIED";
  sourceBindingStatus: "UNKNOWN";
  approvalStatus: "UNKNOWN";
  preflightStatus: "BLOCKED";
  persistenceStatus: "NOT_READY";
  runtimeMutation: "NOT_EXECUTED";
  blockers: readonly [
    "SOURCE_BINDING_AUTHORITY_UNAVAILABLE",
    "APPROVAL_AUTHORITY_UNAVAILABLE",
  ];
  approvalTarget: Readonly<{
    action: typeof SECURE_CODING_8H_QUESTION_MATERIALIZATION_ACTION;
    courseId: typeof COURSE_ID;
    candidateId: typeof FOUNDATION_CANDIDATE_ID;
    foundationVersion: typeof FOUNDATION_VERSION;
    payloadHash: string;
  }>;
  source: Readonly<{
    contractVersion: typeof SECURE_CODING_8H_SOURCE_SNAPSHOT_CONTRACT_V1;
    candidateId: typeof FOUNDATION_CANDIDATE_ID;
    foundationVersion: typeof FOUNDATION_VERSION;
    manifestHash: string;
    revisionBindingHash: string;
  }>;
  payload: Readonly<{
    canonicalHash: string;
    submittedHash: string | null;
    questionSemanticHashes: readonly Readonly<{
      foundationQuestionId: string;
      runtimeQuestionId: string;
      runtimeQuestionVersionId: string;
      semanticHash: string;
    }>[];
  }>;
  questionRows: readonly SecureCoding8HQuestionMaterializationQuestionRow[];
  choiceRows: readonly SecureCoding8HQuestionMaterializationChoiceRow[];
  versionRows: readonly SecureCoding8HQuestionMaterializationVersionRow[];
  courseBindingRows: readonly SecureCoding8HQuestionMaterializationCourseBindingRow[];
}>;

export type SecureCoding8HQuestionMaterializationQuestionRow = Readonly<{
  id: string;
  title: string;
  content: string;
  type: "SINGLE_CHOICE";
  difficulty: "MEDIUM";
  explanation: string;
  wrongAnswerExplanation: "";
  status: "DRAFT";
  source: "SECURIUM_INDEPENDENTLY_AUTHORED";
  sourceDate: null;
  version: 1;
  answerConfigJson: "{}";
  isSample: false;
}>;

export type SecureCoding8HQuestionMaterializationChoiceRow =
  SecureCoding8HRuntimeQuestionChoice;

export type SecureCoding8HQuestionMaterializationVersionRow = Readonly<{
  id: string;
  questionId: string;
  version: 1;
  snapshotJson: string;
  semanticHash: string;
  blueprintId: null;
  qualificationJson: null;
  provenanceJson: string;
  governanceJson: null;
  humanReviewHash: null;
}>;

export type SecureCoding8HQuestionMaterializationCourseBindingRow = Readonly<{
  questionId: string;
  courseId: typeof COURSE_ID;
  weight: 100;
}>;

/**
 * Builds a DB-free materialization plan from the fixed Foundation authority.
 *
 * The public input is deliberately limited to untrusted comparison data. It
 * cannot provide approval, source binding, or a verifier. The canonical
 * mapping and source snapshot are loaded inside this function, and the result
 * remains blocked because this repository has no Runtime approval/source
 * authority for this course.
 */
export async function preflightSecureCoding8HQuestionMaterialization(
  input?: SecureCoding8HQuestionMaterializationPreflightInput,
): Promise<SecureCoding8HQuestionMaterializationPreflight> {
  const snapshot = snapshotInput(input);
  const model = loadSecureCoding8HRuntimeModel({
    runtimeCourse: {
      id: COURSE_ID,
      slug: COURSE_SLUG,
      active: false,
      published: false,
      deletedAt: null,
    },
    exposure: "registration",
  });
  const canonicalMapping = await buildSecureCoding8HQuestionRuntimeMapping();
  await assertSecureCoding8HQuestionRuntimeMapping(canonicalMapping, model);
  assertCanonicalProjectionShape(canonicalMapping);

  const expectedRevision = parseExpectedRevision(snapshot?.expectedRevision);
  if (
    expectedRevision &&
    (expectedRevision.candidateId !== FOUNDATION_CANDIDATE_ID ||
      expectedRevision.version !== FOUNDATION_VERSION)
  ) {
    throw new AppError(
      "Secure Coding Foundation revision does not match the trusted authority.",
      409,
      "FOUNDATION_REVISION_MISMATCH",
    );
  }

  const requestedAction = parseRequestedAction(snapshot?.requestedAction);
  const expectedSource = parseExpectedSource(snapshot?.expectedSource);
  const source = await buildSourceSnapshot(model, canonicalMapping);
  if (
    expectedSource &&
    (expectedSource.candidateId !== source.candidateId ||
      expectedSource.foundationVersion !== source.foundationVersion ||
      expectedSource.manifestHash !== source.manifestHash ||
      expectedSource.revisionBindingHash !== source.revisionBindingHash)
  ) {
    throw new AppError(
      "Secure Coding source snapshot does not match the trusted Foundation.",
      409,
      "SOURCE_MANIFEST_MISMATCH",
    );
  }

  const candidateMapping = snapshot?.candidateMapping;
  if (candidateMapping !== undefined) {
    await assertSecureCoding8HQuestionRuntimeMapping(
      candidateMapping as SecureCoding8HRuntimeQuestionMappingManifest,
      model,
    );
  }

  const canonicalHash = await computeCanonicalPayloadHash(
    canonicalMapping,
    source,
    requestedAction,
  );
  const submittedHash = parseSubmittedPayloadHash(snapshot?.submittedPayloadHash);
  if (submittedHash !== null && submittedHash !== canonicalHash) {
    throw new AppError(
      "Submitted materialization payload hash does not match the trusted projection.",
      409,
      "PAYLOAD_HASH_MISMATCH",
    );
  }

  const questionRows = canonicalMapping.mappings.map((mapping) => mapping.question);
  const choiceRows = canonicalMapping.mappings.flatMap((mapping) => mapping.choices);
  const versionRows = canonicalMapping.mappings.map((mapping) => mapping.version);
  const courseBindingRows = canonicalMapping.mappings.map(
    (mapping) => mapping.courseBinding,
  );
  const counts = Object.freeze({
    questions: questionRows.length,
    choices: choiceRows.length,
    versions: versionRows.length,
    courseBindings: courseBindingRows.length,
  });
  const questionSemanticHashes = canonicalMapping.mappings.map((mapping) =>
    Object.freeze({
      foundationQuestionId: mapping.foundationQuestionId,
      runtimeQuestionId: mapping.runtimeQuestionId,
      runtimeQuestionVersionId: mapping.runtimeQuestionVersionId,
      semanticHash: mapping.semanticHash,
    }),
  );

  return deepFreeze({
    contractVersion: SECURE_CODING_8H_QUESTION_PREFLIGHT_CONTRACT_V1,
    requestedAction,
    courseId: COURSE_ID,
    courseSlug: COURSE_SLUG,
    counts,
    projectionStatus: "VERIFIED",
    foundationStatus: "VERIFIED",
    sourceRevisionStatus: "VERIFIED",
    sourceBindingStatus: "UNKNOWN",
    approvalStatus: "UNKNOWN",
    preflightStatus: "BLOCKED",
    persistenceStatus: "NOT_READY",
    runtimeMutation: "NOT_EXECUTED",
    blockers: [
      "SOURCE_BINDING_AUTHORITY_UNAVAILABLE",
      "APPROVAL_AUTHORITY_UNAVAILABLE",
    ] as const,
    approvalTarget: {
      action: requestedAction,
      courseId: COURSE_ID,
      candidateId: FOUNDATION_CANDIDATE_ID,
      foundationVersion: FOUNDATION_VERSION,
      payloadHash: canonicalHash,
    },
    source,
    payload: {
      canonicalHash,
      submittedHash,
      questionSemanticHashes,
    },
    questionRows: [...questionRows],
    choiceRows: [...choiceRows],
    versionRows: [...versionRows],
    courseBindingRows: [...courseBindingRows],
  });
}

async function buildSourceSnapshot(
  model: SecureCoding8HRuntimeModel,
  mapping: SecureCoding8HRuntimeQuestionMappingManifest,
) {
  const manifest = model.foundation.manifest;
  assertJsonSafe(manifest, "Foundation manifest");
  const manifestHash = await sha256Canonical({
    contractVersion: SECURE_CODING_8H_SOURCE_SNAPSHOT_CONTRACT_V1,
    candidateId: FOUNDATION_CANDIDATE_ID,
    foundationVersion: FOUNDATION_VERSION,
    manifest,
  });
  const revisionBindingHash = await sha256Canonical({
    contractVersion: SECURE_CODING_8H_SOURCE_SNAPSHOT_CONTRACT_V1,
    candidateId: FOUNDATION_CANDIDATE_ID,
    foundationVersion: FOUNDATION_VERSION,
    manifestHash,
    questions: mapping.mappings.map((entry) => ({
      foundationQuestionId: entry.foundationQuestionId,
      runtimeQuestionId: entry.runtimeQuestionId,
      runtimeQuestionVersionId: entry.runtimeQuestionVersionId,
      sourceSemanticHash: entry.semanticHash,
    })),
  });
  return Object.freeze({
    contractVersion: SECURE_CODING_8H_SOURCE_SNAPSHOT_CONTRACT_V1,
    candidateId: FOUNDATION_CANDIDATE_ID,
    foundationVersion: FOUNDATION_VERSION,
    manifestHash,
    revisionBindingHash,
  });
}

async function computeCanonicalPayloadHash(
  mapping: SecureCoding8HRuntimeQuestionMappingManifest,
  source: Awaited<ReturnType<typeof buildSourceSnapshot>>,
  requestedAction: typeof SECURE_CODING_8H_QUESTION_MATERIALIZATION_ACTION,
) {
  return sha256Canonical({
    contractVersion: SECURE_CODING_8H_QUESTION_PREFLIGHT_CONTRACT_V1,
    requestedAction,
    course: {
      id: mapping.courseId,
      slug: mapping.courseSlug,
    },
    foundation: {
      candidateId: mapping.foundationCandidateId,
      version: mapping.foundationVersion,
    },
    source: {
      manifestHash: source.manifestHash,
      revisionBindingHash: source.revisionBindingHash,
    },
    mappings: mapping.mappings.map((entry) => ({
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
}

function assertCanonicalProjectionShape(
  mapping: SecureCoding8HRuntimeQuestionMappingManifest,
): void {
  if (
    mapping.questionCount !== EXPECTED_QUESTION_COUNT ||
    mapping.mappings.length !== EXPECTED_QUESTION_COUNT
  ) {
    throw new AppError(
      "Secure Coding materialization projection cardinality is invalid.",
      409,
      "PROJECTION_COUNT_MISMATCH",
    );
  }

  const choiceCount = mapping.mappings.reduce(
    (count, entry) => count + entry.choices.length,
    0,
  );
  const versionCount = mapping.mappings.filter(
    (entry) => entry.version.version === 1,
  ).length;
  const courseBindingCount = mapping.mappings.filter(
    (entry) =>
      entry.courseBinding.courseId === COURSE_ID &&
      entry.courseBinding.weight === 100,
  ).length;
  if (
    choiceCount !== EXPECTED_CHOICE_COUNT ||
    versionCount !== EXPECTED_VERSION_COUNT ||
    courseBindingCount !== EXPECTED_COURSE_BINDING_COUNT
  ) {
    throw new AppError(
      "Secure Coding materialization projection row counts are invalid.",
      409,
      "PROJECTION_COUNT_MISMATCH",
    );
  }

  const seenQuestionIds = new Set<string>();
  const seenVersionIds = new Set<string>();
  const seenChoiceIds = new Set<string>();
  for (const [index, entry] of mapping.mappings.entries()) {
    const foundationQuestionId = `Q${String(index + 1).padStart(2, "0")}`;
    const runtimeQuestionId = secureCoding8HRuntimeQuestionId(foundationQuestionId);
    const runtimeVersionId = secureCoding8HRuntimeQuestionVersionId(
      foundationQuestionId,
      1,
    );
    if (
      entry.foundationQuestionId !== foundationQuestionId ||
      entry.runtimeQuestionId !== runtimeQuestionId ||
      entry.runtimeQuestionVersionId !== runtimeVersionId ||
      entry.question.id !== runtimeQuestionId ||
      entry.version.id !== runtimeVersionId ||
      entry.version.questionId !== runtimeQuestionId ||
      entry.courseBinding.questionId !== runtimeQuestionId ||
      entry.courseBinding.courseId !== COURSE_ID ||
      entry.courseBinding.weight !== 100 ||
      entry.question.status !== "DRAFT" ||
      entry.question.isSample !== false
    ) {
      throw new AppError(
        "Secure Coding materialization identity or lifecycle is invalid.",
        409,
        "PROJECTION_IDENTITY_MISMATCH",
      );
    }
    if (
      seenQuestionIds.has(entry.runtimeQuestionId) ||
      seenVersionIds.has(entry.runtimeQuestionVersionId)
    ) {
      throw new AppError(
        "Secure Coding materialization identities are duplicated.",
        409,
        "PROJECTION_DUPLICATE_IDENTITY",
      );
    }
    seenQuestionIds.add(entry.runtimeQuestionId);
    seenVersionIds.add(entry.runtimeQuestionVersionId);
    if (entry.choices.length !== 4) {
      throw new AppError(
        "Secure Coding materialization choice cardinality is invalid.",
        409,
        "PROJECTION_COUNT_MISMATCH",
      );
    }
    const correctChoices = entry.choices.filter((choice) => choice.isCorrect);
    if (correctChoices.length !== 1) {
      throw new AppError(
        "Secure Coding materialization answer binding is invalid.",
        409,
        "PROJECTION_ANSWER_MISMATCH",
      );
    }
    for (const [choiceIndex, choice] of entry.choices.entries()) {
      const expectedChoiceId = `${runtimeQuestionId}-choice-${String(
        choiceIndex + 1,
      ).padStart(2, "0")}`;
      if (
        choice.id !== expectedChoiceId ||
        choice.questionId !== runtimeQuestionId ||
        choice.displayOrder !== choiceIndex + 1 ||
        seenChoiceIds.has(choice.id)
      ) {
        throw new AppError(
          "Secure Coding materialization choice identity is invalid.",
          409,
          "PROJECTION_CHOICE_MISMATCH",
        );
      }
      seenChoiceIds.add(choice.id);
    }
  }
}

function snapshotInput(
  input: SecureCoding8HQuestionMaterializationPreflightInput | undefined,
): PreflightInputObject | undefined {
  if (input === undefined) return undefined;
  assertJsonSafe(input, "preflight input");
  if (!isRecord(input)) {
    throw new AppError(
      "Secure Coding preflight input must be an object.",
      400,
      "PREFLIGHT_INPUT_INVALID",
    );
  }
  assertExactKeys(
    input,
    [
      "candidateMapping",
      "submittedPayloadHash",
      "expectedRevision",
      "expectedSource",
      "requestedAction",
    ],
    "PREFLIGHT_INPUT_INVALID",
  );
  try {
    return structuredClone(input) as PreflightInputObject;
  } catch {
    throw new AppError(
      "Secure Coding preflight input could not be snapshotted.",
      400,
      "PREFLIGHT_INPUT_INVALID",
    );
  }
}

function parseRequestedAction(
  value: unknown,
): typeof SECURE_CODING_8H_QUESTION_MATERIALIZATION_ACTION {
  if (value === undefined) return SECURE_CODING_8H_QUESTION_MATERIALIZATION_ACTION;
  if (value !== SECURE_CODING_8H_QUESTION_MATERIALIZATION_ACTION) {
    throw new AppError(
      "Secure Coding preflight action is unsupported.",
      409,
      "PREFLIGHT_ACTION_UNSUPPORTED",
    );
  }
  return value;
}

function parseExpectedRevision(value: unknown):
  | Readonly<{ candidateId: string; version: string }>
  | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new AppError(
      "Secure Coding expected Foundation revision is invalid.",
      400,
      "FOUNDATION_REVISION_INVALID",
    );
  }
  assertExactKeys(value, ["candidateId", "version"], "FOUNDATION_REVISION_INVALID");
  if (typeof value.candidateId !== "string" || typeof value.version !== "string") {
    throw new AppError(
      "Secure Coding expected Foundation revision is invalid.",
      400,
      "FOUNDATION_REVISION_INVALID",
    );
  }
  return { candidateId: value.candidateId, version: value.version };
}

function parseExpectedSource(value: unknown):
  | Readonly<{
      contractVersion: typeof SECURE_CODING_8H_SOURCE_SNAPSHOT_CONTRACT_V1;
      candidateId: string;
      foundationVersion: string;
      manifestHash: string;
      revisionBindingHash: string;
    }>
  | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new AppError(
      "Secure Coding expected source snapshot is invalid.",
      400,
      "SOURCE_SNAPSHOT_INVALID",
    );
  }
  assertExactKeys(
    value,
    [
      "contractVersion",
      "candidateId",
      "foundationVersion",
      "manifestHash",
      "revisionBindingHash",
    ],
    "SOURCE_SNAPSHOT_INVALID",
  );
  if (
    value.contractVersion !== SECURE_CODING_8H_SOURCE_SNAPSHOT_CONTRACT_V1 ||
    typeof value.candidateId !== "string" ||
    typeof value.foundationVersion !== "string" ||
    !isSha256(value.manifestHash) ||
    !isSha256(value.revisionBindingHash)
  ) {
    throw new AppError(
      "Secure Coding expected source snapshot is invalid.",
      400,
      "SOURCE_SNAPSHOT_INVALID",
    );
  }
  return {
    contractVersion: SECURE_CODING_8H_SOURCE_SNAPSHOT_CONTRACT_V1,
    candidateId: value.candidateId,
    foundationVersion: value.foundationVersion,
    manifestHash: value.manifestHash,
    revisionBindingHash: value.revisionBindingHash,
  };
}

function parseSubmittedPayloadHash(value: unknown): string | null {
  if (value === undefined) return null;
  if (!isSha256(value)) {
    throw new AppError(
      "Secure Coding submitted payload hash is invalid.",
      400,
      "PAYLOAD_HASH_INVALID",
    );
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  code: string,
): void {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new AppError(
      "Untrusted approval or source authority input is not accepted by this contract.",
      400,
      code === "PREFLIGHT_INPUT_INVALID"
        ? "UNTRUSTED_AUTHORITY_INPUT"
        : code,
    );
  }
}

function assertJsonSafe(value: unknown, label: string, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new AppError(`${label} contains a non-finite number.`, 400, "PREFLIGHT_INPUT_INVALID");
    }
    return;
  }
  if (typeof value === "undefined" || typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
    throw new AppError(`${label} contains a value that is not JSON-safe.`, 400, "PREFLIGHT_INPUT_INVALID");
  }
  if (typeof value !== "object") {
    throw new AppError(`${label} contains an unsupported value.`, 400, "PREFLIGHT_INPUT_INVALID");
  }
  if (ancestors.has(value)) {
    throw new AppError(`${label} contains a cyclic value.`, 400, "PREFLIGHT_INPUT_INVALID");
  }
  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new AppError(`${label} contains a non-plain object.`, 400, "PREFLIGHT_INPUT_INVALID");
    }
  }
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertJsonSafe(child, `${label}[${index}]`, nextAncestors));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assertJsonSafe(child, `${label}.${key}`, nextAncestors);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
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
