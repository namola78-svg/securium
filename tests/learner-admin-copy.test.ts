import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const learnerFiles = [
  "app/courses/page.tsx",
  "components/course-card.tsx",
  "app/learn/[courseSlug]/subjects/[subjectId]/page.tsx",
  "components/mock-exam-session.tsx",
  "components/practice-session.tsx",
  "app/practice/[courseSlug]/page.tsx",
  "components/specialized-ai-review.tsx",
];

test("learner pages do not expose admin ownership in routine guidance", () => {
  const combined = learnerFiles
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  for (const expected of [
    "과정이 공개되면 이곳에서 목표별 학습 경로를 바로 확인",
    "이 과목의 레슨이 공개되면",
    "결과 공개 시점 이후",
    "검토 후 필요한 경우 반영됩니다",
    "검수 해설",
    "검수된 학습 콘텐츠",
    "기존 채점 결과",
  ]) {
    assert.match(combined, new RegExp(expected));
  }

  assert.doesNotMatch(combined, /관리자가 공개한 과정/);
  assert.doesNotMatch(combined, /관리자가 이 과목의 레슨/);
  assert.doesNotMatch(combined, /관리자가 설정한 결과/);
  assert.doesNotMatch(combined, /관리자가 확인합니다/);
  assert.doesNotMatch(combined, /관리자 검수 해설/);
  assert.doesNotMatch(combined, /관리자 검수 콘텐츠/);
  assert.doesNotMatch(combined, /관리자 채점 결과/);
});

test("public course cards do not expose internal course codes as primary labels", () => {
  const source = readFileSync("components/course-card.tsx", "utf8");
  const displaySource = readFileSync("lib/course-display.ts", "utf8");

  assert.match(source, /courseTypeLabel/);
  assert.doesNotMatch(source, /aria-label=\{`과정 코드/);
  assert.doesNotMatch(source, />\s*\{course\.code\}\s*<\/span>/);
  for (const label of [
    "국가기술자격",
    "관리체계",
    "개인정보",
    "위험관리",
    "실무 역량",
  ]) {
    assert.match(displaySource, new RegExp(label));
  }
});

test("public course entry points use course-aware audience labels", () => {
  const landingSource = readFileSync("app/page.tsx", "utf8");
  const detailSource = readFileSync("app/courses/[courseSlug]/page.tsx", "utf8");
  const cardSource = readFileSync("components/course-card.tsx", "utf8");
  const displaySource = readFileSync("lib/course-display.ts", "utf8");

  assert.match(displaySource, /function courseAudienceLabel/);
  assert.match(landingSource, /courseAudienceLabel\(course\)/);
  assert.match(detailSource, /const audienceLabel = courseAudienceLabel\(course\)/);
  assert.match(cardSource, /const recommendedFor = courseAudienceLabel\(course\)/);
  assert.doesNotMatch(landingSource, /recommendedAudience\(course\.difficulty\)/);
  assert.doesNotMatch(detailSource, /recommendedAudience\(course\.difficulty\)/);
  assert.doesNotMatch(cardSource, /recommendedAudience\(course\.difficulty\)/);
});

test("public courses directory uses learner-facing labels", () => {
  const source = readFileSync("app/courses/page.tsx", "utf8");
  const cardSource = readFileSync("components/course-card.tsx", "utf8");

  assert.match(source, /학습 경로 선택/);
  assert.match(source, /나에게 맞는 과정을 찾아보세요/);
  assert.match(source, /과정 분류/);
  assert.match(source, /목표별 학습 경로/);
  assert.doesNotMatch(source, /COURSE DIRECTORY/);
  assert.doesNotMatch(source, /COURSE GROUP/);
  assert.match(cardSource, /문제 콘텐츠 준비 중/);
  assert.doesNotMatch(cardSource, /문항 업데이트 예정/);
});

test("public course detail uses learner-facing section labels", () => {
  const source = readFileSync("app/courses/[courseSlug]/page.tsx", "utf8");

  for (const label of [
    "학습 시작",
    "과정 소개",
    "추천 대상",
    "학습 목표",
    "학습 구성",
    "수료 기준",
    "다음 행동",
  ]) {
    assert.match(source, new RegExp(label));
  }

  assert.doesNotMatch(
    source,
    /START LEARNING|OVERVIEW|RECOMMENDED FOR|GOALS|CURRICULUM|COMPLETION|READY TO START/,
  );
  assert.match(source, /문제 콘텐츠 준비 중/);
  assert.doesNotMatch(source, /문항 업데이트 예정/);
});

test("public landing guide and about pages use learner-facing eyebrow labels", () => {
  const combined = [
    "app/page.tsx",
    "app/guide/page.tsx",
    "app/about/page.tsx",
  ]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  for (const internalLabel of [
    "Knowledge Engine",
    "Knowledge-linked Learning",
    "AI-POWERED SECURITY LEARNING",
    "학습 코어",
    "공식 기준 기반 학습 엔진",
    "복습 신호",
    "지식 구조",
    "TODAY",
    "LEARNING GUIDE",
    "RECOMMENDED FLOW",
    "ABOUT SECURIUM",
    "MISSION",
    "PRINCIPLES",
    "FOR LEARNERS",
    "GET STARTED",
  ]) {
    assert.doesNotMatch(combined, new RegExp(internalLabel));
  }
});

test("learner analytics pages avoid internal signal wording", () => {
  const combined = [
    "app/analytics/page.tsx",
    "app/analytics/[courseId]/page.tsx",
  ]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  assert.match(combined, /학습 결과/);
  assert.match(combined, /취약 영역/);
  assert.doesNotMatch(combined, /학습 신호|취약 신호|분석 신호|신호 만들기/);
});
