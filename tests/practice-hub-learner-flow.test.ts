import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Practice hub prioritizes real enrolled courses and one start action", () => {
  const source = readFileSync("app/practice/page.tsx", "utf8");
  assert.match(source, /data-practice-hub-v2/);
  assert.match(source, /어떤 과정의 문제를 풀까요/);
  assert.match(source, /listUserEnrollments/);
  assert.match(source, /random=1&count=10/);
  assert.doesNotMatch(source, /fake|샘플 정답률/);
});
