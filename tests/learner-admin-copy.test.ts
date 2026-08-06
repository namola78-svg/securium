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
    "새 과정이 공개되면",
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
  const displaySource = readFileSync("lib/course-display.ts", "utf8");

  assert.match(displaySource, /function courseAudienceLabel/);
  assert.match(landingSource, /courseAudienceLabel\(course\)/);
  assert.match(detailSource, /const audienceLabel = courseAudienceLabel\(course\)/);
  assert.doesNotMatch(landingSource, /recommendedAudience\(course\.difficulty\)/);
  assert.doesNotMatch(detailSource, /recommendedAudience\(course\.difficulty\)/);
});
