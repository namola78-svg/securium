import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  getQuestionSupportingContentIds,
  getSecurityCertificationContentMap,
  getSecurityCertificationDeepNodeCoverageSummary,
  getSecurityCertificationContentMapSummary,
  resolveQuestionCurriculumPlacement,
  type SecurityCertificationQuestionPlacementSeed,
} from "../lib/curriculum/security-certification-content-map.ts";
import {
  officialSecurityCertificationContents,
  officialSecurityCertificationCourseLessons,
} from "../lib/data/security-certification-course-lessons.mjs";
import { practicalSecurityQuestionSamples } from "../lib/data/security-certification-practical-questions.mjs";
import { applicationSecurityQuestionSamples } from "../lib/data/security-certification-application-security-questions.mjs";
import { networkSecurityQuestionSamples } from "../lib/data/security-certification-network-security-questions.mjs";
import { systemSecurityQuestionSamples } from "../lib/data/security-certification-system-security-questions.mjs";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function educationalPayloadHash(question: Record<string, unknown>) {
  const educationalPayload = Object.fromEntries(
    Object.entries(question).filter(
      ([key]) =>
        ![
          "contentLinks",
          "courseLinks",
          "primaryCurriculumPlacements",
        ].includes(key),
    ),
  );
  return createHash("sha256")
    .update(canonicalJson(educationalPayload), "utf8")
    .digest("hex");
}

test("security certification content map covers every top-level official curriculum node", () => {
  const summary = getSecurityCertificationContentMapSummary();

  assert.equal(summary.rowCount, 11);
  assert.equal(summary.mappedRowCount, 11);
  assert.equal(summary.unmappedRowCount, 0);
  assert.equal(summary.rowsWithQuestionsCount, 11);
  assert.equal(summary.mappedRowsMissingQuestionsCount, 0);
  assert.deepEqual(summary.byCourse, {
    "course-ise": {
      rowCount: 6,
      mappedRowCount: 6,
      rowsWithQuestionsCount: 6,
    },
    "course-isie": {
      rowCount: 5,
      mappedRowCount: 5,
      rowsWithQuestionsCount: 5,
    },
  });
});

test("security certification content map preserves shared content and isolated progress boundaries", () => {
  const rows = getSecurityCertificationContentMap();
  const rowByStableKey = new Map(rows.map((row) => [row.stableKey, row]));

  const sharedPairs = [
    ["ISE-2027-2029-01-01", "ISIE-2027-2029-01-01"],
    ["ISE-2027-2029-01-02", "ISIE-2027-2029-01-02"],
    ["ISE-2027-2029-01-03", "ISIE-2027-2029-01-03"],
    ["ISE-2027-2029-01-04", "ISIE-2027-2029-01-04"],
  ];

  for (const [engineerKey, industrialKey] of sharedPairs) {
    const engineer = rowByStableKey.get(engineerKey);
    const industrial = rowByStableKey.get(industrialKey);
    assert.ok(engineer);
    assert.ok(industrial);
    assert.deepEqual(engineer.contentIds, industrial.contentIds);
    assert.notDeepEqual(engineer.courseLessonIds, industrial.courseLessonIds);
    const expectedQuestionCourseIds = ["course-ise", "course-isie"];
    assert.deepEqual(engineer.questionCourseIds, expectedQuestionCourseIds);
    assert.deepEqual(industrial.questionCourseIds, expectedQuestionCourseIds);
  }

  const managementLaw = rowByStableKey.get("ISE-2027-2029-01-05");
  assert.ok(managementLaw);
  assert.deepEqual(managementLaw.contentIds, [
    "content-official-security-cert-management-law-overview",
  ]);
  assert.deepEqual(managementLaw.questionCourseIds, ["course-ise"]);
  assert.equal(
    rows.some((row) => row.stableKey === "ISIE-2027-2029-01-05"),
    false,
    "management law must not appear as an industrial engineer top-level node",
  );
});

test("security certification content map marks practical nodes as shared content and question-ready", () => {
  const practicalRows = getSecurityCertificationContentMap().filter(
    (row) => row.nodeType === "PRACTICAL",
  );

  assert.equal(practicalRows.length, 2);
  for (const row of practicalRows) {
    assert.equal(row.isMapped, true);
    assert.deepEqual(row.contentIds, [
      "content-official-security-cert-practical-overview",
    ]);
    assert.equal(row.questionCount, 6);
    assert.deepEqual(row.questionCourseIds, ["course-ise", "course-isie"]);
  }
});

test("security certification deep node inventory exposes the two intentionally unmapped PR1 additions", () => {
  const summary = getSecurityCertificationDeepNodeCoverageSummary();

  assert.equal(summary.nodeCount, 141);
  assert.equal(summary.contentLinkedCount, 139);
  assert.equal(summary.questionLinkedCount, 139);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(summary.byCourse).map(([courseId, course]) => [
        courseId,
        {
          nodeCount: course.nodeCount,
          contentLinkedCount: course.contentLinkedCount,
          questionLinkedCount: course.questionLinkedCount,
        },
      ]),
    ),
    {
      "course-ise": {
        nodeCount: 79,
        contentLinkedCount: 77,
        questionLinkedCount: 77,
      },
      "course-isie": {
        nodeCount: 62,
        contentLinkedCount: 62,
        questionLinkedCount: 62,
      },
    },
  );
  assert.equal(summary.byNodeType.SUBJECT.nodeCount, 9);
  assert.equal(summary.byNodeType.SUBJECT.questionLinkedCount, 9);
  assert.equal(summary.byNodeType.PRACTICAL.nodeCount, 2);
  assert.equal(summary.byNodeType.MAJOR_ITEM.nodeCount, 34);
  assert.equal(summary.byNodeType.SUB_ITEM.nodeCount, 96);
  assert.equal(summary.byNodeType.MAJOR_ITEM.contentLinkedCount, 33);
  assert.equal(summary.byNodeType.MAJOR_ITEM.questionLinkedCount, 33);
  assert.equal(summary.byNodeType.SUB_ITEM.contentLinkedCount, 95);
  assert.equal(summary.byNodeType.SUB_ITEM.questionLinkedCount, 95);
  assert.deepEqual(
    summary.uncoveredRows.map((row) => row.stableKey),
    ["ISE-2027-2029-01-03-EC", "ISE-2027-2029-01-03-EC-01"],
  );
  assert.equal(summary.questionGapRows.length, 0);
});

test("network course isolation preserves target Content and CourseLesson identities", () => {
  const content = officialSecurityCertificationContents.find(
    (item) => item.id === "content-official-security-cert-network-network-security-solutions",
  );
  const courseLessons = officialSecurityCertificationCourseLessons.filter((lesson) =>
    [
      "course-lesson-ise-official-network-network-security-solutions",
      "course-lesson-isie-official-network-network-security-solutions",
    ].includes(lesson.id),
  );

  assert.ok(content);
  assert.equal(
    createHash("sha256").update(JSON.stringify(content)).digest("hex"),
    "eba6699d401ae55d9949d5f19d59d8e3deafa041e49ca7c03f1c080063818dd1",
  );
  assert.deepEqual(
    courseLessons.map((lesson) => lesson.id),
    [
      "course-lesson-ise-official-network-network-security-solutions",
      "course-lesson-isie-official-network-network-security-solutions",
    ],
  );
  assert.equal(
    createHash("sha256").update(JSON.stringify(courseLessons)).digest("hex"),
    "4dc72e1c6de1480c1fcfacb72f68da9c5497dcce1130783544f3acd160e4ebfa",
  );
});

test("Engineer log-monitoring content map activation preserves Industrial legacy isolation", () => {
  const targetContentId =
    "content-official-security-cert-ise-practical-log-collection-monitoring";
  const legacyContentId =
    "content-official-security-cert-practical-security-objective-detection-response";
  const questionId = "practical-security-official-engineer-log-monitoring-q01";
  const engineerLessons = officialSecurityCertificationCourseLessons.filter(
    (lesson) =>
      lesson.curriculumNodeId === "curriculum-node-ise-2027-2029-02-01-03-01",
  );
  const industrialLessons = officialSecurityCertificationCourseLessons.filter(
    (lesson) =>
      lesson.curriculumNodeId === "curriculum-node-isie-2027-2029-02-01-03-01",
  );
  const questions = practicalSecurityQuestionSamples.filter(
    (question) => question.id === questionId,
  );

  assert.equal(
    officialSecurityCertificationContents.filter(
      (content) => content.id === targetContentId,
    ).length,
    1,
  );
  assert.deepEqual(engineerLessons.map((lesson) => lesson.contentId), [targetContentId]);
  assert.deepEqual(industrialLessons.map((lesson) => lesson.contentId), [legacyContentId]);
  assert.equal(questions.length, 1);
  assert.deepEqual(
    questions[0]?.contentLinks.map((link: { contentId: string }) => link.contentId),
    [targetContentId],
  );
  assert.deepEqual(
    questions[0]?.courseLinks.map((link: { courseId: string }) => link.courseId),
    ["course-ise"],
  );
  assert.equal(
    industrialLessons.some((lesson) => lesson.contentId === targetContentId),
    false,
  );
});

test("explicit primary placement is deterministic per course and curriculum version", () => {
  const question: SecurityCertificationQuestionPlacementSeed = {
    courseLinks: [{ courseId: "course-ise" }, { courseId: "course-isie" }],
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: "content-official-security-cert-application-security-overview",
      },
      {
        contentType: "CONTENT",
        contentId: "content-official-security-cert-application-web-app-security",
      },
      {
        contentType: "CONTENT",
        contentId:
          "content-official-security-cert-application-application-weakness-response",
      },
    ],
    primaryCurriculumPlacements: [
      {
        courseId: "course-ise",
        curriculumTreeId: "curriculum-ise-2027-2029-official",
        curriculumNodeId: "curriculum-node-ise-2027-2029-01-03-02-01",
      },
      {
        courseId: "course-isie",
        curriculumTreeId: "curriculum-isie-2027-2029-official",
        curriculumNodeId: "curriculum-node-isie-2027-2029-01-03-02-01",
      },
    ],
  };

  const engineer = resolveQuestionCurriculumPlacement(question, {
    courseId: "course-ise",
    curriculumTreeId: "curriculum-ise-2027-2029-official",
  });
  const industrial = resolveQuestionCurriculumPlacement(question, {
    courseId: "course-isie",
    curriculumTreeId: "curriculum-isie-2027-2029-official",
  });
  const reordered = resolveQuestionCurriculumPlacement(
    { ...question, contentLinks: [...(question.contentLinks ?? [])].reverse() },
    {
      courseId: "course-isie",
      curriculumTreeId: "curriculum-isie-2027-2029-official",
    },
  );

  assert.equal(engineer.mode, "EXPLICIT_PRIMARY");
  assert.deepEqual(engineer.officialPlacementNodeIds, [
    "curriculum-node-ise-2027-2029-01-03-02-01",
  ]);
  assert.deepEqual(industrial.officialPlacementNodeIds, [
    "curriculum-node-isie-2027-2029-01-03-02-01",
  ]);
  assert.deepEqual(
    reordered.officialPlacementNodeIds,
    industrial.officialPlacementNodeIds,
  );
  assert.deepEqual(
    [...industrial.supportingContentIds].sort(),
    [...getQuestionSupportingContentIds(question)].sort(),
  );
  assert.equal(industrial.supportingContentIds.length, 3);
});

test("invalid explicit primary placement fails closed without legacy fallback", () => {
  const baseQuestion: SecurityCertificationQuestionPlacementSeed = {
    courseLinks: [{ courseId: "course-isie" }],
    contentLinks: [
      {
        contentType: "CONTENT",
        contentId: "content-official-security-cert-application-security-overview",
      },
    ],
  };
  const context = {
    courseId: "course-isie",
    curriculumTreeId: "curriculum-isie-2027-2029-official",
  };
  const validPlacement = {
    ...context,
    curriculumNodeId: "curriculum-node-isie-2027-2029-01-03-02-01",
  };

  assert.throws(
    () =>
      resolveQuestionCurriculumPlacement(
        {
          ...baseQuestion,
          primaryCurriculumPlacements: [
            {
              ...validPlacement,
              curriculumNodeId: "curriculum-node-isie-does-not-exist",
            },
          ],
        },
        context,
      ),
    /target is unresolved/,
  );
  assert.throws(
    () =>
      resolveQuestionCurriculumPlacement(
        {
          ...baseQuestion,
          primaryCurriculumPlacements: [validPlacement, validPlacement],
        },
        context,
      ),
    /Ambiguous explicit primary curriculum placement/,
  );
  assert.throws(
    () =>
      resolveQuestionCurriculumPlacement(
        {
          ...baseQuestion,
          primaryCurriculumPlacements: [
            {
              ...validPlacement,
              courseId: "course-ise",
              curriculumTreeId: "curriculum-ise-2027-2029-official",
              curriculumNodeId: "curriculum-node-ise-2027-2029-01-03-02-01",
            },
          ],
        },
        context,
      ),
    /unlinked course/,
  );
  assert.throws(
    () =>
      resolveQuestionCurriculumPlacement(
        {
          ...baseQuestion,
          primaryCurriculumPlacements: [
            {
              ...validPlacement,
              curriculumTreeId: "curriculum-ise-2027-2029-official",
            },
          ],
        },
        context,
      ),
    /invalid course\/tree context/,
  );
});

test("all 27 existing application, system and network multi-content questions preserve legacy placement", () => {
  const questions = [
    ...applicationSecurityQuestionSamples,
    ...systemSecurityQuestionSamples,
    ...networkSecurityQuestionSamples,
  ].filter((question) => question.contentLinks.length > 1);

  assert.equal(questions.length, 27);
  for (const question of questions) {
    assert.equal("primaryCurriculumPlacements" in question, false);
    for (const courseLink of question.courseLinks) {
      const treeId = `curriculum-${courseLink.courseId.slice("course-".length)}-2027-2029-official`;
      const expectedNodeIds = [
        ...new Set(
          officialSecurityCertificationCourseLessons
            .filter(
              (lesson) =>
                lesson.courseId === courseLink.courseId &&
                question.contentLinks.some(
                  (link) => link.contentId === lesson.contentId,
                ),
            )
            .map((lesson) => lesson.curriculumNodeId),
        ),
      ].sort();
      const resolution = resolveQuestionCurriculumPlacement(question, {
        courseId: courseLink.courseId,
        curriculumTreeId: treeId,
      });

      assert.equal(resolution.mode, "LEGACY_CONTENT_DERIVED");
      assert.equal(resolution.primaryPlacement, null);
      assert.deepEqual(resolution.officialPlacementNodeIds, expectedNodeIds);
    }
  }
});

test("Industrial Q1-Q3 educational payload hashes remain unchanged", () => {
  const questions = new Map(
    [...systemSecurityQuestionSamples, ...networkSecurityQuestionSamples].map(
      (question) => [question.id, question],
    ),
  );
  const expectedHashes = new Map([
    [
      "system-security-official-sample-q05",
      "f884b06a111e62ad5a01ec7d7f9223ebd30cd048b42b6150a89dd66f556377b9",
    ],
    [
      "system-security-official-sample-q08",
      "f67c933583fec08426fa52be99e5599093346b2ca5348dc1f209815594d3e437",
    ],
    [
      "network-security-official-sample-q04",
      "526f1b027845e6c0dd8b62281c7e2ecc7b4410e1a46b23b6bac435703af8c95a",
    ],
  ]);

  for (const [questionId, expectedHash] of expectedHashes) {
    const question = questions.get(questionId);
    assert.ok(question);
    assert.equal(
      educationalPayloadHash(question as unknown as Record<string, unknown>),
      expectedHash,
    );
    assert.equal("primaryCurriculumPlacements" in question, false);
  }
});
