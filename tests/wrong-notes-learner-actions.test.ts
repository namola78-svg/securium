import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("wrong-note rows keep the learner's retry action primary", () => {
  const source = readFileSync("components/wrong-note-card.tsx", "utf8");
  const styles = readFileSync("components/v2/review-v2.module.css", "utf8");

  const retryIndex = source.indexOf("다시 풀기");
  const managementIndex = source.indexOf("메모와 학습 상태 관리");
  assert.ok(retryIndex > -1);
  assert.ok(managementIndex > retryIndex);
  assert.match(source, /-webkit-line-clamp|noteContent/);
  assert.match(styles, /\.noteContent[\s\S]*-webkit-line-clamp: 3/);
  assert.match(styles, /min-height: var\(--v2-control-min-size\)/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*\.notePrimaryAction \.primaryAction \{ width: 100%/);
});
