import {
  SECURITY_CERTIFICATION_CURRICULUM_TREES,
  flattenOfficialCurriculumTree,
  type OfficialCurriculumNodeType,
} from "./security-certification-standards.ts";
import {
  effectiveOfficialSecurityCertificationCourseLessons,
  officialSecurityCertificationContents,
  officialSecurityCertificationCourseLessonExtensions,
} from "../data/security-certification-course-lessons.mjs";
import {
  networkSecurityQuestionSamples,
} from "../data/security-certification-network-security-questions.mjs";
import {
  systemSecurityQuestionSamples,
  SYSTEM_SECURITY_CONTENT_ID,
} from "../data/security-certification-system-security-questions.mjs";
import {
  applicationSecurityQuestionSamples,
  APPLICATION_SECURITY_CONTENT_ID,
} from "../data/security-certification-application-security-questions.mjs";
import {
  securityCertificationInformationSecurityGeneralQuestionSamples,
  INFORMATION_SECURITY_GENERAL_CONTENT_ID,
} from "../data/security-certification-information-security-general-questions.mjs";
import {
  managementLawQuestionSamples,
  MANAGEMENT_LAW_CONTENT_ID,
} from "../data/security-certification-management-law-questions.mjs";
import {
  practicalSecurityQuestionSamples,
  PRACTICAL_SECURITY_CONTENT_ID,
} from "../data/security-certification-practical-questions.mjs";

export type SecurityCertificationContentMapRow = {
  treeId: string;
  courseId: string;
  courseCode: string;
  stableKey: string;
  curriculumNodeId: string;
  title: string;
  nodeType: OfficialCurriculumNodeType;
  officialLevel: string;
  isMapped: boolean;
  courseLessonIds: string[];
  contentIds: string[];
  contentTitles: string[];
  extensionCount: number;
  questionCount: number;
  questionCourseIds: string[];
};

type CourseLessonSeedRecord = {
  id: string;
  courseId: string;
  curriculumNodeId: string;
  contentId: string;
};

type ContentSeedRecord = {
  id: string;
  title: string;
};

type CourseLessonExtensionSeedRecord = {
  courseLessonId: string;
};

export type SecurityCertificationQuestionPrimaryCurriculumPlacement = {
  /** Course-owned placement provenance; this is not a supporting Content or Concept edge. */
  courseId: string;
  /** Keeps placements for different official curriculum versions independently addressable. */
  curriculumTreeId: string;
  curriculumNodeId: string;
};

export type SecurityCertificationQuestionPlacementSeed = {
  courseLinks: ReadonlyArray<{
    courseId: string;
  }>;
  contentLinks?: ReadonlyArray<{
    contentType: string;
    contentId: string;
  }>;
  primaryCurriculumPlacements?: ReadonlyArray<SecurityCertificationQuestionPrimaryCurriculumPlacement>;
};

export type SecurityCertificationQuestionPlacementResolution = {
  mode: "EXPLICIT_PRIMARY" | "LEGACY_CONTENT_DERIVED";
  primaryPlacement: SecurityCertificationQuestionPrimaryCurriculumPlacement | null;
  officialPlacementNodeIds: string[];
  supportingContentIds: string[];
};

type QuestionSeedRecord = SecurityCertificationQuestionPlacementSeed;

const contentSeedRecords =
  officialSecurityCertificationContents as ContentSeedRecord[];
const courseLessonSeedRecords =
  effectiveOfficialSecurityCertificationCourseLessons as CourseLessonSeedRecord[];
const courseLessonExtensionSeedRecords =
  officialSecurityCertificationCourseLessonExtensions as CourseLessonExtensionSeedRecord[];

const questionSamplesByContentId = buildQuestionSamplesByContentId([
  {
    fallbackContentId: SYSTEM_SECURITY_CONTENT_ID,
    questions: systemSecurityQuestionSamples as QuestionSeedRecord[],
  },
  {
    fallbackContentId: APPLICATION_SECURITY_CONTENT_ID,
    questions: applicationSecurityQuestionSamples as QuestionSeedRecord[],
  },
  {
    fallbackContentId: INFORMATION_SECURITY_GENERAL_CONTENT_ID,
    questions:
      securityCertificationInformationSecurityGeneralQuestionSamples as QuestionSeedRecord[],
  },
  {
    fallbackContentId: MANAGEMENT_LAW_CONTENT_ID,
    questions: managementLawQuestionSamples as QuestionSeedRecord[],
  },
  {
    fallbackContentId: PRACTICAL_SECURITY_CONTENT_ID,
    questions: practicalSecurityQuestionSamples as QuestionSeedRecord[],
  },
  {
    questions: networkSecurityQuestionSamples as QuestionSeedRecord[],
  },
]);

export function getSecurityCertificationContentMap() {
  const contentById = new Map(
    contentSeedRecords.map((content) => [content.id, content]),
  );
  const extensionByCourseLessonId = new Map(
    courseLessonExtensionSeedRecords.map((extension) => [
      extension.courseLessonId,
      extension,
    ]),
  );

  const rows: SecurityCertificationContentMapRow[] = [];

  for (const tree of SECURITY_CERTIFICATION_CURRICULUM_TREES) {
    const topLevelNodes = flattenOfficialCurriculumTree(tree).filter((node) =>
      ["SUBJECT", "PRACTICAL"].includes(node.nodeType),
    );

    for (const node of topLevelNodes) {
      const curriculumNodeId = curriculumNodeIdFromStableKey(node.stableKey);
      const courseLessons = courseLessonSeedRecords.filter(
        (lesson) =>
          lesson.courseId === tree.courseId &&
          lesson.curriculumNodeId === curriculumNodeId,
      );
      const contentIds = unique(courseLessons.map((lesson) => lesson.contentId));
      const questionSamples = contentIds.flatMap(
        (contentId) => questionSamplesByContentId.get(contentId) ?? [],
      );

      rows.push({
        treeId: tree.treeId,
        courseId: tree.courseId,
        courseCode: tree.courseCode,
        stableKey: node.stableKey,
        curriculumNodeId,
        title: node.title,
        nodeType: node.nodeType,
        officialLevel: node.officialLevel,
        isMapped: courseLessons.length > 0,
        courseLessonIds: courseLessons.map((lesson) => lesson.id),
        contentIds,
        contentTitles: contentIds.map(
          (contentId) => contentById.get(contentId)?.title ?? contentId,
        ),
        extensionCount: courseLessons.filter((lesson) =>
          extensionByCourseLessonId.has(lesson.id),
        ).length,
        questionCount: questionSamples.length,
        questionCourseIds: unique(
          questionSamples.flatMap((question) =>
            question.courseLinks.map((link) => link.courseId),
          ),
        ),
      });
    }
  }

  return rows;
}

export function getSecurityCertificationContentMapSummary() {
  const rows = getSecurityCertificationContentMap();
  const mappedRows = rows.filter((row) => row.isMapped);
  const rowsWithQuestions = rows.filter((row) => row.questionCount > 0);
  const rowsMissingQuestions = mappedRows.filter((row) => row.questionCount === 0);

  return {
    rowCount: rows.length,
    mappedRowCount: mappedRows.length,
    unmappedRowCount: rows.length - mappedRows.length,
    rowsWithQuestionsCount: rowsWithQuestions.length,
    mappedRowsMissingQuestionsCount: rowsMissingQuestions.length,
    byCourse: Object.fromEntries(
      unique(rows.map((row) => row.courseId)).map((courseId) => {
        const courseRows = rows.filter((row) => row.courseId === courseId);
        return [
          courseId,
          {
            rowCount: courseRows.length,
            mappedRowCount: courseRows.filter((row) => row.isMapped).length,
            rowsWithQuestionsCount: courseRows.filter(
              (row) => row.questionCount > 0,
            ).length,
          },
        ];
      }),
    ),
  };
}

export function getSecurityCertificationDeepNodeCoverageSummary() {
  const courseLessonsByNodeId = new Map<string, CourseLessonSeedRecord[]>();
  for (const lesson of courseLessonSeedRecords) {
    courseLessonsByNodeId.set(lesson.curriculumNodeId, [
      ...(courseLessonsByNodeId.get(lesson.curriculumNodeId) ?? []),
      lesson,
    ]);
  }

  const learningNodeTypes: OfficialCurriculumNodeType[] = [
    "SUBJECT",
    "PRACTICAL",
    "MAJOR_ITEM",
    "SUB_ITEM",
  ];
  const directRows = SECURITY_CERTIFICATION_CURRICULUM_TREES.flatMap((tree) =>
    flattenOfficialCurriculumTree(tree)
      .filter((node) => learningNodeTypes.includes(node.nodeType))
      .map((node) => {
        const curriculumNodeId = curriculumNodeIdFromStableKey(node.stableKey);
        const courseLessons = courseLessonsByNodeId.get(curriculumNodeId) ?? [];
        const contentIds = unique(courseLessons.map((lesson) => lesson.contentId));
        const questionSamples = contentIds.flatMap(
          (contentId) => questionSamplesByContentId.get(contentId) ?? [],
        );
        return {
          treeId: tree.treeId,
          courseId: tree.courseId,
          courseCode: tree.courseCode,
          stableKey: node.stableKey,
          curriculumNodeId,
          title: node.title,
          nodeType: node.nodeType,
          officialLevel: node.officialLevel,
          depth: node.depth,
          contentIds,
          courseLessonIds: courseLessons.map((lesson) => lesson.id),
          directQuestionCount: questionSamples.length,
          questionCount: questionSamples.length,
          hasContent: contentIds.length > 0,
          hasQuestions: questionSamples.length > 0,
        };
      }),
  );
  const rows = directRows.map((row) => {
    if (row.nodeType !== "MAJOR_ITEM") {
      return row;
    }

    const descendantQuestionCount = directRows
      .filter(
        (candidate) =>
          candidate.courseId === row.courseId &&
          candidate.stableKey.startsWith(`${row.stableKey}-`) &&
          candidate.directQuestionCount > 0,
      )
      .reduce((sum, candidate) => sum + candidate.directQuestionCount, 0);

    if (descendantQuestionCount === 0) {
      return row;
    }

    return {
      ...row,
      questionCount: row.directQuestionCount + descendantQuestionCount,
      hasQuestions: true,
    };
  });

  const byCourse = Object.fromEntries(
    unique(rows.map((row) => row.courseId)).map((courseId) => {
      const courseRows = rows.filter((row) => row.courseId === courseId);
      return [
        courseId,
        summarizeDeepCoverageRows(courseRows),
      ];
    }),
  );

  return {
    ...summarizeDeepCoverageRows(rows),
    byCourse,
    byNodeType: Object.fromEntries(
      learningNodeTypes.map((nodeType) => {
        const nodeRows = rows.filter((row) => row.nodeType === nodeType);
        return [nodeType, summarizeDeepCoverageRows(nodeRows)];
      }),
    ),
    uncoveredRows: rows.filter((row) => !row.hasContent),
    questionGapRows: rows.filter((row) => row.hasContent && !row.hasQuestions),
  };
}

function curriculumNodeIdFromStableKey(stableKey: string) {
  return `curriculum-node-${stableKey.toLowerCase()}`;
}

export function getQuestionSupportingContentIds(
  question: SecurityCertificationQuestionPlacementSeed,
) {
  return unique(
    (question.contentLinks ?? [])
      .filter((link) => link.contentType === "CONTENT")
      .map((link) => link.contentId),
  );
}

/**
 * Resolves official placement for one course/version context. Missing metadata
 * retains the legacy Content-derived result; malformed explicit metadata throws
 * instead of silently falling back to that ambiguous legacy path.
 */
export function resolveQuestionCurriculumPlacement(
  question: SecurityCertificationQuestionPlacementSeed,
  context: {
    courseId: string;
    curriculumTreeId: string;
  },
): SecurityCertificationQuestionPlacementResolution {
  const tree = SECURITY_CERTIFICATION_CURRICULUM_TREES.find(
    (candidate) => candidate.treeId === context.curriculumTreeId,
  );
  if (!tree || tree.courseId !== context.courseId) {
    throw new Error(
      `Invalid curriculum placement context: ${context.courseId}/${context.curriculumTreeId}`,
    );
  }
  if (!question.courseLinks.some((link) => link.courseId === context.courseId)) {
    throw new Error(
      `Question is not linked to curriculum placement course: ${context.courseId}`,
    );
  }

  const placements = question.primaryCurriculumPlacements ?? [];
  validateQuestionPrimaryCurriculumPlacements(question, placements);
  const matchingPlacements = placements.filter(
    (placement) =>
      placement.courseId === context.courseId &&
      placement.curriculumTreeId === context.curriculumTreeId,
  );
  if (matchingPlacements.length > 1) {
    throw new Error(
      `Ambiguous explicit primary curriculum placement: ${context.courseId}/${context.curriculumTreeId}`,
    );
  }

  const supportingContentIds = getQuestionSupportingContentIds(question);
  const primaryPlacement = matchingPlacements[0] ?? null;
  if (primaryPlacement) {
    return {
      mode: "EXPLICIT_PRIMARY",
      primaryPlacement,
      officialPlacementNodeIds: [primaryPlacement.curriculumNodeId],
      supportingContentIds,
    };
  }

  const knownNodeIds = new Set(
    flattenOfficialCurriculumTree(tree).map((node) =>
      curriculumNodeIdFromStableKey(node.stableKey),
    ),
  );
  const officialPlacementNodeIds = unique(
    courseLessonSeedRecords
      .filter(
        (lesson) =>
          lesson.courseId === context.courseId &&
          supportingContentIds.includes(lesson.contentId) &&
          knownNodeIds.has(lesson.curriculumNodeId),
      )
      .map((lesson) => lesson.curriculumNodeId),
  ).sort();

  return {
    mode: "LEGACY_CONTENT_DERIVED",
    primaryPlacement: null,
    officialPlacementNodeIds,
    supportingContentIds,
  };
}

function validateQuestionPrimaryCurriculumPlacements(
  question: SecurityCertificationQuestionPlacementSeed,
  placements: ReadonlyArray<SecurityCertificationQuestionPrimaryCurriculumPlacement>,
) {
  const placementKeys = new Set<string>();
  for (const placement of placements) {
    const placementKey = `${placement.courseId}:${placement.curriculumTreeId}`;
    if (placementKeys.has(placementKey)) {
      throw new Error(`Ambiguous explicit primary curriculum placement: ${placementKey}`);
    }
    placementKeys.add(placementKey);

    if (!question.courseLinks.some((link) => link.courseId === placement.courseId)) {
      throw new Error(
        `Explicit primary curriculum placement has an unlinked course: ${placement.courseId}`,
      );
    }
    const placementTree = SECURITY_CERTIFICATION_CURRICULUM_TREES.find(
      (candidate) => candidate.treeId === placement.curriculumTreeId,
    );
    if (!placementTree || placementTree.courseId !== placement.courseId) {
      throw new Error(
        `Explicit primary curriculum placement has an invalid course/tree context: ${placementKey}`,
      );
    }
    const nodeExists = flattenOfficialCurriculumTree(placementTree).some(
      (node) =>
        curriculumNodeIdFromStableKey(node.stableKey) === placement.curriculumNodeId,
    );
    if (!nodeExists) {
      throw new Error(
        `Explicit primary curriculum placement target is unresolved: ${placement.curriculumNodeId}`,
      );
    }
  }
}

function buildQuestionSamplesByContentId(
  groups: Array<{
    fallbackContentId?: string;
    questions: QuestionSeedRecord[];
  }>,
) {
  const byContentId = new Map<string, QuestionSeedRecord[]>();

  for (const group of groups) {
    for (const question of group.questions) {
      const contentIds = question.contentLinks?.length
        ? getQuestionSupportingContentIds(question)
        : group.fallbackContentId
          ? [group.fallbackContentId]
          : [];

      for (const contentId of unique(contentIds)) {
        byContentId.set(contentId, [
          ...(byContentId.get(contentId) ?? []),
          question,
        ]);
      }
    }
  }

  return byContentId;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function summarizeDeepCoverageRows(
  rows: Array<{
    hasContent: boolean;
    hasQuestions: boolean;
  }>,
) {
  const contentLinkedCount = rows.filter((row) => row.hasContent).length;
  const questionLinkedCount = rows.filter((row) => row.hasQuestions).length;

  return {
    nodeCount: rows.length,
    contentLinkedCount,
    questionLinkedCount,
    contentCoveragePercent: percent(contentLinkedCount, rows.length),
    questionCoveragePercent: percent(questionLinkedCount, rows.length),
  };
}

function percent(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}
