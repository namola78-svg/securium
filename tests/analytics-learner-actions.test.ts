import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overview = readFileSync("app/analytics/page.tsx", "utf8");
const course = readFileSync("app/analytics/[courseId]/page.tsx", "utf8");
const styles = readFileSync("app/analytics/analytics-v2.module.css", "utf8");

test("analytics overview prioritizes real summary, weakness, and next actions", () => {
  const summaryIndex = overview.indexOf("analytics-summary-title");
  const weaknessIndex = overview.indexOf("top-weakness-title");
  const courseIndex = overview.indexOf("course-performance-title");

  assert.ok(summaryIndex > -1);
  assert.ok(weaknessIndex > summaryIndex);
  assert.ok(courseIndex > weaknessIndex);
  assert.match(overview, /analytics\.overallAccuracy/);
  assert.match(overview, /analytics\.totalQuestions/);
  assert.match(overview, /analytics\.cumulativeStudyDays/);
  assert.match(overview, /취약 영역 확인/);
  assert.match(overview, /href="\/reviews"/);
  assert.match(overview, /href="\/wrong-notes"/);
  assert.match(overview, /`\/practice\/\$\{topCourse\.courseSlug\}\?count=10`/);
  assert.doesNotMatch(overview, /readiness|passProbability|예상 합격률/);
});

test("course analytics connects existing subject and topic results to practice", () => {
  assert.match(course, /stats\.bySubject/);
  assert.match(course, /stats\.byTopic/);
  assert.match(course, /stats\.repeatedWrongCount/);
  assert.match(course, /subjectId=\$\{row\.id\}&count=10/);
  assert.match(course, /new URLSearchParams\(\{ topicId, count: "10" \}\)/);
  assert.match(course, /role="progressbar"/);
  assert.match(course, /aria-valuemin=\{0\}/);
  assert.match(course, /aria-valuemax=\{100\}/);
  assert.match(course, /aria-valuenow=\{value\}/);
  assert.match(course, /const value = row\.accuracy/);
  assert.doesNotMatch(course, /Math\.min\(100|Math\.max\(0/);
  assert.match(course, /집중 복습/);
  assert.match(course, /href="\/wrong-notes"/);
  assert.match(course, /href="\/reviews"/);
});

test("analytics handles no, partial, loading, and error data explicitly", () => {
  const loading = readFileSync("app/analytics/loading.tsx", "utf8");
  const error = readFileSync("app/analytics/error.tsx", "utf8");
  const combined = `${overview}\n${course}`;

  assert.match(overview, /아직 학습 기록이 충분하지 않습니다/);
  assert.match(course, /아직 문제 풀이 기록이 없습니다/);
  assert.match(combined, /아직 확인된 취약 영역이 없습니다/);
  assert.match(overview, /hasLearningData/);
  assert.match(overview, /hasQuestionData/);
  assert.match(overview, /\{course\.stats\.totalQuestions\}문제 풀이/);
  assert.match(course, /hasQuestionData/);
  assert.match(loading, /최근 학습 기록과 과정별 진도를 확인하고 있습니다/);
  assert.match(error, /학습 분석을 불러오지 못했습니다/);
  assert.match(error, /onClick=\{reset\}/);
  assert.doesNotMatch(combined, /NaN|Infinity|null%|undefined%|-0%|10000%/);
});

test("analytics presentation is scoped, responsive, and touch accessible", () => {
  assert.match(overview, /analytics-v2\.module\.css/);
  assert.match(course, /analytics-v2\.module\.css/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /\.ds-button\.variant-dark[\s\S]*?color: var\(--white\)/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(`${overview}\n${course}`, /className="[^"]*admin-panel/);
});
