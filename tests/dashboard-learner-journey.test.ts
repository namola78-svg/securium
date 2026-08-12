import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/dashboard/page.tsx", "utf8");
const styles = readFileSync("components/v2/dashboard-v2.module.css", "utf8");
const loading = readFileSync("app/dashboard/loading.tsx", "utf8");

test("dashboard prioritizes one recommended action before supporting information", () => {
  const recommendationIndex = source.indexOf('data-dashboard-recommendation=""');
  const progressIndex = source.indexOf('data-dashboard-progress=""');
  const planIndex = source.indexOf('data-dashboard-plan=""');
  assert.ok(recommendationIndex > -1);
  assert.ok(progressIndex > recommendationIndex);
  assert.ok(planIndex > progressIndex);
  assert.equal(source.match(/className=\{styles\.primaryAction\}/g)?.length, 1);
});

test("dashboard reuses existing aggregates without adding readiness or weakness scoring", () => {
  assert.match(source, /listDashboardUserEnrollments\(user\.id\)/);
  assert.match(source, /getTodayLearningPlan\(user\.id\)/);
  assert.match(source, /plan\.recommendations\[0\]/);
  assert.match(source, /plan\.reviewSummary\.dueCount/);
  assert.match(source, /currentCourse\.progressPercent/);
  assert.doesNotMatch(source, /readinessScore|weaknessScore|passProbability|streak/);
  assert.doesNotMatch(source, /시험 준비도|합격 가능성/);
  assert.doesNotMatch(source, /activeCourses\.slice/);
});

test("dashboard provides explicit new-user and no-data states", () => {
  assert.match(source, /학습할 과정을 선택해보세요/);
  assert.match(source, /학습 기록 없음/);
  assert.match(source, /예정된 복습 없음/);
  assert.match(source, /문제를 풀면 실제 학습 기록/);
  assert.match(source, /학습을 시작하면 최근 활동/);
});

test("dashboard preserves course-scoped learn and practice actions", () => {
  assert.match(source, /`\/learn\/\$\{course\.courseSlug\}`/);
  assert.match(source, /`\/practice\/\$\{course\.courseSlug\}\?random=1&count=10`/);
});

test("dashboard responsive order keeps the recommendation first on mobile", () => {
  assert.match(styles, /grid-template-areas: "recommendation progress"/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?grid-template-areas: "recommendation" "progress" "plan" "courses" "weakness" "recent"/);
  assert.match(styles, /\.primaryAction \{[^}]*min-height: 3\.25rem/);
});

test("dashboard has a route-scoped stable loading state", () => {
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /role="status"/);
  assert.doesNotMatch(styles, /shimmer|animation:/);
});
