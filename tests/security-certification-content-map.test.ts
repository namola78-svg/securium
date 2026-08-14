import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  getSecurityCertificationContentMap,
  getSecurityCertificationDeepNodeCoverageSummary,
  getSecurityCertificationContentMapSummary,
} from "../lib/curriculum/security-certification-content-map.ts";
import {
  officialSecurityCertificationContents,
  officialSecurityCertificationCourseLessons,
} from "../lib/data/security-certification-course-lessons.mjs";

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
