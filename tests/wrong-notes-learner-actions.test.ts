import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("wrong notes page emphasizes learner action over filter mechanics", () => {
  const source = readFileSync("app/wrong-notes/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /다시 풀 오답 범위/);
  assert.match(source, /반복 오답과 미숙지 항목을\s+먼저 확인/);
  assert.match(source, /반복 오답 확인/);
  assert.match(source, /필요한 문제 다시 풀기/);
  assert.match(source, /학습 완료로 정리/);
  assert.doesNotMatch(source, /<h2>현재 필터 조건<\/h2>/);
  assert.match(styles, /\.wrong-note-action-flow/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.wrong-note-action-flow/);
});
