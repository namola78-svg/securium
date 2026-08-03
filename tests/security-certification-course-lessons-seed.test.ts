import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_VALUE,
  officialSecurityCertificationContents,
  officialSecurityCertificationCourseLessonExtensions,
  officialSecurityCertificationCourseLessons,
  generateSecurityCertificationCourseLessonSeedSql,
  getSecurityCertificationCourseLessonCoveragePlan,
  getSecurityCertificationNetworkSecurityFlowReadiness,
  getSecurityCertificationCourseLessonSeedStats,
} from "../lib/data/security-certification-course-lessons.mjs";

test("security certification course lesson seed reuses shared contents across engineer tracks", () => {
  const stats = getSecurityCertificationCourseLessonSeedStats();

  assert.equal(stats.contentCount, 29);
  assert.equal(stats.courseLessonCount, 57);
  assert.equal(stats.courseLessonExtensionCount, 2);
  assert.equal(stats.linkedContentCount, 29);
  assert.equal(stats.reusedContentCount, 28);
  assert.equal(stats.allLessonsHaveKnownContent, true);
  assert.equal(stats.expectedTopLevelNodeCount, 11);
  assert.equal(stats.mappedTopLevelNodeCount, 11);
  assert.equal(stats.unmappedTopLevelNodeCount, 0);
});

test("security certification course lesson seed keeps course progress separated", () => {
  const engineerLessons = officialSecurityCertificationCourseLessons.filter(
    (lesson) => lesson.courseId === "course-ise",
  );
  const industrialLessons = officialSecurityCertificationCourseLessons.filter(
    (lesson) => lesson.courseId === "course-isie",
  );

  assert.equal(engineerLessons.length, 29);
  assert.equal(industrialLessons.length, 28);

  const courseLessonIds = new Set(
    officialSecurityCertificationCourseLessons.map((lesson) => lesson.id),
  );
  assert.equal(courseLessonIds.size, officialSecurityCertificationCourseLessons.length);

  const reusedSystemContentLessons =
    officialSecurityCertificationCourseLessons.filter(
      (lesson) =>
        lesson.contentId ===
        "content-official-security-cert-system-security-overview",
    );
  assert.deepEqual(
    reusedSystemContentLessons.map((lesson) => lesson.courseId).sort(),
    ["course-ise", "course-isie"],
  );
});

test("security certification course lessons link to official curriculum nodes", () => {
  for (const lesson of officialSecurityCertificationCourseLessons) {
    assert.match(lesson.curriculumNodeId, /^curriculum-node-isi?e-2027-2029-/);
    assert.equal(lesson.sortOrder >= 1, true);
    assert.equal(lesson.isRequired, true);
  }

  assert.ok(
    officialSecurityCertificationCourseLessons.some(
      (lesson) =>
        lesson.courseId === "course-ise" &&
        lesson.curriculumNodeId === "curriculum-node-ise-2027-2029-01-05",
    ),
    "information security engineer should include management and law",
  );
  assert.equal(
    officialSecurityCertificationCourseLessons.some(
      (lesson) =>
        lesson.courseId === "course-isie" &&
        lesson.curriculumNodeId === "curriculum-node-isie-2027-2029-01-05",
    ),
    false,
    "industrial engineer should not receive the engineer-only management and law subject",
  );
});

test("security certification course lesson coverage plan maps every subject and practical top-level node", () => {
  const coveragePlan = getSecurityCertificationCourseLessonCoveragePlan();

  assert.deepEqual(
    coveragePlan.map((tree) => ({
      treeId: tree.treeId,
      expectedNodeCount: tree.expectedNodeCount,
      mappedNodeCount: tree.mappedNodeCount,
      unmappedNodeCount: tree.unmappedNodeCount,
    })),
    [
      {
        treeId: "curriculum-ise-2027-2029-official",
        expectedNodeCount: 6,
        mappedNodeCount: 6,
        unmappedNodeCount: 0,
      },
      {
        treeId: "curriculum-isie-2027-2029-official",
        expectedNodeCount: 5,
        mappedNodeCount: 5,
        unmappedNodeCount: 0,
      },
    ],
  );

  for (const tree of coveragePlan) {
    assert.equal(tree.unmappedNodes.length, 0);
    assert.equal(
      tree.mappedNodes.every((node) => node.courseLessonIds.length === 1),
      true,
    );
    assert.equal(tree.mappedNodes.every((node) => node.contentIds.length === 1), true);
  }
});

test("security certification course lesson coverage keeps shared and engineer-only content boundaries", () => {
  const coveragePlan = getSecurityCertificationCourseLessonCoveragePlan();
  const mappedNodes = coveragePlan.flatMap((tree) =>
    tree.mappedNodes.map((node) => ({
      ...node,
      courseId: tree.courseId,
      treeId: tree.treeId,
    })),
  );

  const nodesByContentId = new Map<string, typeof mappedNodes>();
  for (const node of mappedNodes) {
    for (const contentId of node.contentIds) {
      nodesByContentId.set(contentId, [
        ...(nodesByContentId.get(contentId) ?? []),
        node,
      ]);
    }
  }

  for (const sharedContentId of [
    "content-official-security-cert-system-security-overview",
    "content-official-security-cert-network-security-overview",
    "content-official-security-cert-application-security-overview",
    "content-official-security-cert-information-security-general-overview",
    "content-official-security-cert-practical-overview",
  ]) {
    const linkedNodes = nodesByContentId.get(sharedContentId) ?? [];
    assert.deepEqual(
      linkedNodes.map((node) => node.courseId).sort(),
      ["course-ise", "course-isie"],
      `${sharedContentId} should be reused by both security certification tracks`,
    );
    assert.equal(
      new Set(linkedNodes.map((node) => node.nodeId)).size,
      linkedNodes.length,
      `${sharedContentId} should remain attached through course-specific curriculum nodes`,
    );
  }

  assert.deepEqual(
    (nodesByContentId.get(
      "content-official-security-cert-management-law-overview",
    ) ?? []).map((node) => ({
      courseId: node.courseId,
      title: node.title,
      officialLevel: node.officialLevel,
    })),
    [
      {
        courseId: "course-ise",
        title: "정보보안관리 및 법규",
        officialLevel: "SUBJECT",
      },
    ],
    "management and law must stay engineer-only because it is not an industrial engineer subject",
  );

  assert.equal(
    mappedNodes.every((node) => node.courseLessonIds.length === 1),
    true,
  );
});

test("security certification course lesson seed generates additive SQL", () => {
  const d1Sql = generateSecurityCertificationCourseLessonSeedSql({ dialect: "d1" });
  const postgresSql = generateSecurityCertificationCourseLessonSeedSql({
    dialect: "postgres",
  });

  assert.match(d1Sql, /INSERT OR IGNORE INTO "contents"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "course_lessons"/);
  assert.match(d1Sql, /INSERT OR IGNORE INTO "course_lesson_extensions"/);
  assert.match(postgresSql, /INSERT INTO "contents"/);
  assert.match(postgresSql, /INSERT INTO "course_lesson_extensions"/);
  assert.match(postgresSql, /ON CONFLICT \("id"\) DO UPDATE SET/);
  assert.match(postgresSql, /\bBEGIN;/);
  assert.match(postgresSql, /\bCOMMIT;/);

  for (const forbidden of [/\bDROP\b/i, /\bDELETE\b/i, /\bTRUNCATE\b/i]) {
    assert.doesNotMatch(postgresSql, forbidden);
  }
});

test("security certification course lesson content is marked as learning overview, not copied questions", () => {
  for (const content of officialSecurityCertificationContents) {
    assert.match(content.body, /공식 문제나 유료 교재 내용을 복제하지 않습니다/);
  }
});

test("network security shared content is expanded into a formal lesson body", () => {
  const networkContent = officialSecurityCertificationContents.find(
    (content) =>
      content.id === "content-official-security-cert-network-security-overview",
  );
  assert.ok(networkContent);

  assert.match(networkContent.body, /# 네트워크보안 정식 학습 본문/);
  assert.match(networkContent.body, /## 1\. 학습 범위/);
  assert.match(networkContent.body, /## 3\. 주요 공격 유형/);
  assert.match(networkContent.body, /## 4\. 보안 프로토콜과 보안장비/);
  assert.match(networkContent.body, /## 7\. 연습 체크리스트/);
  assert.match(networkContent.body, /DoS\/DDoS/);
  assert.match(networkContent.body, /스푸핑은 속임, 스니핑은 관찰/);
  assert.equal(networkContent.learningObjectives.length >= 4, true);
  assert.equal(networkContent.coreConcepts.includes("SIEM"), true);
  assert.equal(networkContent.practicalExamples.length >= 4, true);
});

test("network security major items are split into shared CourseLessons", () => {
  const majorItemContentIds = [
    "content-official-security-cert-network-general",
    "content-official-security-cert-network-attack-techniques",
    "content-official-security-cert-network-security-technology",
  ];
  const majorItemContents = officialSecurityCertificationContents.filter((content) =>
    majorItemContentIds.includes(content.id),
  );

  assert.equal(majorItemContents.length, 3);
  for (const content of majorItemContents) {
    assert.match(content.body, /SECURIUM 자체 작성 자료/);
    assert.equal(content.learningObjectives.length >= 3, true);
    assert.equal(content.coreConcepts.length >= 8, true);
  }

  for (const contentId of majorItemContentIds) {
    const linkedLessons = officialSecurityCertificationCourseLessons
      .filter((lesson) => lesson.contentId === contentId)
      .sort((a, b) => a.courseId.localeCompare(b.courseId));

    assert.deepEqual(
      linkedLessons.map((lesson) => lesson.courseId),
      ["course-ise", "course-isie"],
      `${contentId} should be shared by both security certification tracks`,
    );
    assert.equal(
      new Set(linkedLessons.map((lesson) => lesson.curriculumNodeId)).size,
      2,
      `${contentId} should keep course-specific curriculum node progress`,
    );
  }
});

test("system security major items are split into shared CourseLessons", () => {
  const majorItemContentIds = [
    "content-official-security-cert-system-scope-understanding",
    "content-official-security-cert-system-threats-attacks",
    "content-official-security-cert-system-prevention-response",
  ];
  const majorItemContents = officialSecurityCertificationContents.filter((content) =>
    majorItemContentIds.includes(content.id),
  );

  assert.equal(majorItemContents.length, 3);
  for (const content of majorItemContents) {
    assert.match(content.body, /공식 출제기준의 주요항목/);
    assert.match(content.body, /SECURIUM 자체 작성 자료/);
    assert.equal(content.learningObjectives.length, 3);
    assert.equal(content.coreConcepts.length >= 8, true);
    assert.equal(content.practicalExamples.length, 3);
  }

  for (const contentId of majorItemContentIds) {
    const linkedLessons = officialSecurityCertificationCourseLessons
      .filter((lesson) => lesson.contentId === contentId)
      .sort((a, b) => a.courseId.localeCompare(b.courseId));

    assert.deepEqual(
      linkedLessons.map((lesson) => lesson.courseId),
      ["course-ise", "course-isie"],
      `${contentId} should be shared by both security certification tracks`,
    );
    assert.equal(
      new Set(linkedLessons.map((lesson) => lesson.curriculumNodeId)).size,
      2,
      `${contentId} should keep course-specific curriculum node progress`,
    );
    assert.equal(
      linkedLessons.every((lesson) => lesson.sortOrder >= 2),
      true,
      `${contentId} should be ordered after the system security subject overview`,
    );
  }
});

test("system security sub items are split into shared CourseLessons", () => {
  const subItemContentIds = [
    "content-official-security-cert-system-endpoint-server-systems",
    "content-official-security-cert-system-operating-systems",
    "content-official-security-cert-system-system-information",
    "content-official-security-cert-system-system-security-threats",
    "content-official-security-cert-system-system-attack-techniques",
    "content-official-security-cert-system-system-security-response-techniques",
    "content-official-security-cert-system-system-analysis-tools",
    "content-official-security-cert-system-system-security-solutions",
  ];
  const subItemContents = officialSecurityCertificationContents.filter((content) =>
    subItemContentIds.includes(content.id),
  );

  assert.equal(subItemContents.length, 8);
  for (const content of subItemContents) {
    assert.match(content.body, /공식 출제기준의 세부항목/);
    assert.equal(content.learningObjectives.length, 3);
    assert.equal(content.practicalExamples.length, 3);
  }

  for (const contentId of subItemContentIds) {
    const linkedLessons = officialSecurityCertificationCourseLessons
      .filter((lesson) => lesson.contentId === contentId)
      .sort((a, b) => a.courseId.localeCompare(b.courseId));

    assert.deepEqual(
      linkedLessons.map((lesson) => lesson.courseId),
      ["course-ise", "course-isie"],
      `${contentId} should be shared by both security certification tracks`,
    );
    assert.equal(
      new Set(linkedLessons.map((lesson) => lesson.curriculumNodeId)).size,
      2,
      `${contentId} should preserve course-specific progress nodes`,
    );
  }
});

test("network security sub items are split into shared CourseLessons", () => {
  const subItemContentIds = [
    "content-official-security-cert-network-network-concepts",
    "content-official-security-cert-network-network-usage",
    "content-official-security-cert-network-dos-ddos",
    "content-official-security-cert-network-scanning",
    "content-official-security-cert-network-spoofing",
    "content-official-security-cert-network-sniffing",
    "content-official-security-cert-network-remote-access-attacks",
    "content-official-security-cert-network-security-protocols",
    "content-official-security-cert-network-network-security-solutions",
  ];
  const subItemContents = officialSecurityCertificationContents.filter((content) =>
    subItemContentIds.includes(content.id),
  );

  assert.equal(subItemContents.length, 9);
  for (const content of subItemContents) {
    assert.match(content.body, /공식 출제기준의 세부항목/);
    assert.equal(content.learningObjectives.length, 3);
    assert.equal(content.practicalExamples.length, 3);
  }

  for (const contentId of subItemContentIds) {
    const linkedLessons = officialSecurityCertificationCourseLessons
      .filter((lesson) => lesson.contentId === contentId)
      .sort((a, b) => a.courseId.localeCompare(b.courseId));

    assert.deepEqual(
      linkedLessons.map((lesson) => lesson.courseId),
      ["course-ise", "course-isie"],
    );
    assert.equal(
      new Set(linkedLessons.map((lesson) => lesson.curriculumNodeId)).size,
      2,
      `${contentId} should preserve course-specific progress nodes`,
    );
  }
});

test("system security shared content is expanded into a formal lesson body", () => {
  const systemContent = officialSecurityCertificationContents.find(
    (content) =>
      content.id === "content-official-security-cert-system-security-overview",
  );
  assert.ok(systemContent);

  assert.equal(systemContent.title, "시스템보안 정식 학습 개요");
  assert.match(systemContent.body, /# 시스템보안 정식 학습 본문/);
  assert.match(systemContent.body, /## 1\. 학습 범위/);
  assert.match(systemContent.body, /## 2\. 운영체제와 서버 보안/);
  assert.match(systemContent.body, /## 3\. 시스템 보안위협과 공격기법/);
  assert.match(systemContent.body, /## 4\. 클라우드와 가상화 보안/);
  assert.match(systemContent.body, /## 7\. 연습 체크리스트/);
  assert.match(systemContent.body, /계정 탈취/);
  assert.match(systemContent.body, /권한 상승/);
  assert.match(systemContent.body, /악성코드/);
  assert.match(systemContent.body, /클라우드 공유책임/);
  assert.equal(systemContent.learningObjectives.length >= 4, true);
  assert.equal(systemContent.coreConcepts.includes("로그분석"), true);
  assert.equal(systemContent.coreConcepts.includes("클라우드 보안"), true);
  assert.equal(systemContent.practicalExamples.length >= 4, true);
});

test("network security flow is ready for course-specific progress and practice routing", () => {
  const readiness = getSecurityCertificationNetworkSecurityFlowReadiness();

  assert.equal(readiness.contentExists, true);
  assert.equal(
    readiness.canonicalKey,
    "official.security-certification.network-security.overview",
  );
  assert.equal(readiness.linkedCourseLessonCount, 2);
  assert.equal(readiness.courseSpecificExtensionCount, 2);
  assert.equal(readiness.sharedContentReused, true);
  assert.equal(readiness.progressIsolatedByCourseLesson, true);
  assert.equal(readiness.practiceRoutePattern, "/practice/[courseSlug]");
  assert.equal(readiness.allPracticeSearchTokensPresent, true);

  assert.deepEqual(
    readiness.linkedCourseLessons.map((lesson) => ({
      id: lesson.id,
      courseId: lesson.courseId,
      curriculumNodeId: lesson.curriculumNodeId,
      extensionId: lesson.extensionId,
      examPoints: lesson.examPoints,
    })),
    [
      {
        id: "course-lesson-ise-official-network-security-overview",
        courseId: "course-ise",
        curriculumNodeId: "curriculum-node-ise-2027-2029-01-02",
        extensionId:
          "course-lesson-extension-ise-official-network-security-overview",
        examPoints: 3,
      },
      {
        id: "course-lesson-isie-official-network-security-overview",
        courseId: "course-isie",
        curriculumNodeId: "curriculum-node-isie-2027-2029-01-02",
        extensionId:
          "course-lesson-extension-isie-official-network-security-overview",
        examPoints: 3,
      },
    ],
  );

  assert.deepEqual(
    readiness.tokenCoverage.filter((item) => !item.present),
    [],
    "network security lesson should expose search tokens for practice recommendation",
  );
});

test("network security course lesson extensions differentiate engineer and industrial tracks", () => {
  assert.equal(officialSecurityCertificationCourseLessonExtensions.length, 2);

  const engineerExtension = officialSecurityCertificationCourseLessonExtensions.find(
    (extension) =>
      extension.courseLessonId ===
      "course-lesson-ise-official-network-security-overview",
  );
  const industrialExtension =
    officialSecurityCertificationCourseLessonExtensions.find(
      (extension) =>
        extension.courseLessonId ===
        "course-lesson-isie-official-network-security-overview",
    );

  assert.ok(engineerExtension);
  assert.ok(industrialExtension);
  assert.notEqual(engineerExtension.id, industrialExtension.id);
  assert.notEqual(engineerExtension.additionalBody, industrialExtension.additionalBody);
  assert.notDeepEqual(engineerExtension.examPoints, industrialExtension.examPoints);
  assert.equal(engineerExtension.status, "PUBLISHED");
  assert.equal(industrialExtension.status, "PUBLISHED");

  assert.match(engineerExtension.additionalBody, /실기형 분석/);
  assert.match(engineerExtension.practicalNotes, /로그 이벤트/);
  assert.match(industrialExtension.additionalBody, /기본 개념/);
  assert.match(industrialExtension.practicalNotes, /기본 대응 방법/);

  const contentIds = new Set(
    officialSecurityCertificationCourseLessons
      .filter((lesson) =>
        [
          engineerExtension.courseLessonId,
          industrialExtension.courseLessonId,
        ].includes(lesson.id),
      )
      .map((lesson) => lesson.contentId),
  );
  assert.deepEqual([...contentIds], [
    "content-official-security-cert-network-security-overview",
  ]);
});

test("security certification course lesson apply script gates Postgres data changes", () => {
  const script = readFileSync(
    "scripts/apply-security-certification-course-lessons-seed.mjs",
    "utf8",
  );

  assert.match(script, /--confirm-production-seed/);
  assert.match(
    script,
    /SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_NAME/,
  );
  assert.equal(
    SECURITY_CERTIFICATION_COURSE_LESSON_CONFIRM_ENV_VALUE,
    "APPLY_SECURITY_CERTIFICATION_COURSE_LESSON_SEED",
  );
  assert.match(script, /target === "d1-local"/);
  assert.match(script, /assertProductionSeedApproval\(\)/);
});

test("application security shared content is expanded into a formal lesson body", () => {
  const applicationContent = officialSecurityCertificationContents.find(
    (content) =>
      content.id === "content-official-security-cert-application-security-overview",
  );
  assert.ok(applicationContent);

  assert.equal(applicationContent.title, "애플리케이션보안 정식 학습 개요");
  assert.match(applicationContent.summary, /웹, DB, DNS, 메일/);
  assert.match(applicationContent.body, /## 2\. 서비스별 보안 점검/);
  assert.match(applicationContent.body, /## 3\. Web\/App 취약점/);
  assert.match(applicationContent.body, /## 4\. DB 보안/);
  assert.match(applicationContent.body, /SQL 삽입/);
  assert.match(applicationContent.body, /XSS/);
  assert.match(applicationContent.body, /SECURIUM 자체 작성 자료/);
  assert.equal(
    [
      "Web/App 보안",
      "DB 보안",
      "DNS 보안",
      "SQL 삽입",
      "XSS",
      "보안약점 진단",
    ].every((concept) => applicationContent.coreConcepts.includes(concept)),
    true,
  );
  assert.equal(applicationContent.practicalExamples.length >= 4, true);
});

test("information security general shared content is expanded into a formal lesson body", () => {
  const generalContent = officialSecurityCertificationContents.find(
    (content) =>
      content.id ===
      "content-official-security-cert-information-security-general-overview",
  );
  assert.ok(generalContent);

  assert.equal(generalContent.title, "정보보안일반 정식 학습 개요");
  assert.match(generalContent.summary, /인증, 접근통제, 키 분배/);
  assert.match(generalContent.body, /## 2\. 인증과 접근통제/);
  assert.match(generalContent.body, /## 3\. 키 분배와 전자서명/);
  assert.match(generalContent.body, /## 4\. 암호 알고리즘과 해시함수/);
  assert.match(generalContent.body, /양자내성암호/);
  assert.match(generalContent.body, /제로트러스트/);
  assert.match(generalContent.body, /SECURIUM 자체 작성 자료/);
  assert.equal(
    [
      "인증",
      "접근통제",
      "RBAC",
      "공개키",
      "전자서명",
      "해시함수",
      "제로트러스트",
    ].every((concept) => generalContent.coreConcepts.includes(concept)),
    true,
  );
  assert.equal(generalContent.practicalExamples.length >= 4, true);
});

test("management law content is expanded as an engineer-only formal lesson body", () => {
  const managementContent = officialSecurityCertificationContents.find(
    (content) =>
      content.id === "content-official-security-cert-management-law-overview",
  );
  assert.ok(managementContent);

  assert.equal(managementContent.title, "정보보호관리 및 법규 정식 학습 개요");
  assert.match(managementContent.summary, /정보보안기사 전용 범위/);
  assert.match(managementContent.body, /## 2\. 정보보호 관리체계/);
  assert.match(managementContent.body, /## 3\. 위험관리와 보호대책/);
  assert.match(managementContent.body, /## 4\. 사고대응과 증거보존/);
  assert.match(managementContent.body, /## 5\. 인증제도와 관련 법규/);
  assert.match(managementContent.body, /SECURIUM 자체 작성 자료/);
  assert.equal(
    [
      "정보보호관리",
      "위험관리",
      "보호대책",
      "사고대응",
      "ISMS-P",
      "개인정보 보호",
    ].every((concept) => managementContent.coreConcepts.includes(concept)),
    true,
  );

  const linkedLessons = officialSecurityCertificationCourseLessons.filter(
    (lesson) =>
      lesson.contentId === "content-official-security-cert-management-law-overview",
  );
  assert.deepEqual(
    linkedLessons.map((lesson) => lesson.courseId),
    ["course-ise"],
    "management and law must stay engineer-only and never leak into industrial engineer progress",
  );
});
