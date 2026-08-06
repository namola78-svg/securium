import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("my courses page uses action-oriented learner copy", () => {
  const source = readFileSync("app/my-courses/page.tsx", "utf8");

  assert.match(source, /등록한 과정을 확인하고 이어서 학습, 문제풀이, 복습으로 바로/);
  assert.match(source, /이어서 학습/);
  assert.match(source, /문제 풀기/);
  assert.match(source, /아직 등록한 과정이 없습니다/);
  assert.match(source, /과정 둘러보기/);
  assert.doesNotMatch(source, /학습 공간/);
  assert.doesNotMatch(source, /CourseLesson|Stable Key|MAJOR_ITEM|SUB_ITEM/);
  assert.doesNotMatch(source, /�|쨌|怨|臾|蹂|遺|媛|紐|異|而/);
});
