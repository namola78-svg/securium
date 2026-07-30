import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const seedSql = readFileSync("db/seed.sql", "utf8");

test("shared curriculum seed contains reusable published contents", () => {
  const expectedContentIds = [
    "content-shared-access-control-basics",
    "content-shared-personal-data-encryption",
    "content-shared-incident-response-lifecycle",
    "content-shared-risk-assessment-method",
    "content-shared-secure-input-validation",
    "content-shared-privacy-data-flow",
  ];

  for (const contentId of expectedContentIds) {
    assert.match(seedSql, new RegExp(contentId));
  }

  assert.match(seedSql, /sample\.shared\.access-control-basics/);
  assert.match(seedSql, /sample\.shared\.privacy-data-flow/);
  assert.match(seedSql, /'PUBLISHED'/);
});

test("shared curriculum seed links common contents to all seven courses", () => {
  const expectedCourseIds = [
    "course-isms-p",
    "course-ise",
    "course-isie",
    "course-isrm",
    "course-sw-vuln",
    "course-cppg",
    "course-pia",
  ];

  for (const courseId of expectedCourseIds) {
    assert.match(seedSql, new RegExp(`'${courseId}'`));
  }

  const courseLessonMatches = seedSql.match(/course-lesson-[a-z0-9-]+/g) ?? [];
  const sprintASampleLinks = courseLessonMatches.filter((id) =>
    [
      "access-control",
      "encryption",
      "incident-response",
      "risk-assessment",
      "input-validation",
      "privacy-flow",
    ].some((key) => id.includes(key)),
  );

  assert.ok(
    new Set(sprintASampleLinks).size >= 20,
    "expected at least 20 course-specific shared lesson links",
  );
});

test("shared curriculum seed provides course-specific lesson extensions", () => {
  const expectedExtensionIds = [
    "course-lesson-extension-isms-access-control",
    "course-lesson-extension-cppg-encryption",
    "course-lesson-extension-isrm-risk-assessment",
    "course-lesson-extension-sw-vuln-input-validation",
    "course-lesson-extension-pia-privacy-flow",
  ];

  for (const extensionId of expectedExtensionIds) {
    assert.match(seedSql, new RegExp(extensionId));
  }
});
