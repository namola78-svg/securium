import {
  DEFINITION_LIFECYCLES,
  isAssessmentObjectiveId,
  requireStableReference,
  requireStableSemanticSegment,
  type DefinitionLifecycle,
} from "../assessment/assessment-objective.ts";

export const PRACTICAL_CLASSIFICATIONS = [
  "DEV_SAMPLE",
  "DRAFT",
  "REVIEWED_CANDIDATE",
  "CANONICAL_ACTIVE",
  "EXCLUDED",
] as const;
export type PracticalClassification =
  (typeof PRACTICAL_CLASSIFICATIONS)[number];

export const ASSESSMENT_ARTIFACT_TYPES = [
  "TEXT_SCENARIO",
  "CODE",
  "TABLE",
  "CONFIG",
  "LOG",
  "API_CONTRACT",
  "DATA_FLOW",
] as const;
export type AssessmentArtifactType =
  (typeof ASSESSMENT_ARTIFACT_TYPES)[number];

export const LEARNER_RESPONSE_TYPES = [
  "SELECTED_OPTION",
  "CLASSIFICATION",
  "FREE_TEXT",
  "CODE",
  "STRUCTURED_FIELDS",
] as const;
export type LearnerResponseType = (typeof LEARNER_RESPONSE_TYPES)[number];

export const MAX_SUPPORTING_OBJECTIVES = 8;

export type Practical = Readonly<{
  id: string;
  namespace: string;
  intentKey: string;
  classification: PracticalClassification;
  lifecycle: DefinitionLifecycle;
}>;

export type PracticalObjectiveBinding = Readonly<{
  objectiveId: string;
  role: "PRIMARY" | "SUPPORTING";
  order: number;
}>;

export type ResponseComponentSpec = Readonly<{
  key: string;
  type: LearnerResponseType;
  required: boolean;
  classificationSchemeId?: string;
}>;

export type ArtifactDigest = Readonly<{
  algorithm: "SHA-256";
  value: string;
}>;

export type CodeArtifactFile = Readonly<{
  logicalKey: string;
  displayName?: string;
  content: string;
  digest?: ArtifactDigest;
  lineAnchors: readonly Readonly<{ key: string; start: number; end: number }>[];
}>;

type ArtifactBase = Readonly<{
  id: string;
  roleKey: string;
  digest: ArtifactDigest;
  label?: string;
  description?: string;
}>;

export type CodeAssessmentArtifact = ArtifactBase &
  Readonly<{
    type: "CODE";
    languageId: string;
    runtimeHint?: string;
    executionCapability: "STATIC_ONLY";
    files: readonly CodeArtifactFile[];
  }>;

export type TextAssessmentArtifact = ArtifactBase &
  Readonly<{
    type: "TEXT_SCENARIO" | "CONFIG" | "LOG" | "API_CONTRACT";
    content: string;
  }>;

export type TableAssessmentArtifact = ArtifactBase &
  Readonly<{
    type: "TABLE";
    columns: readonly string[];
    rows: readonly (readonly string[])[];
  }>;

export type DataFlowAssessmentArtifact = ArtifactBase &
  Readonly<{
    type: "DATA_FLOW";
    nodes: readonly Readonly<{ id: string; label: string }>[];
    edges: readonly Readonly<{ from: string; to: string; label?: string }>[];
  }>;

export type AssessmentArtifact =
  | CodeAssessmentArtifact
  | TextAssessmentArtifact
  | TableAssessmentArtifact
  | DataFlowAssessmentArtifact;

export type PracticalVersion = Readonly<{
  id: string;
  practicalId: string;
  version: number;
  scenario: string;
  instructions: string;
  objectiveBindings: readonly PracticalObjectiveBinding[];
  artifactIds: readonly string[];
  responseSpec: readonly ResponseComponentSpec[];
  rubricVersionId: string;
  explanation: Readonly<{
    expectedDiagnosis?: string;
    classificationReasoning?: string;
    rootCause?: string;
    remediationRationale?: string;
    secureImplementationNotes?: string;
    alternativeInterpretation?: string;
  }>;
  provenanceReference?: string;
  currentnessReference?: string;
  criterionReferences: readonly string[];
  payloadDigest: ArtifactDigest;
}>;

export type PracticalPlacement = Readonly<{
  id: string;
  courseId: string;
  curriculumTreeVersionId: string;
  objectivePlacementId: string;
  practicalId: string;
  contributionRole: "PRIMARY" | "SUPPORTING";
  order: number;
}>;

export type SelectedOptionResponse = Readonly<{
  key: string;
  type: "SELECTED_OPTION";
  optionIds: readonly string[];
}>;
export type ClassificationResponse = Readonly<{
  key: string;
  type: "CLASSIFICATION";
  schemeId: string;
  value: string;
}>;
export type FreeTextResponse = Readonly<{
  key: string;
  type: "FREE_TEXT";
  value: string;
}>;
export type CodeResponse = Readonly<{
  key: string;
  type: "CODE";
  languageId: string;
  files: readonly Readonly<{ logicalKey: string; content: string }>[];
}>;
export type StructuredFieldsResponse = Readonly<{
  key: string;
  type: "STRUCTURED_FIELDS";
  fields: Readonly<Record<string, string | number | boolean | null | readonly string[]>>;
}>;

export type LearnerResponseComponent =
  | SelectedOptionResponse
  | ClassificationResponse
  | FreeTextResponse
  | CodeResponse
  | StructuredFieldsResponse;

export type PracticalChangeKind =
  | "UNRELEASED_TYPO_OR_FORMATTING"
  | "RELEASED_TYPO_OR_FORMATTING"
  | "ARTIFACT_PAYLOAD"
  | "CURRENT_FACT_BINDING"
  | "EXPECTED_ANSWER"
  | "RUBRIC_LINKAGE"
  | "CAPABILITY"
  | "ASSESSMENT_PURPOSE"
  | "FUNDAMENTAL_CRITERION_MEANING";

const PRACTICAL_ID = /^practical:([a-z0-9][a-z0-9._-]*):([a-z0-9][a-z0-9._-]*)$/;
const SHA256 = /^[a-f0-9]{64}$/;

function fail(code: string): never {
  throw new TypeError(code);
}

function requireIdentityTupleComponent(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 240 ||
    value.trim() !== value
  ) {
    return fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

function encodeIdentityTuple(components: readonly string[]): string {
  return JSON.stringify(components);
}

function requireNonnegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    return fail(`INVALID_${field.toUpperCase()}`);
  }
  return value as number;
}

function requireDigest(value: unknown): ArtifactDigest {
  if (!value || typeof value !== "object") fail("INVALID_DIGEST");
  const digest = value as Record<string, unknown>;
  if (digest.algorithm !== "SHA-256" || typeof digest.value !== "string" || !SHA256.test(digest.value)) {
    fail("INVALID_DIGEST");
  }
  return Object.freeze({ algorithm: "SHA-256", value: digest.value });
}

function uniqueReferences(values: unknown, field: string): readonly string[] {
  if (!Array.isArray(values)) fail(`INVALID_${field.toUpperCase()}`);
  const result = values.map((value) => requireStableReference(value, field));
  if (new Set(result).size !== result.length) fail(`DUPLICATE_${field.toUpperCase()}`);
  return Object.freeze([...result]);
}

export function buildPracticalId(namespace: unknown, intentKey: unknown): string {
  return `practical:${requireStableSemanticSegment(namespace, "practical_namespace")}:${requireStableSemanticSegment(intentKey, "practical_intent_key")}`;
}

export function isPracticalId(value: unknown): value is string {
  return typeof value === "string" && PRACTICAL_ID.test(value);
}

export function createPractical(input: {
  namespace: unknown;
  intentKey: unknown;
  classification: unknown;
  lifecycle: unknown;
}): Practical {
  if (!PRACTICAL_CLASSIFICATIONS.includes(input.classification as PracticalClassification)) {
    fail("INVALID_PRACTICAL_CLASSIFICATION");
  }
  if (!DEFINITION_LIFECYCLES.includes(input.lifecycle as DefinitionLifecycle)) {
    fail("INVALID_DEFINITION_LIFECYCLE");
  }
  const id = buildPracticalId(input.namespace, input.intentKey);
  const [, namespace, intentKey] = PRACTICAL_ID.exec(id) ?? [];
  return Object.freeze({
    id,
    namespace,
    intentKey,
    classification: input.classification as PracticalClassification,
    lifecycle: input.lifecycle as DefinitionLifecycle,
  });
}

export function normalizePracticalObjectiveBindings(
  value: unknown,
): readonly PracticalObjectiveBinding[] {
  if (!Array.isArray(value)) fail("INVALID_OBJECTIVE_BINDINGS");
  const bindings = value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") fail("INVALID_OBJECTIVE_BINDING");
    const item = candidate as Record<string, unknown>;
    if (!isAssessmentObjectiveId(item.objectiveId)) fail("INVALID_ASSESSMENT_OBJECTIVE_ID");
    if (item.role !== "PRIMARY" && item.role !== "SUPPORTING") fail("INVALID_OBJECTIVE_ROLE");
    return Object.freeze({
      objectiveId: item.objectiveId,
      role: item.role,
      order: requireNonnegativeInteger(item.order, "objective_order"),
    });
  });
  const primary = bindings.filter((binding) => binding.role === "PRIMARY");
  const supporting = bindings.filter((binding) => binding.role === "SUPPORTING");
  if (primary.length !== 1) fail("EXACTLY_ONE_PRIMARY_OBJECTIVE_REQUIRED");
  if (primary[0].order !== 0) fail("PRIMARY_OBJECTIVE_ORDER_MUST_BE_ZERO");
  if (supporting.length > MAX_SUPPORTING_OBJECTIVES) fail("TOO_MANY_SUPPORTING_OBJECTIVES");
  const ids = bindings.map((binding) => binding.objectiveId);
  if (new Set(ids).size !== ids.length) fail("DUPLICATE_OBJECTIVE_BINDING");
  const supportOrders = supporting.map((binding) => binding.order);
  if (
    supportOrders.some((order) => order < 1) ||
    new Set(supportOrders).size !== supportOrders.length
  ) {
    fail("INVALID_SUPPORTING_OBJECTIVE_ORDER");
  }
  return Object.freeze([
    primary[0],
    ...supporting.sort((left, right) =>
      left.order === right.order
        ? left.objectiveId.localeCompare(right.objectiveId)
        : left.order - right.order,
    ),
  ]);
}

function validateResponseSpec(value: unknown): readonly ResponseComponentSpec[] {
  if (!Array.isArray(value) || value.length === 0) fail("RESPONSE_SPEC_REQUIRED");
  const specs = value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") fail("INVALID_RESPONSE_SPEC");
    const item = candidate as Record<string, unknown>;
    const key = requireStableSemanticSegment(item.key, "response_key");
    if (!LEARNER_RESPONSE_TYPES.includes(item.type as LearnerResponseType)) {
      fail("UNSUPPORTED_RESPONSE_TYPE");
    }
    if (typeof item.required !== "boolean") fail("INVALID_RESPONSE_REQUIRED_FLAG");
    if (
      item.type === "CLASSIFICATION" &&
      typeof item.classificationSchemeId !== "string"
    ) {
      fail("CLASSIFICATION_SCHEME_REQUIRED");
    }
    return Object.freeze({
      key,
      type: item.type as LearnerResponseType,
      required: item.required,
      ...(typeof item.classificationSchemeId === "string"
        ? {
            classificationSchemeId: requireStableReference(
              item.classificationSchemeId,
              "classification_scheme_id",
            ),
          }
        : {}),
    });
  });
  if (new Set(specs.map((spec) => spec.key)).size !== specs.length) {
    fail("DUPLICATE_RESPONSE_SPEC_KEY");
  }
  return Object.freeze(specs);
}

export function createPracticalVersion(input: {
  practicalId: unknown;
  version: unknown;
  scenario?: unknown;
  instructions?: unknown;
  objectiveBindings: unknown;
  artifactIds?: unknown;
  responseSpec: unknown;
  rubricVersionId: unknown;
  explanation?: unknown;
  provenanceReference?: unknown;
  currentnessReference?: unknown;
  criterionReferences?: unknown;
  payloadDigest: unknown;
}): PracticalVersion {
  if (!isPracticalId(input.practicalId)) fail("INVALID_PRACTICAL_ID");
  if (!Number.isInteger(input.version) || (input.version as number) < 1) {
    fail("INVALID_PRACTICAL_VERSION");
  }
  const explanation = input.explanation ?? {};
  if (!explanation || typeof explanation !== "object" || Array.isArray(explanation)) {
    fail("INVALID_PRACTICAL_EXPLANATION");
  }
  const allowedExplanation = [
    "expectedDiagnosis",
    "classificationReasoning",
    "rootCause",
    "remediationRationale",
    "secureImplementationNotes",
    "alternativeInterpretation",
  ];
  const explanationRecord = explanation as Record<string, unknown>;
  if (
    Object.entries(explanationRecord).some(
      ([key, value]) => !allowedExplanation.includes(key) || typeof value !== "string",
    )
  ) {
    fail("INVALID_PRACTICAL_EXPLANATION");
  }
  const version = input.version as number;
  return Object.freeze({
    id: `practical-version:${input.practicalId}:v${version}`,
    practicalId: input.practicalId,
    version,
    scenario: typeof input.scenario === "string" ? input.scenario : "",
    instructions: typeof input.instructions === "string" ? input.instructions : "",
    objectiveBindings: normalizePracticalObjectiveBindings(input.objectiveBindings),
    artifactIds: uniqueReferences(input.artifactIds ?? [], "artifact_ids"),
    responseSpec: validateResponseSpec(input.responseSpec),
    rubricVersionId: requireStableReference(input.rubricVersionId, "rubric_version_id"),
    explanation: Object.freeze({ ...explanationRecord }) as PracticalVersion["explanation"],
    ...(input.provenanceReference === undefined
      ? {}
      : {
          provenanceReference: requireStableReference(
            input.provenanceReference,
            "provenance_reference",
          ),
        }),
    ...(input.currentnessReference === undefined
      ? {}
      : {
          currentnessReference: requireStableReference(
            input.currentnessReference,
            "currentness_reference",
          ),
        }),
    criterionReferences: uniqueReferences(
      input.criterionReferences ?? [],
      "criterion_references",
    ),
    payloadDigest: requireDigest(input.payloadDigest),
  });
}

function artifactBase(value: Record<string, unknown>) {
  return {
    id: requireStableReference(value.id, "artifact_id"),
    roleKey: requireStableSemanticSegment(value.roleKey, "artifact_role_key"),
    digest: requireDigest(value.digest),
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(typeof value.description === "string"
      ? { description: value.description }
      : {}),
  };
}

export function validateAssessmentArtifact(value: unknown): AssessmentArtifact {
  if (!value || typeof value !== "object") fail("INVALID_ASSESSMENT_ARTIFACT");
  const item = value as Record<string, unknown>;
  if (!ASSESSMENT_ARTIFACT_TYPES.includes(item.type as AssessmentArtifactType)) {
    fail("UNSUPPORTED_ARTIFACT_TYPE");
  }
  const base = artifactBase(item);
  if (item.type === "CODE") {
    if (!Array.isArray(item.files) || item.files.length === 0) fail("CODE_FILES_REQUIRED");
    const files = item.files.map((candidate) => {
      if (!candidate || typeof candidate !== "object") fail("INVALID_CODE_FILE");
      const file = candidate as Record<string, unknown>;
      if (typeof file.content !== "string") fail("INVALID_CODE_CONTENT");
      if (!Array.isArray(file.lineAnchors)) fail("INVALID_LINE_ANCHORS");
      const anchors = file.lineAnchors.map((anchor) => {
        if (!anchor || typeof anchor !== "object") fail("INVALID_LINE_ANCHOR");
        const line = anchor as Record<string, unknown>;
        if (
          !Number.isInteger(line.start) ||
          !Number.isInteger(line.end) ||
          (line.start as number) < 1 ||
          (line.end as number) < (line.start as number)
        ) {
          fail("INVALID_LINE_ANCHOR_RANGE");
        }
        return Object.freeze({
          key: requireStableSemanticSegment(line.key, "line_anchor_key"),
          start: line.start as number,
          end: line.end as number,
        });
      });
      return Object.freeze({
        logicalKey: requireStableSemanticSegment(file.logicalKey, "logical_file_key"),
        ...(typeof file.displayName === "string" ? { displayName: file.displayName } : {}),
        content: file.content,
        ...(file.digest === undefined ? {} : { digest: requireDigest(file.digest) }),
        lineAnchors: Object.freeze(anchors),
      });
    });
    if (new Set(files.map((file) => file.logicalKey)).size !== files.length) {
      fail("DUPLICATE_LOGICAL_FILE_KEY");
    }
    return Object.freeze({
      ...base,
      type: "CODE",
      languageId: requireStableReference(item.languageId, "language_id"),
      ...(typeof item.runtimeHint === "string" ? { runtimeHint: item.runtimeHint } : {}),
      executionCapability: "STATIC_ONLY",
      files: Object.freeze(files),
    });
  }
  if (["TEXT_SCENARIO", "CONFIG", "LOG", "API_CONTRACT"].includes(String(item.type))) {
    if (typeof item.content !== "string") fail("INVALID_ARTIFACT_CONTENT");
    return Object.freeze({ ...base, type: item.type, content: item.content }) as TextAssessmentArtifact;
  }
  if (item.type === "TABLE") {
    if (!Array.isArray(item.columns) || !Array.isArray(item.rows)) fail("INVALID_TABLE_ARTIFACT");
    const columns = item.columns.map((column) => String(column));
    const rows = item.rows.map((row) => {
      if (!Array.isArray(row) || row.length !== columns.length) fail("INVALID_TABLE_ROW");
      return Object.freeze(row.map((cell) => String(cell)));
    });
    return Object.freeze({ ...base, type: "TABLE", columns: Object.freeze(columns), rows: Object.freeze(rows) });
  }
  if (!Array.isArray(item.nodes) || !Array.isArray(item.edges)) fail("INVALID_DATA_FLOW_ARTIFACT");
  const nodes = item.nodes.map((node) => {
    if (!node || typeof node !== "object") fail("INVALID_DATA_FLOW_NODE");
    const candidate = node as Record<string, unknown>;
    return Object.freeze({
      id: requireStableReference(candidate.id, "data_flow_node_id"),
      label: typeof candidate.label === "string" ? candidate.label : fail("INVALID_DATA_FLOW_LABEL"),
    });
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) fail("DUPLICATE_DATA_FLOW_NODE");
  const edges = item.edges.map((edge) => {
    if (!edge || typeof edge !== "object") fail("INVALID_DATA_FLOW_EDGE");
    const candidate = edge as Record<string, unknown>;
    const from = requireStableReference(candidate.from, "data_flow_from");
    const to = requireStableReference(candidate.to, "data_flow_to");
    if (!nodeIds.has(from) || !nodeIds.has(to)) fail("UNKNOWN_DATA_FLOW_NODE");
    return Object.freeze({ from, to, ...(typeof candidate.label === "string" ? { label: candidate.label } : {}) });
  });
  return Object.freeze({ ...base, type: "DATA_FLOW", nodes: Object.freeze(nodes), edges: Object.freeze(edges) });
}

export function createPracticalPlacement(input: {
  courseId: unknown;
  curriculumTreeVersionId: unknown;
  objectivePlacementId: unknown;
  practicalId: unknown;
  contributionRole: unknown;
  order: unknown;
}): PracticalPlacement {
  if (!isPracticalId(input.practicalId)) fail("INVALID_PRACTICAL_ID");
  if (input.contributionRole !== "PRIMARY" && input.contributionRole !== "SUPPORTING") {
    fail("INVALID_CONTRIBUTION_ROLE");
  }
  const courseId = requireIdentityTupleComponent(input.courseId, "course_id");
  const curriculumTreeVersionId = requireIdentityTupleComponent(
    input.curriculumTreeVersionId,
    "curriculum_tree_version_id",
  );
  const objectivePlacementId = requireIdentityTupleComponent(
    input.objectivePlacementId,
    "objective_placement_id",
  );
  const order = requireNonnegativeInteger(input.order, "placement_order");
  return Object.freeze({
    id: `practical-placement:${encodeIdentityTuple([
      courseId,
      curriculumTreeVersionId,
      objectivePlacementId,
      input.practicalId,
      input.contributionRole,
    ])}`,
    courseId,
    curriculumTreeVersionId,
    objectivePlacementId,
    practicalId: input.practicalId,
    contributionRole: input.contributionRole,
    order,
  });
}

export function buildPrimaryPracticalContributionKey(
  placement: PracticalPlacement,
): string {
  if (placement.contributionRole !== "PRIMARY") fail("PRIMARY_CONTRIBUTION_REQUIRED");
  return `practical-contribution:${encodeIdentityTuple([
    placement.courseId,
    placement.curriculumTreeVersionId,
    placement.objectivePlacementId,
    placement.practicalId,
    "PRIMARY",
  ])}`;
}

export function assertUniquePrimaryPracticalContributions(
  placements: readonly PracticalPlacement[],
): void {
  const keys = new Set<string>();
  for (const placement of placements) {
    if (placement.contributionRole !== "PRIMARY") continue;
    const key = buildPrimaryPracticalContributionKey(placement);
    if (keys.has(key)) fail("DUPLICATE_PRIMARY_PRACTICAL_CONTRIBUTION");
    keys.add(key);
  }
}

export function validateLearnerResponses(
  specs: readonly ResponseComponentSpec[],
  value: unknown,
): readonly LearnerResponseComponent[] {
  if (!Array.isArray(value)) fail("INVALID_LEARNER_RESPONSES");
  const specByKey = new Map(specs.map((spec) => [spec.key, spec]));
  const seen = new Set<string>();
  const responses = value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") fail("INVALID_LEARNER_RESPONSE");
    const item = candidate as Record<string, unknown>;
    const key = requireStableSemanticSegment(item.key, "response_key");
    if (seen.has(key)) fail("DUPLICATE_RESPONSE_COMPONENT_KEY");
    seen.add(key);
    const spec = specByKey.get(key);
    if (!spec || spec.type !== item.type) fail("UNSUPPORTED_RESPONSE_COMPONENT");
    switch (item.type) {
      case "SELECTED_OPTION": {
        const optionIds = uniqueReferences(item.optionIds, "option_ids");
        return Object.freeze({ key, type: "SELECTED_OPTION", optionIds });
      }
      case "CLASSIFICATION": {
        const schemeId = requireStableReference(item.schemeId, "classification_scheme_id");
        if (schemeId !== spec.classificationSchemeId) fail("CLASSIFICATION_SCHEME_MISMATCH");
        return Object.freeze({ key, type: "CLASSIFICATION", schemeId, value: requireStableReference(item.value, "classification_value") });
      }
      case "FREE_TEXT":
        if (typeof item.value !== "string") fail("INVALID_FREE_TEXT_RESPONSE");
        return Object.freeze({ key, type: "FREE_TEXT", value: item.value });
      case "CODE": {
        if (!Array.isArray(item.files) || item.files.length === 0) fail("CODE_RESPONSE_FILES_REQUIRED");
        const files = item.files.map((file) => {
          if (!file || typeof file !== "object") fail("INVALID_CODE_RESPONSE_FILE");
          const record = file as Record<string, unknown>;
          if (typeof record.content !== "string") fail("INVALID_CODE_RESPONSE_CONTENT");
          return Object.freeze({ logicalKey: requireStableSemanticSegment(record.logicalKey, "logical_file_key"), content: record.content });
        });
        if (new Set(files.map((file) => file.logicalKey)).size !== files.length) fail("DUPLICATE_LOGICAL_FILE_KEY");
        return Object.freeze({ key, type: "CODE", languageId: requireStableReference(item.languageId, "language_id"), files: Object.freeze(files) });
      }
      case "STRUCTURED_FIELDS": {
        if (!item.fields || typeof item.fields !== "object" || Array.isArray(item.fields)) fail("INVALID_STRUCTURED_FIELDS");
        const fields = item.fields as Record<string, unknown>;
        for (const [fieldKey, fieldValue] of Object.entries(fields)) {
          requireStableSemanticSegment(fieldKey, "structured_field_key");
          if (!(["string", "number", "boolean"].includes(typeof fieldValue) || fieldValue === null || (Array.isArray(fieldValue) && fieldValue.every((entry) => typeof entry === "string")))) {
            fail("INVALID_STRUCTURED_FIELD_VALUE");
          }
        }
        return Object.freeze({ key, type: "STRUCTURED_FIELDS", fields: Object.freeze({ ...fields }) }) as StructuredFieldsResponse;
      }
      default:
        return fail("UNSUPPORTED_RESPONSE_TYPE");
    }
  });
  for (const spec of specs) {
    if (spec.required && !seen.has(spec.key)) fail("REQUIRED_RESPONSE_COMPONENT_MISSING");
  }
  return Object.freeze(responses);
}

export function classifyPracticalChange(
  change: PracticalChangeKind,
): "EDIT_DRAFT" | "NEW_VERSION" | "NEW_IDENTITY" {
  switch (change) {
    case "UNRELEASED_TYPO_OR_FORMATTING":
      return "EDIT_DRAFT";
    case "CAPABILITY":
    case "ASSESSMENT_PURPOSE":
    case "FUNDAMENTAL_CRITERION_MEANING":
      return "NEW_IDENTITY";
    default:
      return "NEW_VERSION";
  }
}
