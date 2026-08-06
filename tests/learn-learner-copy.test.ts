import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const learnerFacingFiles = [
  "app/learn/[courseSlug]/page.tsx",
  "app/learn/[courseSlug]/subjects/[subjectId]/page.tsx",
  "app/learn/[courseSlug]/lessons/[lessonId]/page.tsx",
  "app/learn/[courseSlug]/course-lessons/[courseLessonId]/page.tsx",
  "components/lesson-actions.tsx",
  "components/course-lesson-actions.tsx",
  "components/learn-curriculum-path-tree.tsx",
];

test("learn pages expose learner-facing Korean copy instead of internal or mojibake labels", () => {
  const learnOverview = readFileSync(learnerFacingFiles[0], "utf8");
  const subjectPage = readFileSync(learnerFacingFiles[1], "utf8");
  const legacyLessonPage = readFileSync(learnerFacingFiles[2], "utf8");
  const courseLessonPage = readFileSync(learnerFacingFiles[3], "utf8");
  const lessonActions = readFileSync(learnerFacingFiles[4], "utf8");
  const courseLessonActions = readFileSync(learnerFacingFiles[5], "utf8");
  const curriculumPathTree = readFileSync(learnerFacingFiles[6], "utf8");
  const combined = [
    learnOverview,
    subjectPage,
    legacyLessonPage,
    courseLessonPage,
    lessonActions,
    courseLessonActions,
    curriculumPathTree,
  ].join("\n");

  for (const expected of [
    "오늘 학습 보기",
    "문제 풀기",
    "오늘의 복습",
    "이 과정에서 지금 할 일",
    "공식 출제기준을 따라 핵심 이론과 문제로 바로 이동합니다",
    "공식 커리큘럼을 따라가기 전에 핵심 이론부터 차근차근 확인",
    "어디까지 했지?",
    "약한 부분은?",
    "핵심 이론",
    "본문형 핵심 이론",
    "과목 이론 진도",
    "이 과목에서 다루는 주제",
    "공통 학습 콘텐츠",
    "학습 맥락",
    "이 과정에서 함께 볼 내용",
    "완료 방식",
    "본문 끝까지 학습",
    "핵심 이론 이동",
    "레슨 이동",
    "읽기 진도",
    "본문을 더 학습해주세요",
    "레슨 완료",
  ]) {
    assert.match(combined, new RegExp(expected));
  }

  assert.doesNotMatch(combined, /占/);
  assert.doesNotMatch(combined, /CourseLesson Edge|Stable Key|MAJOR_ITEM|SUB_ITEM/);
  assert.doesNotMatch(
    combined,
    /이론 레슨|본문형 이론 레슨|기존 학습 자료|준비되어 있지만 공식 커리큘럼 학습 콘텐츠가 충분히 연결|연결된 레슨|연결 예정|콘텐츠 연결 예정|연결된 이론 레슨|연결된 문제/,
  );
});
