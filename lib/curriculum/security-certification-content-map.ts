import {
  SECURITY_CERTIFICATION_CURRICULUM_TREES,
  flattenOfficialCurriculumTree,
  type OfficialCurriculumNodeType,
} from "./security-certification-standards.ts";
import {
  officialSecurityCertificationContents,
  officialSecurityCertificationCourseLessons,
  officialSecurityCertificationCourseLessonExtensions,
} from "../data/security-certification-course-lessons.mjs";
import {
  networkSecurityQuestionSamples,
  NETWORK_SECURITY_CONTENT_ID,
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

type QuestionSeedRecord = {
  courseLinks: Array<{
    courseId: string;
  }>;
};

const contentSeedRecords =
  officialSecurityCertificationContents as ContentSeedRecord[];
const courseLessonSeedRecords =
  officialSecurityCertificationCourseLessons as CourseLessonSeedRecord[];
const courseLessonExtensionSeedRecords =
  officialSecurityCertificationCourseLessonExtensions as CourseLessonExtensionSeedRecord[];

const questionSamplesByContentId = new Map<string, QuestionSeedRecord[]>([
  [NETWORK_SECURITY_CONTENT_ID, networkSecurityQuestionSamples as QuestionSeedRecord[]],
  [SYSTEM_SECURITY_CONTENT_ID, systemSecurityQuestionSamples as QuestionSeedRecord[]],
  [
    APPLICATION_SECURITY_CONTENT_ID,
    applicationSecurityQuestionSamples as QuestionSeedRecord[],
  ],
  [
    INFORMATION_SECURITY_GENERAL_CONTENT_ID,
    securityCertificationInformationSecurityGeneralQuestionSamples as QuestionSeedRecord[],
  ],
  [MANAGEMENT_LAW_CONTENT_ID, managementLawQuestionSamples as QuestionSeedRecord[]],
  [PRACTICAL_SECURITY_CONTENT_ID, practicalSecurityQuestionSamples as QuestionSeedRecord[]],
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

function curriculumNodeIdFromStableKey(stableKey: string) {
  return `curriculum-node-${stableKey.toLowerCase()}`;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
