import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("reviews page exposes immediate review actions after the review summary", () => {
  const source = readFileSync("app/reviews/page.tsx", "utf8");
  const overviewIndex = source.indexOf("review-overview-panel");
  const progressIndex = source.indexOf("오늘의 복습 완료율");
  const actionStripIndex = source.indexOf("review-action-strip");

  assert.ok(overviewIndex > -1);
  assert.ok(progressIndex > -1);
  assert.ok(actionStripIndex > -1);
  assert.ok(overviewIndex < progressIndex);
  assert.ok(progressIndex < actionStripIndex);
  assert.match(source, /오늘 복습/);
  assert.match(source, /오답 정리/);
  assert.match(source, /추가 풀이/);
});

test("wrong notes page summarizes repeated and unresolved weak areas", () => {
  const source = readFileSync("app/wrong-notes/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /wrong-note-insight-grid/);
  assert.match(source, /반복 오답/);
  assert.match(source, /미숙지/);
  assert.match(source, /최대 오답 횟수/);
  assert.match(styles, /\.review-action-strip/);
  assert.match(styles, /\.wrong-note-insight-grid/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.review-action-strip/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.wrong-note-insight-grid/);
});
