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
    "기준 해설",
    "검토된 학습 콘텐츠",
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

test("learner curriculum tree uses product-ready empty action copy", () => {
  const source = readFileSync("components/learn-curriculum-path-tree.tsx", "utf8");

  assert.match(source, /연결된 학습 자료가 곧 제공됩니다/);
  assert.match(source, /이론과 문제는 차례대로 제공됩니다/);
  assert.doesNotMatch(source, /학습 자료를 준비하고 있습니다/);
  assert.doesNotMatch(source, /순차적으로 보강됩니다/);
});

test("practical code analysis uses learner-facing Korean labels", () => {
  const source = readFileSync("components/code-analysis-workbench.tsx", "utf8");

  assert.match(source, /코드 분석 실습/);
  assert.doesNotMatch(source, /CODE ANALYSIS/);
});

test("review page does not expose internal target ids as fallback titles", () => {
  const source = readFileSync("app/reviews/page.tsx", "utf8");

  assert.match(source, /formatReviewItemTitle/);
  assert.match(source, /복습 항목/);
  assert.doesNotMatch(source, /`\\$\\{item\\.targetType\\} \\$\\{item\\.targetId\\}`/);
  assert.doesNotMatch(source, /topItem\\.questionTitle \\?\\? topItem\\.targetId/);
});

test("dashboard empty recommendation copy points to the next learning action", () => {
  const source = readFileSync("app/dashboard/page.tsx", "utf8");

  assert.match(source, /오늘 학습을 시작해보세요/);
  assert.match(source, /다음 학습을 안내합니다/);
  assert.doesNotMatch(source, /첫 학습 기록을 만들어보세요/);
  assert.doesNotMatch(source, /기록이 쌓이면 AI가 다음 학습 후보/);
});

test("wrong notes empty state explains the learner action loop", () => {
  const source = readFileSync("app/wrong-notes/page.tsx", "utf8");

  assert.match(source, /틀린 항목이 생기면 여기서 바로 다시 볼 수 있습니다/);
  assert.doesNotMatch(source, /오답 결과가 자동으로 누적됩니다/);
});

test("practice guidance describes grading in learner-facing terms", () => {
  const source = [
    "app/practice/[courseSlug]/page.tsx",
    "components/practice-session.tsx",
  ]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  assert.match(source, /자동 채점/);
  assert.match(source, /기준 해설/);
  assert.match(source, /최신 확인일/);
  assert.match(source, /근거 확인/);
  assert.match(source, /표시할 학습 근거가 없습니다/);
  assert.doesNotMatch(source, /서버에서 채점/);
  assert.doesNotMatch(source, /서버 채점/);
  assert.doesNotMatch(source, /검수 해설/);
  assert.doesNotMatch(source, /최신 검수일/);
  assert.doesNotMatch(source, />검수</);
  assert.doesNotMatch(source, /미검수/);
  assert.doesNotMatch(source, /검수된 관련/);
  assert.doesNotMatch(source, /검수 근거/);
  assert.doesNotMatch(source, /검수 정보가 등록되지 않았습니다/);
});

test("ai tutor empty state explains the next learner action", () => {
  const source = readFileSync("app/ai-tutor/page.tsx", "utf8");

  assert.match(source, /자동 채점 결과/);
  assert.match(source, /AI 추천은 학습 후 바로 연결됩니다/);
  assert.match(source, /다음에 볼 이론, 문제, 취약 영역/);
  assert.doesNotMatch(source, /서버 채점 결과/);
  assert.doesNotMatch(source, /AI 맞춤 추천을 준비하고 있습니다/);
  assert.doesNotMatch(source, /기록이 쌓이면 추천 학습과 AI 해설/);
});

test("learner settings page does not reuse admin panel shell classes", () => {
  const source = readFileSync("app/settings/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /learner-settings-panel/);
  assert.doesNotMatch(source, /admin-panel settings-panel/);
  assert.match(styles, /\.learner-settings-panel/);
});

test("mock exam learner analysis cards do not reuse admin panel shell classes", () => {
  const source = readFileSync("components/mock-exam-session.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /exam-breakdown-panel/);
  assert.doesNotMatch(source, /<article className="admin-panel">/);
  assert.match(styles, /\.exam-breakdown-panel/);
});

test("specialized learner pages do not reuse admin panel shell classes", () => {
  const source = [
    "app/specialized/[courseSlug]/page.tsx",
    "app/specialized/[courseSlug]/[contentType]/[contentId]/page.tsx",
  ]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /specialized-info-panel/);
  assert.doesNotMatch(source, /className="admin-panel/);
  assert.match(styles, /\.specialized-info-panel/);
});
