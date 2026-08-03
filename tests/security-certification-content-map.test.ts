import assert from "node:assert/strict";
import test from "node:test";
import {
  getSecurityCertificationContentMap,
  getSecurityCertificationDeepNodeCoverageSummary,
  getSecurityCertificationContentMapSummary,
} from "../lib/curriculum/security-certification-content-map.ts";

test("security certification content map covers every top-level official curriculum node", () => {
  const summary = getSecurityCertificationContentMapSummary();

  assert.equal(summary.rowCount, 11);
  assert.equal(summary.mappedRowCount, 11);
  assert.equal(summary.unmappedRowCount, 0);
  assert.equal(summary.rowsWithQuestionsCount, 9);
  assert.equal(summary.mappedRowsMissingQuestionsCount, 2);
  assert.deepEqual(summary.byCourse, {
    "course-ise": {
      rowCount: 6,
      mappedRowCount: 6,
      rowsWithQuestionsCount: 5,
    },
    "course-isie": {
      rowCount: 5,
      mappedRowCount: 5,
      rowsWithQuestionsCount: 4,
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
    const expectedQuestionCourseIds = engineerKey.endsWith("-01-02")
      ? []
      : ["course-ise", "course-isie"];
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

test("security certification deep node coverage exposes remaining major and sub item gaps", () => {
  const summary = getSecurityCertificationDeepNodeCoverageSummary();

  assert.equal(summary.nodeCount, 139);
  assert.equal(summary.contentLinkedCount, 75);
  assert.equal(summary.questionLinkedCount, 57);
  assert.equal(summary.contentCoveragePercent, 54);
  assert.equal(summary.questionCoveragePercent, 41);
  assert.deepEqual(summary.byCourse, {
    "course-ise": {
      nodeCount: 77,
      contentLinkedCount: 38,
      questionLinkedCount: 29,
      contentCoveragePercent: 49.4,
      questionCoveragePercent: 37.7,
    },
    "course-isie": {
      nodeCount: 62,
      contentLinkedCount: 37,
      questionLinkedCount: 28,
      contentCoveragePercent: 59.7,
      questionCoveragePercent: 45.2,
    },
  });
  assert.equal(summary.byNodeType.SUBJECT.nodeCount, 9);
  assert.equal(summary.byNodeType.PRACTICAL.nodeCount, 2);
  assert.equal(summary.byNodeType.MAJOR_ITEM.nodeCount, 33);
  assert.equal(summary.byNodeType.SUB_ITEM.nodeCount, 95);
  assert.equal(summary.byNodeType.MAJOR_ITEM.contentLinkedCount, 16);
  assert.equal(summary.byNodeType.SUB_ITEM.contentLinkedCount, 48);
  assert.equal(summary.byNodeType.SUB_ITEM.questionLinkedCount, 48);
  assert.equal(summary.uncoveredRows.length, 64);
  assert.equal(summary.questionGapRows.length, 18);
  assert.equal(
    summary.questionGapRows.every(
      (row) =>
        row.stableKey.startsWith("ISE-2027-2029-01-01-") ||
        row.stableKey === "ISE-2027-2029-01-02" ||
        row.stableKey.startsWith("ISE-2027-2029-01-02-") ||
        row.stableKey.startsWith("ISE-2027-2029-01-03-") ||
        row.stableKey.startsWith("ISIE-2027-2029-01-01-") ||
        row.stableKey === "ISIE-2027-2029-01-02" ||
        row.stableKey.startsWith("ISIE-2027-2029-01-02-") ||
        row.stableKey.startsWith("ISIE-2027-2029-01-03-"),
    ),
    true,
  );
});
