import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("integrated analytics exposes learner next-action cards", () => {
  const source = readFileSync("app/analytics/page.tsx", "utf8");
  const overviewIndex = source.indexOf("analytics-overview-panel");
  const nextActionIndex = source.indexOf("analytics-action-panel");
  const stripIndex = source.indexOf("analytics-action-strip");

  assert.ok(overviewIndex > -1);
  assert.ok(nextActionIndex > -1);
  assert.ok(stripIndex > -1);
  assert.ok(overviewIndex < nextActionIndex);
  assert.ok(nextActionIndex < stripIndex);
  assert.match(source, /취약 과정/);
  assert.match(source, /문제풀이/);
  assert.match(source, /복습/);
  assert.match(source, /어디까지 했지\?/);
  assert.match(source, /다음은 뭘 하지\?/);
  assert.match(source, /얼마나 남았지\?/);
  assert.match(source, /어디가 약하지\?/);
  assert.match(source, /analytics-decision-flow/);
});

test("course analytics connects weak areas to practice and review", () => {
  const source = readFileSync("app/analytics/[courseId]/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /analytics-learner-answer-panel/);
  assert.match(source, /어디까지 했지\?/);
  assert.match(source, /다음은 뭘 하지\?/);
  assert.match(source, /얼마나 남았지\?/);
  assert.match(source, /어디가 약하지\?/);
  assert.match(source, /단계 완료율/);
  assert.match(source, /문제부터 보완/);
  assert.match(source, /취약 영역/);
  assert.match(source, /추가 풀이/);
  assert.match(source, /복습 연결/);
  assert.match(source, /analytics-action-strip/);
  assert.match(styles, /\.analytics-learner-answer-panel/);
  assert.match(styles, /\.analytics-action-strip/);
  assert.match(styles, /\.analytics-action-card:focus-visible/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.analytics-learner-answer-panel/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.analytics-action-strip/);
});
