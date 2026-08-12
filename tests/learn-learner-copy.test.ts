import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = [
  "app/learn/[courseSlug]/page.tsx",
  "app/learn/[courseSlug]/subjects/[subjectId]/page.tsx",
  "app/learn/[courseSlug]/lessons/[lessonId]/page.tsx",
  "app/learn/[courseSlug]/course-lessons/[courseLessonId]/page.tsx",
  "components/learn-curriculum-path-tree.tsx",
];

test("Learn V2 translates domain structures into learner-facing language", () => {
  const combined = files.map((file) => readFileSync(file, "utf8")).join("\n");
  for (const copy of [
    "다음 학습",
    "핵심 개념",
    "시험 포인트",
    "문제 확인",
    "공식 근거",
    "현재 위치",
    "과정 구성",
    "관련 문제",
  ]) assert.match(combined, new RegExp(copy));

  assert.doesNotMatch(combined, /온톨로지|SKOS URI|raw provenance|CourseLesson Edge|Stable Key/);
  assert.doesNotMatch(combined, /MAJOR_ITEM|SUB_ITEM/);
  assert.doesNotMatch(combined, /占/);
});
