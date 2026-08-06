import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("practice hub explains the course-scoped problem solving loop", () => {
  const source = readFileSync("app/practice/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /과정별 문제를 풀어보세요/);
  assert.match(source, /과정 선택/);
  assert.match(source, /10문제 풀이/);
  assert.match(source, /채점·AI 해설/);
  assert.match(source, /오답·복습 연결/);
  assert.match(source, /practice-hub-flow/);
  assert.match(styles, /\.practice-hub-flow/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.practice-hub-flow/);
});
