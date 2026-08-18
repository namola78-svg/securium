import {
  flattenOfficialCurriculumTree,
  getOfficialCurriculumTree,
} from "./security-certification-standards.ts";
import { resolveQuestionCurriculumPlacement } from "./security-certification-content-map.ts";
import { applicationSecurityQuestionSamples } from "../data/security-certification-application-security-questions.mjs";
import {
  officialSecurityCertificationContents,
  officialSecurityCertificationCourseLessons,
} from "../data/security-certification-course-lessons.mjs";
import { securityCertificationInformationSecurityGeneralQuestionSamples } from "../data/security-certification-information-security-general-questions.mjs";
import { managementLawQuestionSamples } from "../data/security-certification-management-law-questions.mjs";
import { networkSecurityQuestionSamples } from "../data/security-certification-network-security-questions.mjs";
import { practicalSecurityQuestionSamples } from "../data/security-certification-practical-questions.mjs";
import { systemSecurityQuestionSamples } from "../data/security-certification-system-security-questions.mjs";

export const ENGINEER_BETA_ACTIVATION_BLOCKER_CODES = [
  "REGISTRY_NODE_MISSING",
  "REGISTRY_NODE_DUPLICATE",
  "REGISTRY_STABLE_KEY_DUPLICATE",
  "REGISTRY_PARENT_INVALID",
  "REGISTRY_COURSE_TREE_MISMATCH",
  "REQUIRED_LEARNING_NODE_UNPLACED",
  "CONTENT_MISSING",
  "QUESTION_ZERO_TARGET",
  "QUESTION_AMBIGUOUS_TARGET",
  "SOURCE_BINDING_INVALID",
  "EFFECTIVE_PERIOD_INVALID",
  "PAGE_PROVENANCE_INCOMPLETE",
  "RIGHTS_REVIEW_INCOMPLETE",
  "CROSS_COURSE_PLACEMENT_INVALID",
  "UNKNOWN_VALIDATION_STATE",
] as const;

export type EngineerBetaActivationBlockerCode =
  (typeof ENGINEER_BETA_ACTIVATION_BLOCKER_CODES)[number];

export type EngineerBetaActivationWarningCode =
  | "SOURCE_NOT_YET_EFFECTIVE"
  | "SEMANTIC_TITLE_DRIFT"
  | "LEGITIMATE_SHARED_CONTENT";

type EvidenceStatus = "COMPLETE" | "INCOMPLETE" | "UNKNOWN";

export type EngineerBetaActivationNode = {
  id: string;
  stableKey: string;
  treeId: string;
  parentId: string | null;
  nodeType: string;
  isRequired: boolean;
};

export type EngineerBetaActivationCourseLesson = {
  id: string;
  courseId: string;
  curriculumNodeId: string;
  contentId: string;
};

export type EngineerBetaActivationQuestion = {
  id: string;
  officialPlacementNodeIds: string[] | null;
};

export type EngineerBetaActivationInput = {
  now: string;
  contract: {
    courseId: string;
    treeId: string;
    version: string;
    sourceSha256: string;
    sourceDocument: string;
    effectiveFrom: string;
    effectiveTo: string;
    expectedNodes: EngineerBetaActivationNode[];
  };
  actual: {
    courseId: string;
    treeId: string;
    version: string;
    sourceSha256: string;
    sourceDocument: string;
    effectiveFrom: string;
    effectiveTo: string;
    nodes: EngineerBetaActivationNode[];
    courseLessons: EngineerBetaActivationCourseLesson[];
    contentIds: string[];
    questions: EngineerBetaActivationQuestion[];
    crossCourseSharedContentCount: number;
    titleDriftNodeIds: string[];
  };
  evidence: {
    pageProvenance: EvidenceStatus;
    rightsReview: EvidenceStatus;
  };
};

export type EngineerBetaActivationFinding<Code extends string> = {
  code: Code;
  entityIds: string[];
  message: string;
};

export type EngineerBetaActivationResult = {
  eligible: boolean;
  blockers: EngineerBetaActivationFinding<EngineerBetaActivationBlockerCode>[];
  warnings: EngineerBetaActivationFinding<EngineerBetaActivationWarningCode>[];
  stats: {
    expectedRegistryNodeCount: number;
    actualRegistryNodeCount: number;
    requiredLearningNodeCount: number;
    unplacedRequiredNodeCount: number;
    courseLessonCount: number;
    questionCount: number;
    zeroTargetQuestionCount: number;
    ambiguousQuestionCount: number;
    crossCourseSharedContentCount: number;
    crossCourseInvalidCount: number;
    titleDriftCount: number;
  };
};

const ENGINEER_COURSE_ID = "course-ise";
const ENGINEER_TREE_ID = "curriculum-ise-2027-2029-official";
const CURRENT_TITLE_DRIFT_NODE_IDS = [
  "curriculum-node-ise-2027-2029-01-02-03-02",
  "curriculum-node-ise-2027-2029-01-03-02-01",
  "curriculum-node-ise-2027-2029-02-01-02-04",
];

function curriculumNodeId(stableKey: string) {
  return `curriculum-node-${stableKey.toLowerCase()}`;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function pushFinding<Code extends string>(
  findings: EngineerBetaActivationFinding<Code>[],
  code: Code,
  entityIds: string[],
  message: string,
) {
  findings.push({ code, entityIds: unique(entityIds).sort(), message });
}

export function buildCurrentEngineerBetaActivationInput({
  now = new Date().toISOString().slice(0, 10),
  pageProvenance = "INCOMPLETE",
  rightsReview = "INCOMPLETE",
}: {
  now?: string;
  pageProvenance?: EvidenceStatus;
  rightsReview?: EvidenceStatus;
} = {}): EngineerBetaActivationInput {
  const tree = getOfficialCurriculumTree(ENGINEER_TREE_ID);
  if (!tree) {
    throw new Error(`Engineer curriculum tree is missing: ${ENGINEER_TREE_ID}`);
  }

  const nodes = flattenOfficialCurriculumTree(tree).map((node) => ({
    id: curriculumNodeId(node.stableKey),
    stableKey: node.stableKey,
    treeId: tree.treeId,
    parentId: node.parentStableKey ? curriculumNodeId(node.parentStableKey) : null,
    nodeType: node.nodeType,
    isRequired: node.isRequired,
  }));
  const courseLessons = officialSecurityCertificationCourseLessons
    .filter((lesson) => lesson.courseId === ENGINEER_COURSE_ID)
    .map((lesson) => ({
      id: lesson.id,
      courseId: lesson.courseId,
      curriculumNodeId: lesson.curriculumNodeId,
      contentId: lesson.contentId,
    }));
  const allQuestions = [
    ...systemSecurityQuestionSamples,
    ...networkSecurityQuestionSamples,
    ...applicationSecurityQuestionSamples,
    ...securityCertificationInformationSecurityGeneralQuestionSamples,
    ...managementLawQuestionSamples,
    ...practicalSecurityQuestionSamples,
  ];
  const questions = allQuestions
    .filter((question) =>
      question.courseLinks.some(
        (link: { courseId: string }) => link.courseId === ENGINEER_COURSE_ID,
      ),
    )
    .map((question) => {
      try {
        return {
          id: question.id,
          officialPlacementNodeIds: resolveQuestionCurriculumPlacement(question, {
            courseId: ENGINEER_COURSE_ID,
            curriculumTreeId: ENGINEER_TREE_ID,
          }).officialPlacementNodeIds,
        };
      } catch {
        return { id: question.id, officialPlacementNodeIds: null };
      }
    });
  const coursesByContentId = new Map<string, Set<string>>();
  for (const lesson of officialSecurityCertificationCourseLessons) {
    const courseIds = coursesByContentId.get(lesson.contentId) ?? new Set<string>();
    courseIds.add(lesson.courseId);
    coursesByContentId.set(lesson.contentId, courseIds);
  }
  const crossCourseSharedContentCount = new Set(
    courseLessons
      .filter((lesson) => (coursesByContentId.get(lesson.contentId)?.size ?? 0) > 1)
      .map((lesson) => lesson.contentId),
  ).size;

  const contract = {
    courseId: tree.courseId,
    treeId: tree.treeId,
    version: tree.version,
    sourceSha256: tree.officialSource.sourceSha256,
    sourceDocument: tree.sourceDocument,
    effectiveFrom: tree.effectiveFrom,
    effectiveTo: tree.effectiveTo,
    expectedNodes: nodes,
  };

  return {
    now,
    contract,
    actual: {
      courseId: tree.courseId,
      treeId: tree.treeId,
      version: tree.version,
      sourceSha256: tree.officialSource.sourceSha256,
      sourceDocument: tree.sourceDocument,
      effectiveFrom: tree.effectiveFrom,
      effectiveTo: tree.effectiveTo,
      nodes: nodes.map((node) => ({ ...node })),
      courseLessons,
      contentIds: officialSecurityCertificationContents.map((content) => content.id),
      questions,
      crossCourseSharedContentCount,
      titleDriftNodeIds: [...CURRENT_TITLE_DRIFT_NODE_IDS],
    },
    evidence: { pageProvenance, rightsReview },
  };
}

export function evaluateEngineerBetaActivationEligibility(
  input: EngineerBetaActivationInput,
): EngineerBetaActivationResult {
  const blockers: EngineerBetaActivationResult["blockers"] = [];
  const warnings: EngineerBetaActivationResult["warnings"] = [];
  const { contract, actual } = input;

  const requiredStrings = [
    input.now,
    contract.courseId,
    contract.treeId,
    contract.version,
    contract.sourceSha256,
    contract.sourceDocument,
    contract.effectiveFrom,
    contract.effectiveTo,
    actual.courseId,
    actual.treeId,
    actual.version,
    actual.sourceSha256,
    actual.sourceDocument,
    actual.effectiveFrom,
    actual.effectiveTo,
  ];
  if (
    requiredStrings.some((value) => !value) ||
    input.evidence.pageProvenance === "UNKNOWN" ||
    input.evidence.rightsReview === "UNKNOWN"
  ) {
    pushFinding(
      blockers,
      "UNKNOWN_VALIDATION_STATE",
      [actual.treeId || contract.treeId],
      "Required activation evidence is absent or unknown.",
    );
  }

  if (
    actual.courseId !== contract.courseId ||
    actual.treeId !== contract.treeId ||
    actual.version !== contract.version
  ) {
    pushFinding(
      blockers,
      "REGISTRY_COURSE_TREE_MISMATCH",
      [actual.courseId, actual.treeId],
      "Engineer course, tree, or version does not match the canonical contract.",
    );
  }

  if (
    actual.sourceSha256 !== contract.sourceSha256 ||
    actual.sourceDocument !== contract.sourceDocument
  ) {
    pushFinding(
      blockers,
      "SOURCE_BINDING_INVALID",
      [actual.treeId],
      "Engineer source identity does not match the authenticated registry binding.",
    );
  }

  const effectiveFrom = Date.parse(`${actual.effectiveFrom}T00:00:00Z`);
  const effectiveTo = Date.parse(`${actual.effectiveTo}T23:59:59Z`);
  const now = Date.parse(`${input.now}T00:00:00Z`);
  if (
    actual.effectiveFrom !== contract.effectiveFrom ||
    actual.effectiveTo !== contract.effectiveTo ||
    !Number.isFinite(effectiveFrom) ||
    !Number.isFinite(effectiveTo) ||
    !Number.isFinite(now) ||
    effectiveFrom > effectiveTo ||
    now > effectiveTo
  ) {
    pushFinding(
      blockers,
      "EFFECTIVE_PERIOD_INVALID",
      [actual.treeId],
      "Engineer effective-period semantics are invalid or outside the target period.",
    );
  } else if (now < effectiveFrom) {
    pushFinding(
      warnings,
      "SOURCE_NOT_YET_EFFECTIVE",
      [actual.treeId],
      "The target-current 2027-2029 source is not yet effective; activation must not occur early.",
    );
  }

  const expectedById = new Map(contract.expectedNodes.map((node) => [node.id, node]));
  const actualNodeIds = actual.nodes.map((node) => node.id);
  const duplicateNodeIds = unique(
    actualNodeIds.filter((id, index) => actualNodeIds.indexOf(id) !== index),
  );
  if (duplicateNodeIds.length > 0) {
    pushFinding(
      blockers,
      "REGISTRY_NODE_DUPLICATE",
      duplicateNodeIds,
      "Curriculum node IDs must be unique.",
    );
  }
  const actualStableKeys = actual.nodes.map((node) => node.stableKey);
  const duplicateStableKeys = unique(
    actualStableKeys.filter(
      (stableKey, index) => actualStableKeys.indexOf(stableKey) !== index,
    ),
  );
  if (duplicateStableKeys.length > 0) {
    pushFinding(
      blockers,
      "REGISTRY_STABLE_KEY_DUPLICATE",
      duplicateStableKeys,
      "Curriculum stable keys must be unique.",
    );
  }
  const actualById = new Map(actual.nodes.map((node) => [node.id, node]));
  const missingNodeIds = contract.expectedNodes
    .filter((node) => !actualById.has(node.id))
    .map((node) => node.id);
  if (missingNodeIds.length > 0) {
    pushFinding(
      blockers,
      "REGISTRY_NODE_MISSING",
      missingNodeIds,
      "Canonical Engineer curriculum nodes are missing.",
    );
  }
  const ownershipMismatches = actual.nodes
    .filter((node) => node.treeId !== contract.treeId || !expectedById.has(node.id))
    .map((node) => node.id);
  if (ownershipMismatches.length > 0) {
    pushFinding(
      blockers,
      "REGISTRY_COURSE_TREE_MISMATCH",
      ownershipMismatches,
      "Curriculum nodes do not belong to the exact Engineer tree contract.",
    );
  }
  const parentMismatches = actual.nodes
    .filter((node) => {
      const expected = expectedById.get(node.id);
      return expected && node.parentId !== expected.parentId;
    })
    .map((node) => node.id);
  if (parentMismatches.length > 0) {
    pushFinding(
      blockers,
      "REGISTRY_PARENT_INVALID",
      parentMismatches,
      "Curriculum parent relationships do not match stable identities.",
    );
  }

  const contentIds = new Set(actual.contentIds);
  const invalidCourseLessons = actual.courseLessons.filter(
    (lesson) =>
      lesson.courseId !== contract.courseId || !expectedById.has(lesson.curriculumNodeId),
  );
  if (invalidCourseLessons.length > 0) {
    pushFinding(
      blockers,
      "CROSS_COURSE_PLACEMENT_INVALID",
      invalidCourseLessons.map((lesson) => lesson.id),
      "CourseLesson placement crosses or escapes the Engineer tree contract.",
    );
  }
  const missingContentLessons = actual.courseLessons.filter(
    (lesson) => !contentIds.has(lesson.contentId),
  );
  if (missingContentLessons.length > 0) {
    pushFinding(
      blockers,
      "CONTENT_MISSING",
      missingContentLessons.map((lesson) => lesson.id),
      "CourseLesson references unresolved canonical Content.",
    );
  }
  const placedNodeIds = new Set(
    actual.courseLessons
      .filter(
        (lesson) =>
          lesson.courseId === contract.courseId && contentIds.has(lesson.contentId),
      )
      .map((lesson) => lesson.curriculumNodeId),
  );
  const requiredLearningNodes = contract.expectedNodes.filter(
    (node) => node.isRequired && node.nodeType !== "TRACK",
  );
  const unplacedRequiredNodeIds = requiredLearningNodes
    .filter((node) => !placedNodeIds.has(node.id))
    .map((node) => node.id);
  if (unplacedRequiredNodeIds.length > 0) {
    pushFinding(
      blockers,
      "REQUIRED_LEARNING_NODE_UNPLACED",
      unplacedRequiredNodeIds,
      "Required Engineer learning nodes lack a deterministic CourseLesson/Content placement.",
    );
  }

  const unknownQuestions = actual.questions
    .filter((question) => question.officialPlacementNodeIds === null)
    .map((question) => question.id);
  if (unknownQuestions.length > 0) {
    pushFinding(
      blockers,
      "UNKNOWN_VALIDATION_STATE",
      unknownQuestions,
      "Question placement validation failed and cannot be treated as eligible.",
    );
  }
  const zeroTargetQuestionIds = actual.questions
    .filter((question) => question.officialPlacementNodeIds?.length === 0)
    .map((question) => question.id);
  if (zeroTargetQuestionIds.length > 0) {
    pushFinding(
      blockers,
      "QUESTION_ZERO_TARGET",
      zeroTargetQuestionIds,
      "Required Engineer Questions must resolve to an official placement.",
    );
  }
  const ambiguousQuestionIds = actual.questions
    .filter((question) => (question.officialPlacementNodeIds?.length ?? 0) > 1)
    .map((question) => question.id);
  if (ambiguousQuestionIds.length > 0) {
    pushFinding(
      blockers,
      "QUESTION_AMBIGUOUS_TARGET",
      ambiguousQuestionIds,
      "Beta lifecycle activation requires deterministic official Question placement.",
    );
  }

  if (input.evidence.pageProvenance !== "COMPLETE") {
    pushFinding(
      blockers,
      "PAGE_PROVENANCE_INCOMPLETE",
      [actual.treeId],
      "Stable-graph Page Provenance is required for Beta lifecycle activation.",
    );
  }
  if (input.evidence.rightsReview !== "COMPLETE") {
    pushFinding(
      blockers,
      "RIGHTS_REVIEW_INCOMPLETE",
      [actual.treeId],
      "Rights eligibility must be supplied by the separately governed copyright contract.",
    );
  }

  if (actual.titleDriftNodeIds.length > 0) {
    pushFinding(
      warnings,
      "SEMANTIC_TITLE_DRIFT",
      actual.titleDriftNodeIds,
      "Title drift is reported but does not replace stable-ID identity validation.",
    );
  }
  if (actual.crossCourseSharedContentCount > 0) {
    pushFinding(
      warnings,
      "LEGITIMATE_SHARED_CONTENT",
      [],
      "Cross-course shared Content is allowed when CourseLesson placement remains course/tree valid.",
    );
  }

  return {
    eligible: blockers.length === 0,
    blockers,
    warnings,
    stats: {
      expectedRegistryNodeCount: contract.expectedNodes.length,
      actualRegistryNodeCount: actual.nodes.length,
      requiredLearningNodeCount: requiredLearningNodes.length,
      unplacedRequiredNodeCount: unplacedRequiredNodeIds.length,
      courseLessonCount: actual.courseLessons.length,
      questionCount: actual.questions.length,
      zeroTargetQuestionCount: zeroTargetQuestionIds.length,
      ambiguousQuestionCount: ambiguousQuestionIds.length,
      crossCourseSharedContentCount: actual.crossCourseSharedContentCount,
      crossCourseInvalidCount: invalidCourseLessons.length,
      titleDriftCount: actual.titleDriftNodeIds.length,
    },
  };
}

export function evaluateCurrentEngineerBetaActivationEligibility(options?: {
  now?: string;
  pageProvenance?: EvidenceStatus;
  rightsReview?: EvidenceStatus;
}) {
  return evaluateEngineerBetaActivationEligibility(
    buildCurrentEngineerBetaActivationInput(options),
  );
}
