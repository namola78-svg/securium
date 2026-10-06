import { sha256Canonical, stableCanonicalJson } from "../policy/stable-canonical-hash.ts";
import { AppError } from "../errors.ts";
import {
  COURSE_THEORY_DRAFT,
  NOT_GRANTED,
  RUNTIME_AUTHORITY_SUBJECT_CONTRACT_V1,
  approvalSubjectHash,
  assertRuntimeAuthorityGate,
  normalizeRuntimeAuthoritySubject,
  type RuntimeAuthoritySubject,
} from "../policy/runtime-authority-binding.ts";
import {
  persistenceRecordsToCanonicalEvents,
  type RuntimeAuthorityPersistenceTransactionOwner,
} from "../policy/runtime-authority-persistence-contract.ts";
import { replayAuthorityLedger, type AuthorityReference, type AuthorityReplayContext } from "../policy/runtime-authority-event-ledger.ts";
import { executeRuntimeAuthorityCommand, type RuntimeAuthorityCommandContext } from "./runtime-authority-command-service.ts";
import { assertNoCallerAuthorityInjection } from "./cppg-runtime-authority.ts";
import { PostgresRuntimeAuthorityPersistence } from "../../db/runtime-authority-postgres-persistence.ts";
import { PostgresCppgDraftPersistenceAdapter } from "../../db/cppg-runtime-postgres-registration.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { contentRevisions, contents, courseLessons, courses, curriculumNodes, curriculumTrees, learningUnits, lessons, subjects, topics } from "../../db/schema.ts";
import { CONTENT_REVISION_REGISTRATION_V1, OWNER_ATTESTATION_REQUIRED, REVIEW_REQUIRED, buildRegistrationIdentities, type RegistrationSubjectInput, type RegistrationIdentitySet } from "./content-revision-registration.ts";

export const CPPG_RUNTIME_COURSE_ID = "course-cppg" as const;
export const CPPG_RUNTIME_PACKAGE_KEY = "course-cppg:foundation:v1" as const;
export const CPPG_RUNTIME_RESOURCE_TYPE = "COURSE_THEORY_DRAFT" as const;
export const CPPG_RUNTIME_PROJECTION_V1 = "CPPG_RUNTIME_COURSE_THEORY_DRAFT_PROJECTION_V1" as const;
export const CPPG_OFFICIAL_SUBJECTS = [
  { id: "CPPG-S1", name: "\uac1c\uc778\uc815\ubcf4\ubcf4\ud638\uc758\u0020\uc774\ud574", order: 1, officialWeight: 10 },
  { id: "CPPG-S2", name: "\uac1c\uc778\uc815\ubcf4\ubcf4\ud638\u0020\uc81c\ub3c4", order: 2, officialWeight: 20 },
  { id: "CPPG-S3", name: "\uac1c\uc778\uc815\ubcf4\u0020\ub77c\uc774\ud504\uc0ac\uc774\ud074\u0020\uad00\ub9ac", order: 3, officialWeight: 25 },
  { id: "CPPG-S4", name: "\uac1c\uc778\uc815\ubcf4\uc758\u0020\ubcf4\ud638\uc870\uce58", order: 4, officialWeight: 30 },
  { id: "CPPG-S5", name: "\uac1c\uc778\uc815\ubcf4\u0020\uad00\ub9ac\uccb4\uacc4", order: 5, officialWeight: 15 },
] as const;

type JsonObject = { readonly [key: string]: unknown };
type FoundationSubject = Readonly<{ id: string; name: string; order: number; officialWeight: number }>;
type FoundationObjective = Readonly<{ id: string; text: string; learningUnitId: string; officialSubjectId: string }>;
type FoundationUnit = Readonly<{ id: string; type: string; officialSubjectId: string; title: string; definition: string; purpose: string; keyLegalOperationalConcept: string; scope: string; importantDistinctions: string; lifecycle: string; perspectives: JsonObject; commonMisunderstandings: readonly string[]; appliedScenario: string; cppgExamReasoningPoint: string; objectives: readonly FoundationObjective[]; conceptCandidates?: readonly string[] }>;
export type CppgFoundationBundle = Readonly<{
  curriculum: Readonly<{ courseId: string; curriculumAuthorityCount: number; subjects: readonly FoundationSubject[] }>;
  theory: Readonly<{ authorityId: string; type: string; units: readonly FoundationUnit[] }>;
  objectives: Readonly<{ authorityId: string; type: string; objectives: readonly FoundationObjective[] }>;
  assessment: Readonly<{ authorityId?: string; type: string; questionCount: number; questions: readonly unknown[] }>;
  practical: Readonly<{ type: string; status: string; executableLabs: number; specs: readonly unknown[] }>;
  dryRun: Readonly<{ writes: number; summary: Readonly<{ exact: number; alias: number; missing: number; ambiguous: number }> }>;
  provenanceRights: Readonly<{ rightsPolicy: Readonly<{ localReferencePackage: string; sourceImageExposure: number; sourceQuestionIngestion: number; highRiskReconstruction: number; canonicalOcrIngestion: number }> }>;
}>;
type CanonicalCppgFoundationBundle = CppgFoundationBundle & Readonly<{
  curriculum: CppgFoundationBundle["curriculum"] & Readonly<{ manifestId: string; authorityStatus: string }>;
  theory: CppgFoundationBundle["theory"] & Readonly<{ courseId: string; provenance?: Readonly<{ officialScopeBasis?: string }> }>;
  objectives: CppgFoundationBundle["objectives"] & Readonly<{ courseId: string; provenance?: Readonly<{ officialScopeBasis?: string }> }>;
  assessment: CppgFoundationBundle["assessment"] & Readonly<{ courseId: string; semanticHash: string; provenance?: Readonly<{ officialScopeBasis?: string }> }>;
  provenanceRights: CppgFoundationBundle["provenanceRights"] & Readonly<{ manifestId: string }>;
  sourceManifest: Readonly<{ manifestId: string; sourceRoot: string; snapshotDate: string; packageHash: string }>;
  projection: Readonly<{ generatedFrom: string; projectionMode: string; semanticHash: string }>;
}>;
type CppgFoundationValidatorModule = Readonly<{
  loadBundle(repoRoot: string): Promise<unknown>;
  validateFoundation(bundle: unknown): Readonly<{ status: string }>;
}>;

const CPPG_REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export type CppgAuthorityBindingFailureCode =
  | "CPPG_CANONICAL_VALIDATOR_UNAVAILABLE"
  | "CPPG_CANONICAL_IDENTITY_MISMATCH"
  | "CPPG_APPROVAL_BINDING_UNAVAILABLE"
  | "CPPG_PROJECTION_ENTRYPOINT_INPUT_INVALID"
  | "CPPG_TEST_ONLY_PERSISTENCE_PRIMITIVE";

export class CppgAuthorityBindingError extends Error {
  readonly code: CppgAuthorityBindingFailureCode;
  constructor(code: CppgAuthorityBindingFailureCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CppgAuthorityBindingError";
    this.code = code;
  }
}
type CourseInsert = typeof courses.$inferInsert;
type CurriculumTreeInsert = typeof curriculumTrees.$inferInsert;
type CurriculumNodeInsert = typeof curriculumNodes.$inferInsert;
type SubjectInsert = typeof subjects.$inferInsert;
type TopicInsert = typeof topics.$inferInsert;
type LearningUnitInsert = typeof learningUnits.$inferInsert;
type ContentInsert = typeof contents.$inferInsert;
type LessonInsert = typeof lessons.$inferInsert;
type CourseLessonInsert = typeof courseLessons.$inferInsert;
type ContentRevisionInsert = typeof contentRevisions.$inferInsert;

export type ProjectionKind = "COURSE" | "CURRICULUM_TREE" | "SUBJECT" | "CURRICULUM_NODE" | "TOPIC" | "LEARNING_UNIT" | "CONTENT" | "LESSON" | "COURSE_LESSON" | "CONTENT_REVISION";
export type ProjectionRecord = Readonly<{ id: string; kind: ProjectionKind; semanticHash: string; payload: JsonObject }>;
export type ObjectiveMetadataRecord = Readonly<{ id: string; authorityId: string; learningUnitId: string; officialSubjectId: string; text: string; persistence: "OBJECTIVES_METADATA_ONLY" }>;
export type CppgFoundationProjectionCounts = Readonly<{ course: 1; subjects: 5; curriculumTrees: 1; curriculumNodes: 30; topics: 25; learningUnits: 25; objectives: 50; contents: 25; lessons: 25; courseLessons: 25; contentRevisions: 25 }>;
export type CppgFuturePersistenceRowCounts = Readonly<{ course: 1; subjects: 5; curriculumTrees: 1; curriculumNodes: 30; topics: 25; learningUnits: 25; objectives: 0; contents: 25; lessons: 25; courseLessons: 25; contentRevisions: 25 }>;
export type CppgPersistenceStage = "COURSE" | "CURRICULUM_TREE" | "SUBJECTS" | "CURRICULUM_NODES" | "TOPICS" | "LEARNING_UNITS" | "CONTENTS" | "LESSONS" | "COURSE_LESSONS" | "CONTENT_REVISIONS";
export const CPPG_PERSISTENCE_ORDER: readonly CppgPersistenceStage[] = ["COURSE", "CURRICULUM_TREE", "SUBJECTS", "CURRICULUM_NODES", "TOPICS", "LEARNING_UNITS", "CONTENTS", "LESSONS", "COURSE_LESSONS", "CONTENT_REVISIONS"];

export type CppgCourseTheoryDraftProjection = Readonly<{
  contractVersion: typeof CPPG_RUNTIME_PROJECTION_V1; courseId: typeof CPPG_RUNTIME_COURSE_ID; packageKey: typeof CPPG_RUNTIME_PACKAGE_KEY;
  course: ProjectionRecord; curriculumTree: ProjectionRecord; subjects: readonly ProjectionRecord[]; curriculumNodes: readonly ProjectionRecord[];
  topics: readonly ProjectionRecord[]; learningUnits: readonly ProjectionRecord[]; objectives: readonly ObjectiveMetadataRecord[];
  contents: readonly ProjectionRecord[]; lessons: readonly ProjectionRecord[]; courseLessons: readonly ProjectionRecord[]; contentRevisions: readonly ProjectionRecord[];
  revisionRegistration: Readonly<{ resourceType: typeof CPPG_RUNTIME_RESOURCE_TYPE; qualificationId: "CPPG"; packageKey: typeof CPPG_RUNTIME_PACKAGE_KEY; identities: RegistrationIdentitySet; subjects: readonly RegistrationSubjectInput[] }>;
  conceptReadiness: Readonly<{ exact: 2; alias: 0; missing: 72; ambiguous: 0; writes: 0; classifications: Readonly<{ readyNewConcept: 54; needsDecomposition: 13; notAConcept: 5 }> }>;
  excluded: Readonly<{ assessmentQuestions: 100; practicalSpecs: 10; ontologyWrites: 0; publication: false }>;
  counts: CppgFoundationProjectionCounts; futurePersistenceRowCounts: CppgFuturePersistenceRowCounts; projectionSemanticHash: string;
}>;

const CPPG_SOURCE_MANIFEST_ID = "SECURIUM_CPPG_FOUNDATION_SOURCE_SHA256_V1" as const;
const CPPG_SOURCE_PACKAGE_HASH = "cf4ada7c7f325aa405c76db7993d314b782ff4f69f07b467793dc11cf1913a80" as const;
const CPPG_FOUNDATION_ID = "SECURIUM_CPPG_FOUNDATION_WAVE_A_FINAL_V1" as const;
const CPPG_FOUNDATION_SEMANTIC_HASH = "d9944e1d7b62031a262dbf04b078a61e659df1eb4603815e2e8f940bbc23057f" as const;

export type CppgAuthorityIdentity = Readonly<{
  authorityId: string;
  subject: RuntimeAuthoritySubject;
  approvalSubjectHash: string;
}>;

export type CppgAuthorityCurrentness = Readonly<{
  state: "CURRENT" | "NOT_CURRENT";
  authorityId: string;
  approvalSubjectHash: string;
  authoritySequence?: number;
  reason?: string;
}>;

function invariant(condition: unknown, message: string): asserts condition { if (!condition) throw new Error("CPPG projection invariant failed: " + message); }
function assertNoForbiddenKeys(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);
  invariant(!serialized.includes("officialQuestionAllocation"), label + " contains unsupported official allocation claim");
  invariant(!serialized.includes("SOURCE_QUESTION_INGESTED"), label + " contains source-question ingestion");
  invariant(!serialized.includes("EXECUTABLE_LAB"), label + " contains executable Lab state");
}
function freezeJsonSnapshot<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) freezeJsonSnapshot(child);
  return Object.freeze(value);
}
async function loadCanonicalCppgFoundationBundle(): Promise<CanonicalCppgFoundationBundle> {
  let validator: CppgFoundationValidatorModule;
  try {
    validator = await import("../cppg/foundation-validator.mjs") as unknown as CppgFoundationValidatorModule;
  } catch (error) {
    throw new CppgAuthorityBindingError("CPPG_CANONICAL_VALIDATOR_UNAVAILABLE", "canonical CPPG validator could not be loaded", { cause: error });
  }
  let bundle: unknown;
  try {
    bundle = freezeJsonSnapshot(await validator.loadBundle(CPPG_REPOSITORY_ROOT));
    const validation = validator.validateFoundation(bundle);
    if (validation.status !== "PASS") throw new Error("canonical Foundation validator did not return PASS");
  } catch (error) {
    if (error instanceof CppgAuthorityBindingError) throw error;
    throw new CppgAuthorityBindingError("CPPG_CANONICAL_IDENTITY_MISMATCH", "canonical CPPG Foundation structural validation failed", { cause: error });
  }
  return bundle as CanonicalCppgFoundationBundle;
}
export function buildCppgRuntimeId(kind: string, sourceId: string): string {
  invariant(typeof sourceId === "string" && sourceId.length > 0, "stable source ID is required");
  invariant(!/[\\/]/u.test(sourceId), "source ID cannot contain a path separator: " + sourceId);
  return kind === "course" ? CPPG_RUNTIME_COURSE_ID : CPPG_RUNTIME_COURSE_ID + ":" + kind + ":" + sourceId;
}
async function record(kind: ProjectionKind, id: string, payload: JsonObject, semanticPayload = payload): Promise<ProjectionRecord> {
  return { id, kind, semanticHash: await sha256Canonical({ kind, id, payload: semanticPayload }), payload };
}
function unitContentSnapshot(unit: FoundationUnit, objectives: readonly FoundationObjective[]): JsonObject {
  return { authority: "SECURIUM_CPPG_THEORY_AUTHORITY_V1", learningUnitId: unit.id, officialSubjectId: unit.officialSubjectId, title: unit.title, definition: unit.definition, purpose: unit.purpose, keyLegalOperationalConcept: unit.keyLegalOperationalConcept, scope: unit.scope, importantDistinctions: unit.importantDistinctions, lifecycle: unit.lifecycle, perspectives: unit.perspectives, commonMisunderstandings: unit.commonMisunderstandings, appliedScenario: unit.appliedScenario, cppgExamReasoningPoint: unit.cppgExamReasoningPoint, objectives: objectives.map(({ id, text }) => ({ id, text })), coreConcepts: [], conceptBindingState: "UNRESOLVED_CANDIDATES_NOT_CANONICAL" };
}
function assertFoundationShape(bundle: CppgFoundationBundle): void {
  invariant(bundle.curriculum.courseId === CPPG_RUNTIME_COURSE_ID, "course identity must be course-cppg");
  invariant(bundle.curriculum.curriculumAuthorityCount === 1, "one curriculum authority is required");
  invariant(bundle.curriculum.subjects.length === 5, "five official subjects are required");
  CPPG_OFFICIAL_SUBJECTS.forEach((expected, index) => { const actual = bundle.curriculum.subjects[index]; invariant(actual?.id === expected.id && actual.name === expected.name && actual.order === expected.order && actual.officialWeight === expected.officialWeight, "official subject " + expected.id + " changed"); });
  invariant(bundle.curriculum.subjects.reduce((sum, subject) => sum + subject.officialWeight, 0) === 100, "official weights must total 100");
  invariant(bundle.theory.type === "THEORY_AUTHORITY" && bundle.theory.units.length === 25, "theory authority must contain 25 units");
  invariant(bundle.objectives.type === "OBJECTIVE_AUTHORITY" && bundle.objectives.objectives.length === 50, "objective authority must contain 50 objectives");
  invariant(bundle.assessment.type === "ASSESSMENT_AUTHORITY" && bundle.assessment.questionCount === 100 && bundle.assessment.questions.length === 100, "assessment Foundation must contain 100 questions");
  invariant(bundle.practical.type === "SECURIUM_PRACTICAL_SPEC" && bundle.practical.status === "SPEC_ONLY" && bundle.practical.executableLabs === 0 && bundle.practical.specs.length === 10, "practical boundary changed");
  invariant(bundle.dryRun.writes === 0 && bundle.dryRun.summary.ambiguous === 0, "ontology dry-run must remain read-only and unambiguous");
  invariant(bundle.provenanceRights.rightsPolicy.localReferencePackage === "REFERENCE_ONLY", "reference rights boundary changed");
  for (const key of ["sourceImageExposure", "sourceQuestionIngestion", "highRiskReconstruction", "canonicalOcrIngestion"] as const) invariant(bundle.provenanceRights.rightsPolicy[key] === 0, key + " must remain zero");
  assertNoForbiddenKeys(bundle, "Foundation bundle");
}
export type CppgProjectionOptions = Readonly<{ actorUserId: string }>;

function assertProjectionEntryPointOptions(options: unknown): asserts options is CppgProjectionOptions {
  if (!options || typeof options !== "object" || typeof (options as CppgProjectionOptions).actorUserId !== "string" || (options as CppgProjectionOptions).actorUserId.trim().length === 0) throw new CppgAuthorityBindingError("CPPG_PROJECTION_ENTRYPOINT_INPUT_INVALID", "registered CPPG projection entrypoint accepts actor options only; caller bundle and authority inputs are not accepted");
  const authorityFields = Object.fromEntries(Object.entries(options).filter(([key]) => key !== "sourceRoot"));
  assertNoCallerAuthorityInjection(authorityFields);
}

export async function buildCppgCourseTheoryDraftProjectionFromBundle(bundle: CppgFoundationBundle, options: CppgProjectionOptions): Promise<CppgCourseTheoryDraftProjection> {
  assertFoundationShape(bundle);
  invariant(options.actorUserId.trim().length > 0, "runtime actor is required for generic revision registration");
  const units = [...bundle.theory.units].sort((a, b) => a.id.localeCompare(b.id));
  const subjectIdByOfficialId = new Map<string, string>(CPPG_OFFICIAL_SUBJECTS.map((subject) => [subject.id, buildCppgRuntimeId("subject", subject.id)]));
  const objectivesByUnit = new Map<string, FoundationObjective[]>();
  for (const objective of bundle.objectives.objectives) objectivesByUnit.set(objective.learningUnitId, [...(objectivesByUnit.get(objective.learningUnitId) ?? []), objective]);
  for (const unit of units) invariant(objectivesByUnit.has(unit.id), "unit lacks governed objectives: " + unit.id);
  const coursePayload = { id: CPPG_RUNTIME_COURSE_ID, courseGroupId: "group-independent", code: "CPPG", slug: "cppg", name: "CPPG 개인정보관리사", shortName: "CPPG", description: "Securium CPPG Foundation Course/Theory Draft", totalLevels: 1, passingScore: 60, difficulty: "INTERMEDIATE", active: false, published: false, displayOrder: 0, isSample: false } satisfies CourseInsert;
  const course = await record("COURSE", coursePayload.id, coursePayload);
  const treePayload = { id: buildCppgRuntimeId("curriculum", "foundation-v1"), courseId: CPPG_RUNTIME_COURSE_ID, title: "CPPG Foundation Draft Curriculum", version: "foundation-v1", sourceType: "SECURIUM_AUTHORITY", sourceDocument: "CPPG_CURRENT_AUTHORITY_FREEZE_2026-09-08", status: "DRAFT" } satisfies CurriculumTreeInsert;
  const curriculumTree = await record("CURRICULUM_TREE", treePayload.id, treePayload);
  const subjectRecords = await Promise.all(CPPG_OFFICIAL_SUBJECTS.map(async (subject) => {
    const payload = { id: buildCppgRuntimeId("subject", subject.id), courseId: CPPG_RUNTIME_COURSE_ID, code: subject.id, name: subject.name, description: "Official CPPG subject scope; weight is OFFICIAL_EXAM_WEIGHT.", displayOrder: subject.order, active: false, isSample: false } satisfies SubjectInsert;
    return record("SUBJECT", payload.id, payload);
  }));
  const subjectNodes = await Promise.all(CPPG_OFFICIAL_SUBJECTS.map(async (subject) => {
    const payload = { id: buildCppgRuntimeId("node:subject", subject.id), curriculumTreeId: curriculumTree.id, parentId: null, nodeType: "SUBJECT", title: subject.name, description: "Official CPPG subject node.", officialCode: subject.id, officialTitle: subject.name, sortOrder: subject.order, depth: 0, path: buildCppgRuntimeId("subject", subject.id), isRequired: true, isPractical: false, metadata: JSON.stringify({ lifecycle: "DRAFT", authority: "OFFICIAL_SUBJECT", officialWeight: subject.officialWeight, weightSemantics: "OFFICIAL_EXAM_WEIGHT" }), status: "INACTIVE" } satisfies CurriculumNodeInsert;
    return record("CURRICULUM_NODE", payload.id, payload);
  }));
  const topicRecords = await Promise.all(units.map(async (unit, index) => {
    const subjectId = subjectIdByOfficialId.get(unit.officialSubjectId);
    invariant(subjectId, "subject binding missing for topic " + unit.id);
    const payload = { id: buildCppgRuntimeId("topic", unit.id), subjectId, code: unit.id, name: unit.title, description: unit.purpose, displayOrder: index, active: false, isSample: false } satisfies TopicInsert;
    return record("TOPIC", payload.id, payload);
  }));
  const unitRecords = await Promise.all(units.map(async (unit, index) => {
    const subjectId = subjectIdByOfficialId.get(unit.officialSubjectId);
    invariant(subjectId, "subject binding missing for unit " + unit.id);
    const payload = { id: buildCppgRuntimeId("unit", unit.id), courseId: CPPG_RUNTIME_COURSE_ID, subjectId, topicId: buildCppgRuntimeId("topic", unit.id), code: unit.id, title: unit.title, description: unit.definition, displayOrder: index, active: false, published: false, completionPolicy: "MANUAL", minimumProgressPercent: 100, minimumStudySeconds: 0, isSample: false } satisfies LearningUnitInsert;
    return record("LEARNING_UNIT", payload.id, payload);
  }));
  const unitNodes = await Promise.all(units.map(async (unit, index) => {
    const payload = { id: buildCppgRuntimeId("node:unit", unit.id), curriculumTreeId: curriculumTree.id, parentId: buildCppgRuntimeId("node:subject", unit.officialSubjectId), nodeType: "LEARNING_UNIT", title: unit.title, description: unit.definition, officialCode: unit.id, officialTitle: unit.title, sortOrder: index, depth: 1, path: unit.officialSubjectId + "/" + unit.id, isRequired: true, isPractical: false, metadata: JSON.stringify({ lifecycle: "DRAFT", sourceLearningUnitId: unit.id }), status: "INACTIVE" } satisfies CurriculumNodeInsert;
    return record("CURRICULUM_NODE", payload.id, payload);
  }));
  const objectiveRecords: ObjectiveMetadataRecord[] = [...bundle.objectives.objectives].sort((a, b) => a.id.localeCompare(b.id)).map((objective) => ({ id: objective.id, authorityId: bundle.objectives.authorityId, learningUnitId: buildCppgRuntimeId("unit", objective.learningUnitId), officialSubjectId: objective.officialSubjectId, text: objective.text, persistence: "OBJECTIVES_METADATA_ONLY" }));
  const contentRecords: ProjectionRecord[] = [], lessonRecords: ProjectionRecord[] = [], courseLessonRecords: ProjectionRecord[] = [], revisionRecords: ProjectionRecord[] = [];
  const registrationSubjects: RegistrationSubjectInput[] = [];
  for (const [index, unit] of units.entries()) {
    const unitObjectives = (objectivesByUnit.get(unit.id) ?? []).sort((a, b) => a.id.localeCompare(b.id));
    const snapshot = unitContentSnapshot(unit, unitObjectives);
    const contentId = buildCppgRuntimeId("content", unit.id), lessonId = buildCppgRuntimeId("lesson", unit.id);
    const subjectId = subjectIdByOfficialId.get(unit.officialSubjectId);
    invariant(subjectId, "subject binding missing for lesson " + unit.id);
    const contentHash = await sha256Canonical(snapshot);
    const contentPayload = { id: contentId, slug: "cppg-" + unit.id.toLowerCase(), canonicalKey: CPPG_RUNTIME_COURSE_ID + ":" + unit.id.toLowerCase(), title: unit.title, summary: unit.purpose, body: stableCanonicalJson(snapshot), bodyFormat: "STRUCTURED_JSON", learningObjectivesJson: JSON.stringify(unitObjectives.map(({ id, text }) => ({ id, text }))), coreConceptsJson: "[]", practicalExamplesJson: JSON.stringify([unit.appliedScenario]), diagramsJson: "[]", mediaJson: "[]", version: "1.0.0", status: "DRAFT", createdBy: options.actorUserId } satisfies ContentInsert;
    contentRecords.push(await record("CONTENT", contentId, contentPayload, { ...contentPayload, createdBy: "RUNTIME_ACTOR_EXCLUDED_FROM_SEMANTICS" }));
    const lessonPayload = { id: lessonId, learningUnitId: buildCppgRuntimeId("unit", unit.id), courseId: CPPG_RUNTIME_COURSE_ID, subjectId, topicId: buildCppgRuntimeId("topic", unit.id), code: unit.id, title: unit.title, summary: unit.purpose, content: stableCanonicalJson(snapshot), contentFormat: "PLAIN_TEXT", estimatedMinutes: 10, displayOrder: index, active: false, published: false, isSample: false, version: 1 } satisfies LessonInsert;
    lessonRecords.push(await record("LESSON", lessonId, lessonPayload));
    const courseLessonPayload = { id: buildCppgRuntimeId("course-lesson", unit.id), courseId: CPPG_RUNTIME_COURSE_ID, curriculumNodeId: buildCppgRuntimeId("node:unit", unit.id), contentId, lessonId, displayTitle: unit.title, sortOrder: index, estimatedMinutes: 10, isRequired: true, completionRule: "MANUAL", status: "DRAFT" } satisfies CourseLessonInsert;
    courseLessonRecords.push(await record("COURSE_LESSON", courseLessonPayload.id, courseLessonPayload));
    const registrationSubject: RegistrationSubjectInput = { semanticRevisionId: CPPG_RUNTIME_COURSE_ID + ":revision:" + unit.id + ":v1", contentId, contentType: "LESSON", version: "1", contentHash, snapshotJson: stableCanonicalJson(snapshot), sourceLineage: "CPPG_FOUNDATION_REFERENCE_ONLY_NO_REUSE", sourceBindings: [], rightsState: REVIEW_REQUIRED, originalityState: REVIEW_REQUIRED, currentnessState: REVIEW_REQUIRED, responsibleOwnerState: OWNER_ATTESTATION_REQUIRED };
    registrationSubjects.push(registrationSubject);
    const revisionPayload = { id: registrationSubject.semanticRevisionId, contentType: "LESSON", contentId, courseId: CPPG_RUNTIME_COURSE_ID, title: unit.title, contentDate: "2026-09-08", version: "1", revisionStatus: "draft", snapshotJson: registrationSubject.snapshotJson, changeSummary: CONTENT_REVISION_REGISTRATION_V1, isLatest: false, createdBy: options.actorUserId, semanticHash: contentHash } satisfies ContentRevisionInsert;
    revisionRecords.push(await record("CONTENT_REVISION", revisionPayload.id, revisionPayload, { ...revisionPayload, createdBy: "RUNTIME_ACTOR_EXCLUDED_FROM_SEMANTICS" }));
  }
  const identities = await buildRegistrationIdentities({ resourceType: CPPG_RUNTIME_RESOURCE_TYPE, qualificationId: "CPPG", packageKey: CPPG_RUNTIME_PACKAGE_KEY, subjects: registrationSubjects });
  const persistentRecords = [course, curriculumTree, ...subjectRecords, ...subjectNodes, ...topicRecords, ...unitRecords, ...unitNodes, ...contentRecords, ...lessonRecords, ...courseLessonRecords, ...revisionRecords];
  const counts: CppgFoundationProjectionCounts = { course: 1, subjects: 5, curriculumTrees: 1, curriculumNodes: 30, topics: 25, learningUnits: 25, objectives: 50, contents: 25, lessons: 25, courseLessons: 25, contentRevisions: 25 };
  const futurePersistenceRowCounts: CppgFuturePersistenceRowCounts = { ...counts, objectives: 0 };
  const projectionSemanticHash = await sha256Canonical({ contractVersion: CPPG_RUNTIME_PROJECTION_V1, courseId: CPPG_RUNTIME_COURSE_ID, packageKey: CPPG_RUNTIME_PACKAGE_KEY, recordHashes: persistentRecords.map(({ id, kind, semanticHash }) => ({ id, kind, semanticHash })), revisionRegistration: identities, counts, futurePersistenceRowCounts });
  return { contractVersion: CPPG_RUNTIME_PROJECTION_V1, courseId: CPPG_RUNTIME_COURSE_ID, packageKey: CPPG_RUNTIME_PACKAGE_KEY, course, curriculumTree, subjects: subjectRecords, curriculumNodes: [...subjectNodes, ...unitNodes], topics: topicRecords, learningUnits: unitRecords, objectives: objectiveRecords, contents: contentRecords, lessons: lessonRecords, courseLessons: courseLessonRecords, contentRevisions: revisionRecords, revisionRegistration: { resourceType: CPPG_RUNTIME_RESOURCE_TYPE, qualificationId: "CPPG", packageKey: CPPG_RUNTIME_PACKAGE_KEY, identities, subjects: registrationSubjects }, conceptReadiness: { exact: 2, alias: 0, missing: 72, ambiguous: 0, writes: 0, classifications: { readyNewConcept: 54, needsDecomposition: 13, notAConcept: 5 } }, excluded: { assessmentQuestions: 100, practicalSpecs: 10, ontologyWrites: 0, publication: false }, counts, futurePersistenceRowCounts, projectionSemanticHash };
}
export async function buildCppgCourseTheoryDraftProjection(options: CppgProjectionOptions): Promise<CppgCourseTheoryDraftProjection> {
  assertProjectionEntryPointOptions(options);
  return buildCppgCourseTheoryDraftProjectionFromBundle(await loadCanonicalCppgFoundationBundle(), options);
}

export function cppgAuthorityIdentity(projection: CppgCourseTheoryDraftProjection): Promise<CppgAuthorityIdentity> {
  return (async () => {
    if (projection.courseId !== CPPG_RUNTIME_COURSE_ID || projection.packageKey !== CPPG_RUNTIME_PACKAGE_KEY) {
      throw new CppgAuthorityBindingError("CPPG_CANONICAL_IDENTITY_MISMATCH", "CPPG authority subject is not bound to the canonical course/package identity");
    }
    // The generic revision registration identity binds the exact lesson snapshots;
    // projectionSemanticHash binds the full Course/Theory Draft projection.
    const revisionIdentity = projection.revisionRegistration.identities.registrationSemanticIdentity;
    if (!/^[a-f0-9]{64}$/u.test(revisionIdentity) || !/^[a-f0-9]{64}$/u.test(projection.projectionSemanticHash)) {
      throw new CppgAuthorityBindingError("CPPG_CANONICAL_IDENTITY_MISMATCH", "CPPG runtime revision identity is malformed");
    }
    const subject = normalizeRuntimeAuthoritySubject({
      contractVersion: RUNTIME_AUTHORITY_SUBJECT_CONTRACT_V1,
      registrationPurpose: COURSE_THEORY_DRAFT,
      courseId: CPPG_RUNTIME_COURSE_ID,
      courseSlug: "cppg",
      packageKey: CPPG_RUNTIME_PACKAGE_KEY,
      sourceManifestId: CPPG_SOURCE_MANIFEST_ID,
      sourcePackageHash: CPPG_SOURCE_PACKAGE_HASH,
      foundationId: CPPG_FOUNDATION_ID,
      foundationHash: await sha256Canonical({
        // Gate A content identity and the exact CPPG revision are both inputs.
        foundationId: CPPG_FOUNDATION_ID,
        sourceManifestId: CPPG_SOURCE_MANIFEST_ID,
        sourcePackageHash: CPPG_SOURCE_PACKAGE_HASH,
        authoritySemanticHash: CPPG_FOUNDATION_SEMANTIC_HASH,
        revisionIdentity,
      }),
      runtimeRevisionId: `${CPPG_RUNTIME_PACKAGE_KEY}:revision:${revisionIdentity}`,
      semanticHash: projection.projectionSemanticHash,
      publicationAuthority: NOT_GRANTED,
    });
    const hash = approvalSubjectHash(subject);
    return Object.freeze({ authorityId: cppgAuthorityIdForSubjectHash(hash), subject, approvalSubjectHash: hash });
  })();
}

function cppgAuthorityIdForSubjectHash(subjectHash: string): string {
  return `runtime-authority:cppg:${subjectHash}`;
}

export async function isCanonicalCppgPredecessor(
  authorityId: string,
  subject: RuntimeAuthoritySubject,
  storedApprovalSubjectHash: string,
): Promise<boolean> {
  const subjectHash = approvalSubjectHash(subject);
  if (storedApprovalSubjectHash !== subjectHash || authorityId !== cppgAuthorityIdForSubjectHash(subjectHash)) return false;
  if (
    subject.contractVersion !== RUNTIME_AUTHORITY_SUBJECT_CONTRACT_V1 ||
    subject.registrationPurpose !== COURSE_THEORY_DRAFT ||
    subject.courseId !== CPPG_RUNTIME_COURSE_ID ||
    subject.courseSlug !== "cppg" ||
    subject.packageKey !== CPPG_RUNTIME_PACKAGE_KEY ||
    subject.sourceManifestId !== CPPG_SOURCE_MANIFEST_ID ||
    subject.sourcePackageHash !== CPPG_SOURCE_PACKAGE_HASH ||
    subject.foundationId !== CPPG_FOUNDATION_ID ||
    subject.publicationAuthority !== NOT_GRANTED
  ) return false;

  const revisionPrefix = `${CPPG_RUNTIME_PACKAGE_KEY}:revision:`;
  if (!subject.runtimeRevisionId.startsWith(revisionPrefix)) return false;
  const revisionIdentity = subject.runtimeRevisionId.slice(revisionPrefix.length);
  if (!/^[a-f0-9]{64}$/u.test(revisionIdentity)) return false;
  const expectedFoundationHash = await sha256Canonical({
    foundationId: CPPG_FOUNDATION_ID,
    sourceManifestId: CPPG_SOURCE_MANIFEST_ID,
    sourcePackageHash: CPPG_SOURCE_PACKAGE_HASH,
    authoritySemanticHash: CPPG_FOUNDATION_SEMANTIC_HASH,
    revisionIdentity,
  });
  return subject.foundationHash === expectedFoundationHash;
}

export type CppgLedgerState = Readonly<{
  state: "NONE" | "APPROVED_ACTIVE" | "SUPERSEDED" | "REVOKED";
  subject: RuntimeAuthoritySubject | null;
  approvalSubjectHash: string | null;
  supersededByAuthorityId: string | null;
  authoritySequence: number;
}>;

export async function loadCppgLedgerState(
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  authorityId: string,
): Promise<CppgLedgerState> {
  return owner.withTransaction(async (transaction) => {
    const root = await transaction.loadAuthorityRoot(authorityId);
    const records = await transaction.loadAcceptedAuthorityEvents(authorityId);
    if (!root && records.length === 0) return { state: "NONE", subject: null, approvalSubjectHash: null, supersededByAuthorityId: null, authoritySequence: 0 };
    if (!root) throw new CppgAuthorityBindingError("CPPG_APPROVAL_BINDING_UNAVAILABLE", "CPPG authority root is missing for persisted event history");
    const successorIds = new Set<string>();
    for (const event of records) {
      if (event.eventType !== "SUPERSESSION_DECLARED") continue;
      const id = (event.payload as { successorAuthorityId?: unknown }).successorAuthorityId;
      if (typeof id === "string") successorIds.add(id);
    }
    const authoritiesById = new Map<string, AuthorityReference>();
    for (const successorId of successorIds) {
      const reference = await transaction.resolveSuccessorAuthority(successorId);
      if (!reference) throw new CppgAuthorityBindingError("CPPG_APPROVAL_BINDING_UNAVAILABLE", "CPPG successor authority is unavailable");
      authoritiesById.set(successorId, reference);
    }
    const context: AuthorityReplayContext = { authoritiesById };
    const events = persistenceRecordsToCanonicalEvents(records, authorityId, context);
    const replay = replayAuthorityLedger(authorityId, events, context);
    if (root.latestSequence !== replay.lastSequence) {
      throw new CppgAuthorityBindingError("CPPG_APPROVAL_BINDING_UNAVAILABLE", "CPPG authority sequence does not match persisted lifecycle history");
    }
    return {
      state: replay.state,
      subject: replay.record?.subject ?? null,
      approvalSubjectHash: replay.record?.approvalSubjectHash ?? null,
      supersededByAuthorityId: replay.record?.supersededByAuthorityId ?? null,
      authoritySequence: replay.lastSequence,
    };
  });
}

async function approveCppgProjection(
  projection: CppgCourseTheoryDraftProjection,
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  idempotencyKey: string,
  context: RuntimeAuthorityCommandContext = {},
) {
  const identity = await cppgAuthorityIdentity(projection);
  const desired = { subject: identity.subject, approvalSubjectHash: identity.approvalSubjectHash, createdAt: (context.now ?? (() => new Date().toISOString()))() };
  const payload = await replaySafePayload(owner, identity.authorityId, idempotencyKey, "APPROVAL_CREATED", desired);
  return executeCppgCommand(owner, {
    authorityId: identity.authorityId,
    eventType: "APPROVAL_CREATED",
    payload,
    idempotencyKey,
  }, context);
}

async function executeCppgCommand(
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  command: Readonly<{
    authorityId: string;
    eventType: "APPROVAL_CREATED" | "SUPERSESSION_DECLARED" | "REVOCATION_DECLARED";
    payload: Readonly<Record<string, unknown>>;
    idempotencyKey: string;
  }>,
  context: RuntimeAuthorityCommandContext,
) {
  try {
    return await executeRuntimeAuthorityCommand(owner, command, context);
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== "IDEMPOTENCY_CONFLICT") throw error;
    // A concurrent exact request can lose the first append race because the
    // command contract includes createdAt in its hash. Rebuild from the winner's
    // persisted payload, then let the generic writer confirm an exact replay.
    const payload = await replaySafePayload(owner, command.authorityId, command.idempotencyKey, command.eventType, command.payload);
    return executeRuntimeAuthorityCommand(owner, { ...command, payload }, context);
  }
}

async function replaySafePayload<T extends Readonly<Record<string, unknown>>>(
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  authorityId: string,
  idempotencyKey: string,
  eventType: "APPROVAL_CREATED" | "SUPERSESSION_DECLARED" | "REVOCATION_DECLARED",
  desiredPayload: T,
): Promise<T> {
  const existing = await owner.withTransaction(async (transaction) => {
    const records = await transaction.loadAcceptedAuthorityEvents(authorityId);
    return records.find((record) => record.idempotencyKey === idempotencyKey) ?? null;
  });
  if (!existing) return desiredPayload;
  const storedPayload = existing.payload as unknown as Record<string, unknown>;
  const withoutTime = (value: Record<string, unknown>) => {
    const copy = { ...value };
    delete copy.createdAt;
    return copy;
  };
  if (existing.eventType !== eventType || stableCanonicalJson(withoutTime(storedPayload)) !== stableCanonicalJson(withoutTime(desiredPayload))) {
    throw new AppError("Runtime authority idempotency key is already bound to another command.", 409, "IDEMPOTENCY_CONFLICT");
  }
  return { ...desiredPayload, createdAt: storedPayload.createdAt } as T;
}

async function hasIdempotencyRecord(owner: RuntimeAuthorityPersistenceTransactionOwner, authorityId: string, idempotencyKey: string): Promise<boolean> {
  return owner.withTransaction(async (transaction) => (await transaction.loadAcceptedAuthorityEvents(authorityId)).some((event) => event.idempotencyKey === idempotencyKey));
}

async function currentCppgProjection(
  projection: CppgCourseTheoryDraftProjection,
  owner: RuntimeAuthorityPersistenceTransactionOwner,
): Promise<CppgAuthorityCurrentness> {
  const identity = await cppgAuthorityIdentity(projection);
  const ledger = await loadCppgLedgerState(owner, identity.authorityId);
  try {
    await assertRuntimeAuthorityGate({
      expectedSubject: identity.subject,
      resolvedSubject: ledger.subject,
      authorityId: identity.authorityId,
      currentnessResolver: {
        resolveCurrentness: (subject) => ({
          state: "CURRENT",
          runtimeRevisionId: subject.runtimeRevisionId,
          semanticHash: projection.projectionSemanticHash,
        }),
      },
      lifecycleResolver: {
        resolveLifecycle: (_subject, authorityId) => authorityId === identity.authorityId && ledger.state !== "NONE" ? ledger.state : null,
      },
    });
    return { state: "CURRENT", authorityId: identity.authorityId, approvalSubjectHash: identity.approvalSubjectHash, authoritySequence: ledger.authoritySequence };
  } catch (error) {
    return {
      state: "NOT_CURRENT",
      authorityId: identity.authorityId,
      approvalSubjectHash: identity.approvalSubjectHash,
      reason: error instanceof Error ? ("code" in error ? String((error as Error & { code?: unknown }).code) : error.message) : "AUTHORITY_UNAVAILABLE",
    };
  }
}

function assertIdempotencyKey(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    throw new CppgAuthorityBindingError("CPPG_PROJECTION_ENTRYPOINT_INPUT_INVALID", "trusted idempotency key is required");
  }
}

/** Create an approval event only from the server-loaded and source-revalidated CPPG projection. */
export async function approveCppgCourseTheoryDraftAuthority(
  options: CppgProjectionOptions,
  idempotencyKey: string,
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  context: RuntimeAuthorityCommandContext = {},
) {
  assertProjectionEntryPointOptions(options);
  assertIdempotencyKey(idempotencyKey);
  assertCanonicalPostgresOwner(owner);
  return approveCppgProjection(await buildCppgCourseTheoryDraftProjection(options), owner, idempotencyKey, context);
}

/** Evaluate the current canonical revision against persisted approval and lifecycle history. */
export async function resolveCppgCourseTheoryDraftCurrentness(
  options: CppgProjectionOptions,
  owner: RuntimeAuthorityPersistenceTransactionOwner,
): Promise<CppgAuthorityCurrentness> {
  assertProjectionEntryPointOptions(options);
  if (!(owner instanceof PostgresRuntimeAuthorityPersistence)) return { state: "NOT_CURRENT", authorityId: "", approvalSubjectHash: "", reason: "APPROVAL_BINDING_UNAVAILABLE" };
  try {
    return await currentCppgProjection(await buildCppgCourseTheoryDraftProjection(options), owner);
  } catch (error) {
    return { state: "NOT_CURRENT", authorityId: "", approvalSubjectHash: "", reason: error instanceof Error && "code" in error ? String((error as Error & { code?: unknown }).code) : "CPPG_CANONICAL_IDENTITY_UNAVAILABLE" };
  }
}

/** Revoke the exact currently derived CPPG approval through the generic event writer. */
export async function revokeCppgCourseTheoryDraftAuthority(
  options: CppgProjectionOptions,
  idempotencyKey: string,
  reason: string,
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  context: RuntimeAuthorityCommandContext = {},
) {
  assertProjectionEntryPointOptions(options);
  assertIdempotencyKey(idempotencyKey);
  assertCanonicalPostgresOwner(owner);
  if (typeof reason !== "string" || reason.length === 0 || reason !== reason.trim()) throw new CppgAuthorityBindingError("CPPG_PROJECTION_ENTRYPOINT_INPUT_INVALID", "revocation reason is required");
  return revokeCppgProjection(await buildCppgCourseTheoryDraftProjection(options), idempotencyKey, reason, owner, context);
}

async function revokeCppgProjection(
  projection: CppgCourseTheoryDraftProjection,
  idempotencyKey: string,
  reason: string,
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  context: RuntimeAuthorityCommandContext,
) {
  const identity = await cppgAuthorityIdentity(projection);
  const payload = await replaySafePayload(owner, identity.authorityId, idempotencyKey, "REVOCATION_DECLARED", { reason, createdAt: (context.now ?? (() => new Date().toISOString()))() });
  if (!(await hasIdempotencyRecord(owner, identity.authorityId, idempotencyKey))) {
    const currentness = await currentCppgProjection(projection, owner);
    if (currentness.state !== "CURRENT") throw new CppgAuthorityBindingError("CPPG_APPROVAL_BINDING_UNAVAILABLE", "cannot revoke an approval that is not explicitly current");
  }
  return executeCppgCommand(owner, {
    authorityId: identity.authorityId,
    eventType: "REVOCATION_DECLARED",
    payload,
    idempotencyKey,
  }, context);
}

/** Supersede a prior CPPG revision after verifying both persisted approvals and exact subjects. */
export async function supersedeCppgCourseTheoryDraftAuthority(
  options: CppgProjectionOptions,
  priorAuthorityId: string,
  idempotencyKey: string,
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  context: RuntimeAuthorityCommandContext = {},
) {
  assertProjectionEntryPointOptions(options);
  assertIdempotencyKey(idempotencyKey);
  assertCanonicalPostgresOwner(owner);
  if (typeof priorAuthorityId !== "string" || !priorAuthorityId.startsWith("runtime-authority:cppg:")) {
    throw new CppgAuthorityBindingError("CPPG_PROJECTION_ENTRYPOINT_INPUT_INVALID", "prior CPPG authority identity is invalid");
  }
  return supersedeCppgProjection(await buildCppgCourseTheoryDraftProjection(options), priorAuthorityId, idempotencyKey, owner, context);
}

async function supersedeCppgProjection(
  successorProjection: CppgCourseTheoryDraftProjection,
  priorAuthorityId: string,
  idempotencyKey: string,
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  context: RuntimeAuthorityCommandContext,
) {
  const successor = await cppgAuthorityIdentity(successorProjection);
  const successorCurrentness = await currentCppgProjection(successorProjection, owner);
  if (successorCurrentness.state !== "CURRENT") throw new CppgAuthorityBindingError("CPPG_APPROVAL_BINDING_UNAVAILABLE", "successor CPPG authority must be approved and current before supersession");
  const prior = await loadCppgLedgerState(owner, priorAuthorityId);
  const exactSupersessionReplay = prior.state === "SUPERSEDED" && prior.supersededByAuthorityId === successor.authorityId;
  if ((prior.state !== "APPROVED_ACTIVE" && !exactSupersessionReplay) || !prior.subject || prior.approvalSubjectHash !== approvalSubjectHash(prior.subject)) {
    throw new CppgAuthorityBindingError("CPPG_APPROVAL_BINDING_UNAVAILABLE", "prior CPPG authority is not an intact active approval");
  }
  if (!(await isCanonicalCppgPredecessor(priorAuthorityId, prior.subject, prior.approvalSubjectHash))) {
    throw new CppgAuthorityBindingError("CPPG_CANONICAL_IDENTITY_MISMATCH", "prior authority is not the canonical Gate A-bound CPPG subject and authority identity");
  }
  if (priorAuthorityId === successor.authorityId) throw new CppgAuthorityBindingError("CPPG_CANONICAL_IDENTITY_MISMATCH", "a CPPG authority cannot supersede itself");
  const desired = { successorAuthorityId: successor.authorityId, successorSubjectHash: successor.approvalSubjectHash, createdAt: (context.now ?? (() => new Date().toISOString()))() };
  const payload = await replaySafePayload(owner, priorAuthorityId, idempotencyKey, "SUPERSESSION_DECLARED", desired);
  return executeCppgCommand(owner, { authorityId: priorAuthorityId, eventType: "SUPERSESSION_DECLARED", payload, idempotencyKey }, context);
}

function assertCanonicalPostgresOwner(owner: RuntimeAuthorityPersistenceTransactionOwner): asserts owner is PostgresRuntimeAuthorityPersistence {
  if (!(owner instanceof PostgresRuntimeAuthorityPersistence)) {
    throw new CppgAuthorityBindingError("CPPG_APPROVAL_BINDING_UNAVAILABLE", "CPPG Runtime Authority requires the canonical PostgreSQL persistence writer; D1 is non-canonical");
  }
}

/** Internal test seam for deterministic lifecycle coverage; disabled outside node:test. */
export async function evaluateCppgProjectionAuthorityForTesting(
  projection: CppgCourseTheoryDraftProjection,
  owner: RuntimeAuthorityPersistenceTransactionOwner,
  context: RuntimeAuthorityCommandContext = {},
) {
  if (process.env.NODE_ENV !== "test" || typeof process.env.NODE_TEST_CONTEXT !== "string") throw new CppgAuthorityBindingError("CPPG_TEST_ONLY_PERSISTENCE_PRIMITIVE", "test-only authority seam is disabled outside node:test");
  const identity = await cppgAuthorityIdentity(projection);
  const state = await currentCppgProjection(projection, owner);
  return {
    identity,
    state,
    approve: (idempotencyKey: string) => approveCppgProjection(projection, owner, idempotencyKey, context),
    revoke: (idempotencyKey: string, reason: string) => revokeCppgProjection(projection, idempotencyKey, reason, owner, context),
    supersede: (priorAuthorityId: string, idempotencyKey: string) => supersedeCppgProjection(projection, priorAuthorityId, idempotencyKey, owner, context),
  };
}

export type CppgProjectionReplayState = "EXACT_REPLAY" | "CONFLICTING_IMMUTABLE_REVISION";
export function compareCppgProjectionReplay(existing: CppgCourseTheoryDraftProjection, incoming: CppgCourseTheoryDraftProjection): CppgProjectionReplayState { return existing.courseId === incoming.courseId && existing.packageKey === incoming.packageKey && existing.projectionSemanticHash === incoming.projectionSemanticHash && existing.revisionRegistration.identities.registrationSemanticIdentity === incoming.revisionRegistration.identities.registrationSemanticIdentity ? "EXACT_REPLAY" : "CONFLICTING_IMMUTABLE_REVISION"; }
export type CppgRuntimeCollisionState = "NOT_REGISTERED" | "REGISTERED_EXACT" | "REGISTERED_PARTIAL" | "REGISTERED_CONFLICTING" | "DUPLICATE_AUTHORITY";
export type CppgExpectedRuntimeState = Readonly<{ courseId: typeof CPPG_RUNTIME_COURSE_ID; recordIds: readonly string[]; semanticHashes: Readonly<Record<string, string>> }>;
export type CppgObservedRuntimeState = Readonly<{
  /** Number of course authority rows in the scoped readback; separate from recordCount. */
  courseCount: number;
  /** Number of all persistent projection rows in the scoped readback, including the course row. */
  recordCount: number;
  /** IDs of every row counted by recordCount, including unexpected rows if present. */
  recordIds: readonly string[];
  /** One semantic hash for every recordId and no keys outside recordIds. */
  semanticHashes: Readonly<Record<string, string>>;
  /** Readback evidence for duplicate course/authority rows. */
  duplicateAuthorityCount: number;
}>;
export type CppgRuntimeReadbackRequest = Readonly<{ courseId: typeof CPPG_RUNTIME_COURSE_ID; recordIds: readonly string[] }>;
function persistentProjectionRecords(projection: CppgCourseTheoryDraftProjection): readonly ProjectionRecord[] { return [projection.course, projection.curriculumTree, ...projection.subjects, ...projection.curriculumNodes, ...projection.topics, ...projection.learningUnits, ...projection.contents, ...projection.lessons, ...projection.courseLessons, ...projection.contentRevisions]; }
export function expectedCppgRuntimeState(projection: CppgCourseTheoryDraftProjection): CppgExpectedRuntimeState { const records = persistentProjectionRecords(projection); return { courseId: projection.courseId, recordIds: records.map((record) => record.id), semanticHashes: Object.fromEntries(records.map((record) => [record.id, record.semanticHash])) }; }
function isNonNegativeSafeInteger(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
function hasUniqueNonEmptyIds(ids: readonly string[]): boolean { return ids.every((id) => typeof id === "string" && id.length > 0) && new Set(ids).size === ids.length; }
function sameSortedIds(left: readonly string[], right: readonly string[]): boolean { const a = [...left].sort(), b = [...right].sort(); return a.length === b.length && a.every((id, index) => id === b[index]); }
function hasExactHashKeys(ids: readonly string[], hashes: Readonly<Record<string, string>>): boolean { const keys = Object.keys(hashes); return sameSortedIds(ids, keys) && ids.every((id) => typeof hashes[id] === "string" && hashes[id].length > 0); }
export function classifyCppgRuntimeCollision(expected: CppgExpectedRuntimeState, observed: CppgObservedRuntimeState): CppgRuntimeCollisionState {
  const expectedIds = [...expected.recordIds], observedIds = [...observed.recordIds];
  if (!hasUniqueNonEmptyIds(expectedIds) || expectedIds.length === 0 || !expectedIds.includes(expected.courseId) || !hasExactHashKeys(expectedIds, expected.semanticHashes)) return "REGISTERED_CONFLICTING";
  if (!isNonNegativeSafeInteger(observed.courseCount) || !isNonNegativeSafeInteger(observed.recordCount) || !isNonNegativeSafeInteger(observed.duplicateAuthorityCount)) return "REGISTERED_CONFLICTING";
  if (observed.duplicateAuthorityCount > 0 || observed.courseCount > 1) return "DUPLICATE_AUTHORITY";
  if (!hasUniqueNonEmptyIds(observedIds) || observed.recordCount !== observedIds.length || !hasExactHashKeys(observedIds, observed.semanticHashes)) return "REGISTERED_CONFLICTING";
  if (observed.courseCount === 0) return observed.recordCount === 0 && observedIds.length === 0 ? "NOT_REGISTERED" : "REGISTERED_CONFLICTING";
  if (observed.courseCount !== 1 || !observedIds.includes(expected.courseId)) return "REGISTERED_CONFLICTING";
  if (observed.recordCount < expectedIds.length) return "REGISTERED_PARTIAL";
  if (observed.recordCount === expectedIds.length && sameSortedIds(observedIds, expectedIds) && expectedIds.every((id) => observed.semanticHashes[id] === expected.semanticHashes[id])) return "REGISTERED_EXACT";
  return "REGISTERED_CONFLICTING";
}
export function interpretCppgStaticSeed(): Readonly<{ staticState: "STATIC_REGISTERED_EXACT"; runtimeState: "UNKNOWN_NOT_QUERIED" }> { return { staticState: "STATIC_REGISTERED_EXACT", runtimeState: "UNKNOWN_NOT_QUERIED" }; }
export type CppgDraftTransaction = Readonly<{ apply(stage: CppgPersistenceStage, records: readonly ProjectionRecord[]): Promise<void>; commit(): Promise<void>; rollback(): Promise<void> }>;
export type CppgDraftPersistenceAdapter = Readonly<{ inspect(input: CppgRuntimeReadbackRequest): Promise<CppgObservedRuntimeState>; begin(): Promise<CppgDraftTransaction> }>;
export type CppgPersistenceResult = Readonly<{ outcome: "NEW_SUCCESS" | "EXACT_REPLAY"; collisionState: CppgRuntimeCollisionState; appliedStages: readonly CppgPersistenceStage[] }>;
export class CppgRuntimeCollisionError extends Error {
  readonly code = "CPPG_RUNTIME_COLLISION_FAIL_CLOSED";
  readonly collisionState: Exclude<CppgRuntimeCollisionState, "NOT_REGISTERED" | "REGISTERED_EXACT">;
  constructor(collisionState: Exclude<CppgRuntimeCollisionState, "NOT_REGISTERED" | "REGISTERED_EXACT">) { super("CPPG runtime registration refused: " + collisionState); this.name = "CppgRuntimeCollisionError"; this.collisionState = collisionState; }
}
async function persistCppgCourseTheoryDraftPlan(
  projection: CppgCourseTheoryDraftProjection,
  adapter: CppgDraftPersistenceAdapter,
  beforeRegistration?: () => Promise<void>,
): Promise<CppgPersistenceResult> {
  const expected = expectedCppgRuntimeState(projection);
  const collisionState = classifyCppgRuntimeCollision(expected, await adapter.inspect({ courseId: projection.courseId, recordIds: expected.recordIds }));
  if (collisionState === "REGISTERED_EXACT") {
    await beforeRegistration?.();
    return { outcome: "EXACT_REPLAY", collisionState, appliedStages: [] };
  }
  if (collisionState !== "NOT_REGISTERED") throw new CppgRuntimeCollisionError(collisionState);
  await beforeRegistration?.();
  const transaction = await adapter.begin();
  const stageRecords: Readonly<Record<CppgPersistenceStage, readonly ProjectionRecord[]>> = { COURSE: [projection.course], CURRICULUM_TREE: [projection.curriculumTree], SUBJECTS: projection.subjects, CURRICULUM_NODES: projection.curriculumNodes, TOPICS: projection.topics, LEARNING_UNITS: projection.learningUnits, CONTENTS: projection.contents, LESSONS: projection.lessons, COURSE_LESSONS: projection.courseLessons, CONTENT_REVISIONS: projection.contentRevisions };
  const appliedStages: CppgPersistenceStage[] = [];
  try {
    for (const stage of CPPG_PERSISTENCE_ORDER) { await transaction.apply(stage, stageRecords[stage]); appliedStages.push(stage); }
    await transaction.commit();
    return { outcome: "NEW_SUCCESS", collisionState, appliedStages };
  } catch (error) { try { await transaction.rollback(); } catch { /* preserve original failure */ } throw error; }
}
export async function persistCppgCourseTheoryDraft(
  options: CppgProjectionOptions,
  authorityOwner: RuntimeAuthorityPersistenceTransactionOwner,
): Promise<CppgPersistenceResult> {
  assertProjectionEntryPointOptions(options);
  assertCanonicalPostgresOwner(authorityOwner);
  const projection = await buildCppgCourseTheoryDraftProjection(options);
  return persistCppgCourseTheoryDraftProjection(projection, options.actorUserId, authorityOwner);
}

async function persistCppgCourseTheoryDraftProjection(
  projection: CppgCourseTheoryDraftProjection,
  registeredBy: string,
  authorityOwner: PostgresRuntimeAuthorityPersistence,
): Promise<CppgPersistenceResult> {
  return authorityOwner.withRegistrationTransaction(async (transactionAuthorityOwner, executor) => {
    const identity = await cppgAuthorityIdentity(projection);
    const currentness = await currentCppgProjection(projection, transactionAuthorityOwner);
    if (currentness.state !== "CURRENT" || !currentness.authoritySequence) {
      throw new CppgAuthorityBindingError("CPPG_APPROVAL_BINDING_UNAVAILABLE", `CPPG authority is not current (${currentness.reason ?? "NOT_CURRENT"}); Course/Theory Draft registration remains HOLD`);
    }
    const adapter = new PostgresCppgDraftPersistenceAdapter(executor, {
      identity,
      currentness: { ...currentness, authoritySequence: currentness.authoritySequence },
      projection,
      registeredBy,
    });
    return persistCppgCourseTheoryDraftPlan(projection, adapter, async () => {
      const latest = await currentCppgProjection(projection, transactionAuthorityOwner);
      if (latest.state !== "CURRENT" || latest.approvalSubjectHash !== identity.approvalSubjectHash || latest.authorityId !== identity.authorityId || latest.authoritySequence !== currentness.authoritySequence) {
        throw new CppgAuthorityBindingError("CPPG_APPROVAL_BINDING_UNAVAILABLE", `CPPG authority changed before registration commit (${latest.reason ?? "NOT_CURRENT"}); Course/Theory Draft registration remains HOLD`);
      }
    });
  });
}

/** PostgreSQL transaction integration seam for tests with canonical projection fixtures. */
export async function persistCppgCourseTheoryDraftProjectionForTesting(
  projection: CppgCourseTheoryDraftProjection,
  registeredBy: string,
  authorityOwner: RuntimeAuthorityPersistenceTransactionOwner,
): Promise<CppgPersistenceResult> {
  const runningNodeTest = typeof process.env.NODE_TEST_CONTEXT === "string";
  if (process.env.NODE_ENV !== "test" || !runningNodeTest) throw new CppgAuthorityBindingError("CPPG_TEST_ONLY_PERSISTENCE_PRIMITIVE", "projection persistence test primitive is disabled outside the Node test runner");
  assertCanonicalPostgresOwner(authorityOwner);
  return persistCppgCourseTheoryDraftProjection(projection, registeredBy, authorityOwner);
}
/** Internal transaction tests only; this is never a registration authority entrypoint. */
export async function persistCppgCourseTheoryDraftForTesting(projection: CppgCourseTheoryDraftProjection, adapter: CppgDraftPersistenceAdapter): Promise<CppgPersistenceResult> {
  const runningNodeTest = typeof process.env.NODE_TEST_CONTEXT === "string";
  if (process.env.NODE_ENV !== "test" || !runningNodeTest) throw new CppgAuthorityBindingError("CPPG_TEST_ONLY_PERSISTENCE_PRIMITIVE", "projection persistence test primitive is disabled outside the Node test runner");
  return persistCppgCourseTheoryDraftPlan(projection, adapter);
}
