export const DEFINITION_LIFECYCLES = [
  "DRAFT",
  "REVIEW_REQUESTED",
  "IN_REVIEW",
  "APPROVED",
  "ACTIVE",
  "REJECTED",
  "SUPERSEDED",
  "ARCHIVED",
] as const;

export type DefinitionLifecycle = (typeof DEFINITION_LIFECYCLES)[number];

export type AssessmentObjective = Readonly<{
  id: string;
  namespace: string;
  capabilityActionKey: string;
  lifecycle: DefinitionLifecycle;
}>;

export type AssessmentObjectivePlacement = Readonly<{
  id: string;
  objectiveId: string;
  courseId: string;
  curriculumTreeId: string;
  curriculumTreeVersionId: string;
  curriculumNodeId: string;
  conceptIds: readonly string[];
  criterionReferences: readonly string[];
}>;

const SEMANTIC_SEGMENT = /^[a-z0-9]+(?:[a-z0-9._-]*[a-z0-9])?$/;
const OBJECTIVE_ID =
  /^assessment-objective:([a-z0-9]+(?:[a-z0-9._-]*[a-z0-9])?):([a-z0-9]+(?:[a-z0-9._-]*[a-z0-9])?)$/;

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

export function requireStableSemanticSegment(
  value: unknown,
  field: string,
): string {
  if (typeof value !== "string" || !SEMANTIC_SEGMENT.test(value)) {
    return fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function requireStableReference(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 240 ||
    value.trim() !== value ||
    /[\\/]/.test(value)
  ) {
    return fail(`INVALID_${field.toUpperCase()}`);
  }
  return value;
}

function uniqueSortedReferences(values: unknown, field: string): readonly string[] {
  if (!Array.isArray(values)) return fail(`INVALID_${field.toUpperCase()}`);
  const normalized = values.map((value) => requireStableReference(value, field));
  if (new Set(normalized).size !== normalized.length) {
    return fail(`DUPLICATE_${field.toUpperCase()}`);
  }
  return Object.freeze([...normalized].sort());
}

export function buildAssessmentObjectiveId(
  namespace: unknown,
  capabilityActionKey: unknown,
): string {
  const stableNamespace = requireStableSemanticSegment(namespace, "namespace");
  const stableCapability = requireStableSemanticSegment(
    capabilityActionKey,
    "capability_action_key",
  );
  return `assessment-objective:${stableNamespace}:${stableCapability}`;
}

export function isAssessmentObjectiveId(value: unknown): value is string {
  return typeof value === "string" && OBJECTIVE_ID.test(value);
}

export function createAssessmentObjective(input: {
  namespace: unknown;
  capabilityActionKey: unknown;
  lifecycle: unknown;
}): AssessmentObjective {
  if (!DEFINITION_LIFECYCLES.includes(input.lifecycle as DefinitionLifecycle)) {
    return fail("INVALID_OBJECTIVE_LIFECYCLE");
  }
  const id = buildAssessmentObjectiveId(
    input.namespace,
    input.capabilityActionKey,
  );
  const [, namespace, capabilityActionKey] = OBJECTIVE_ID.exec(id) ?? [];
  return Object.freeze({
    id,
    namespace,
    capabilityActionKey,
    lifecycle: input.lifecycle as DefinitionLifecycle,
  });
}

export function buildAssessmentObjectivePlacementId(input: {
  courseId: unknown;
  curriculumTreeVersionId: unknown;
  curriculumNodeId: unknown;
  objectiveId: unknown;
}): string {
  const courseId = requireIdentityTupleComponent(input.courseId, "course_id");
  const treeVersion = requireIdentityTupleComponent(
    input.curriculumTreeVersionId,
    "curriculum_tree_version_id",
  );
  const nodeId = requireIdentityTupleComponent(
    input.curriculumNodeId,
    "curriculum_node_id",
  );
  if (!isAssessmentObjectiveId(input.objectiveId)) {
    return fail("INVALID_ASSESSMENT_OBJECTIVE_ID");
  }
  return `assessment-objective-placement:${encodeIdentityTuple([
    courseId,
    treeVersion,
    nodeId,
    input.objectiveId,
  ])}`;
}

export function createAssessmentObjectivePlacement(input: {
  objectiveId: unknown;
  courseId: unknown;
  curriculumTreeId: unknown;
  curriculumTreeVersionId: unknown;
  curriculumNodeId: unknown;
  conceptIds?: unknown;
  criterionReferences?: unknown;
}): AssessmentObjectivePlacement {
  if (!isAssessmentObjectiveId(input.objectiveId)) {
    return fail("INVALID_ASSESSMENT_OBJECTIVE_ID");
  }
  const courseId = requireIdentityTupleComponent(input.courseId, "course_id");
  const curriculumTreeId = requireIdentityTupleComponent(
    input.curriculumTreeId,
    "curriculum_tree_id",
  );
  const curriculumTreeVersionId = requireIdentityTupleComponent(
    input.curriculumTreeVersionId,
    "curriculum_tree_version_id",
  );
  const curriculumNodeId = requireIdentityTupleComponent(
    input.curriculumNodeId,
    "curriculum_node_id",
  );
  return Object.freeze({
    id: buildAssessmentObjectivePlacementId({
      courseId,
      curriculumTreeVersionId,
      curriculumNodeId,
      objectiveId: input.objectiveId,
    }),
    objectiveId: input.objectiveId,
    courseId,
    curriculumTreeId,
    curriculumTreeVersionId,
    curriculumNodeId,
    conceptIds: uniqueSortedReferences(input.conceptIds ?? [], "concept_ids"),
    criterionReferences: uniqueSortedReferences(
      input.criterionReferences ?? [],
      "criterion_references",
    ),
  });
}

export function assertUniqueObjectivePlacements(
  placements: readonly AssessmentObjectivePlacement[],
): void {
  const ids = new Set<string>();
  for (const placement of placements) {
    if (ids.has(placement.id)) fail("DUPLICATE_OBJECTIVE_PLACEMENT");
    ids.add(placement.id);
  }
}
