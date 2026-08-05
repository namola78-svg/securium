import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("learner dashboard prioritizes today actions before summary metrics", () => {
  const source = readFileSync("app/dashboard/page.tsx", "utf8");
  const todayPlanIndex = source.indexOf("<TodayPlanSection");
  const activeCoursesIndex = source.indexOf("<ActiveCoursesSection");
  const summaryIndex = source.indexOf("dashboard-summary-section");

  assert.ok(todayPlanIndex > -1);
  assert.ok(activeCoursesIndex > -1);
  assert.ok(summaryIndex > -1);
  assert.ok(todayPlanIndex < activeCoursesIndex);
  assert.ok(activeCoursesIndex < summaryIndex);
});

test("today plan uses learner cards for goal, AI recommendation, review, and settings", () => {
  const source = readFileSync("app/dashboard/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /today-plan-card today-plan-card-primary/);
  assert.match(source, /오늘 목표/);
  assert.match(source, /AI 추천/);
  assert.match(source, /복습/);
  assert.match(source, /학습 설정/);
  assert.match(source, /추천 학습/);
  assert.match(source, /바로 이어갈 학습/);
  assert.match(styles, /\.today-plan-card/);
  assert.match(styles, /@media \(max-width: 1024px\)[\s\S]*?\.today-plan-grid/);
});

test("learner dashboard avoids admin-style English section labels", () => {
  const source = readFileSync("app/dashboard/page.tsx", "utf8");

  assert.match(source, /오늘 시작하기/);
  assert.match(source, /오늘의 학습 계획/);
  assert.match(source, /이어서 학습/);
  assert.match(source, /학습 요약/);
  assert.doesNotMatch(
    source,
    /LEARNING SUMMARY|TODAY START|TODAY PLAN|NEXT ACTIONS|CONTINUE LEARNING/,
  );
});

test("learner dashboard maps internal enrollment status to user-facing labels", () => {
  const source = readFileSync("app/dashboard/page.tsx", "utf8");

  assert.match(source, /getEnrollmentStatusLabel\(enrollment\.status\)/);
  assert.match(source, /case "ACTIVE":[\s\S]*?return "학습 중"/);
  assert.match(source, /case "COMPLETED":[\s\S]*?return "완료"/);
  assert.doesNotMatch(source, /<span className="badge">\{enrollment\.status\}<\/span>/);
});
