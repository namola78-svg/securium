import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const learnerFacingFiles = [
  "app/learn/[courseSlug]/page.tsx",
  "app/learn/[courseSlug]/course-lessons/[courseLessonId]/page.tsx",
  "components/course-lesson-actions.tsx",
];

test("learn pages expose learner-facing Korean copy instead of internal or mojibake labels", () => {
  const learnOverview = readFileSync(learnerFacingFiles[0], "utf8");
  const courseLessonPage = readFileSync(learnerFacingFiles[1], "utf8");
  const courseLessonActions = readFileSync(learnerFacingFiles[2], "utf8");
  const combined = [learnOverview, courseLessonPage, courseLessonActions].join(
    "\n",
  );

  for (const expected of [
    "오늘 학습 보기",
    "문제 풀기",
    "오늘의 복습",
    "이 과정에서 지금 할 일",
    "어디까지 했지?",
    "약한 부분은?",
    "이론 레슨",
    "과정 맥락",
    "레슨 이동",
    "레슨 진도",
    "본문을 더 학습해주세요",
    "핵심 이론",
  ]) {
    assert.match(combined, new RegExp(expected));
  }

  assert.doesNotMatch(combined, /�/);
  assert.doesNotMatch(combined, /쨌|怨|臾|蹂|遺|媛|紐|異|而/);
  assert.doesNotMatch(combined, /CourseLesson Edge|Stable Key|MAJOR_ITEM|SUB_ITEM/);
  assert.doesNotMatch(combined, /기존 학습 자료|준비되어 있지만|연결된 레슨이 아직 부족/);
});
