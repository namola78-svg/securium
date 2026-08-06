import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("mock exam session uses learner-friendly save and empty analysis copy", () => {
  const source = readFileSync("components/mock-exam-session.tsx", "utf8");

  assert.match(source, /답안이 저장되었습니다/);
  assert.match(source, /답안을 저장하지 못했습니다/);
  assert.match(source, /분석할 학습 기록이 아직 충분하지 않습니다/);
  assert.doesNotMatch(source, /답안 임시 저장됨|답안 저장 실패|분석 가능한 연결 정보/);
});
