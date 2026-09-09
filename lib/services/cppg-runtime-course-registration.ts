import { sha256Canonical, stableCanonicalJson } from "../policy/stable-canonical-hash.ts";
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

function invariant(condition: unknown, message: string): asserts condition { if (!condition) throw new Error("CPPG projection invariant failed: " + message); }
function assertNoForbiddenKeys(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);
  invariant(!serialized.includes("officialQuestionAllocation"), label + " contains unsupported official allocation claim");
  invariant(!serialized.includes("SOURCE_QUESTION_INGESTED"), label + " contains source-question ingestion");
  invariant(!serialized.includes("EXECUTABLE_LAB"), label + " contains executable Lab state");
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

export async function buildCppgCourseTheoryDraftProjection(bundle: CppgFoundationBundle, options: CppgProjectionOptions): Promise<CppgCourseTheoryDraftProjection> {
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
export function compareCppgProjectionReplay(existing: CppgCourseTheoryDraftProjection, incoming: CppgCourseTheoryDraftProjection): "EXACT_REPLAY" | "NEW_IMMUTABLE_REVISION" { return existing.courseId === incoming.courseId && existing.packageKey === incoming.packageKey && existing.projectionSemanticHash === incoming.projectionSemanticHash && existing.revisionRegistration.identities.registrationSemanticIdentity === incoming.revisionRegistration.identities.registrationSemanticIdentity ? "EXACT_REPLAY" : "NEW_IMMUTABLE_REVISION"; }
export type CppgRuntimeCollisionState = "NOT_REGISTERED" | "REGISTERED_EXACT" | "REGISTERED_PARTIAL" | "REGISTERED_CONFLICTING" | "DUPLICATE_AUTHORITY";
export type CppgExpectedRuntimeState = Readonly<{ courseId: typeof CPPG_RUNTIME_COURSE_ID; recordIds: readonly string[]; semanticHashes: Readonly<Record<string, string>> }>;
export type CppgObservedRuntimeState = Readonly<{ courseCount: number; recordCount: number; recordIds: readonly string[]; semanticHashes: Readonly<Record<string, string>>; duplicateAuthorityCount: number }>;
export type CppgRuntimeReadbackRequest = Readonly<{ courseId: typeof CPPG_RUNTIME_COURSE_ID; recordIds: readonly string[] }>;
function persistentProjectionRecords(projection: CppgCourseTheoryDraftProjection): readonly ProjectionRecord[] { return [projection.course, projection.curriculumTree, ...projection.subjects, ...projection.curriculumNodes, ...projection.topics, ...projection.learningUnits, ...projection.contents, ...projection.lessons, ...projection.courseLessons, ...projection.contentRevisions]; }
export function expectedCppgRuntimeState(projection: CppgCourseTheoryDraftProjection): CppgExpectedRuntimeState { const records = persistentProjectionRecords(projection); return { courseId: projection.courseId, recordIds: records.map((record) => record.id), semanticHashes: Object.fromEntries(records.map((record) => [record.id, record.semanticHash])) }; }
export function classifyCppgRuntimeCollision(expected: CppgExpectedRuntimeState, observed: CppgObservedRuntimeState): CppgRuntimeCollisionState {
  if (observed.courseCount === 0 && observed.recordCount === 0) return "NOT_REGISTERED";
  if (observed.duplicateAuthorityCount > 0 || observed.courseCount > 1) return "DUPLICATE_AUTHORITY";
  if (observed.courseCount > 0 && observed.recordCount < expected.recordIds.length) return "REGISTERED_PARTIAL";
  const observedIds = [...observed.recordIds].sort(), expectedIds = [...expected.recordIds].sort();
  if (observed.courseCount > 0 && observedIds.length === expectedIds.length && observedIds.every((id, index) => id === expectedIds[index]) && expectedIds.every((id) => observed.semanticHashes[id] === expected.semanticHashes[id])) return "REGISTERED_EXACT";
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
export async function persistCppgCourseTheoryDraft(projection: CppgCourseTheoryDraftProjection, adapter: CppgDraftPersistenceAdapter): Promise<CppgPersistenceResult> {
  const expected = expectedCppgRuntimeState(projection);
  const collisionState = classifyCppgRuntimeCollision(expected, await adapter.inspect({ courseId: projection.courseId, recordIds: expected.recordIds }));
  if (collisionState === "REGISTERED_EXACT") return { outcome: "EXACT_REPLAY", collisionState, appliedStages: [] };
  if (collisionState !== "NOT_REGISTERED") throw new CppgRuntimeCollisionError(collisionState);
  const transaction = await adapter.begin();
  const stageRecords: Readonly<Record<CppgPersistenceStage, readonly ProjectionRecord[]>> = { COURSE: [projection.course], CURRICULUM_TREE: [projection.curriculumTree], SUBJECTS: projection.subjects, CURRICULUM_NODES: projection.curriculumNodes, TOPICS: projection.topics, LEARNING_UNITS: projection.learningUnits, CONTENTS: projection.contents, LESSONS: projection.lessons, COURSE_LESSONS: projection.courseLessons, CONTENT_REVISIONS: projection.contentRevisions };
  const appliedStages: CppgPersistenceStage[] = [];
  try {
    for (const stage of CPPG_PERSISTENCE_ORDER) { await transaction.apply(stage, stageRecords[stage]); appliedStages.push(stage); }
    await transaction.commit();
    return { outcome: "NEW_SUCCESS", collisionState, appliedStages };
  } catch (error) { try { await transaction.rollback(); } catch { /* preserve original failure */ } throw error; }
}
