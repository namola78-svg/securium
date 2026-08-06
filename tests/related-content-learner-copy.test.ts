import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("lecture detail empty related content copy is learner friendly", () => {
  const source = readFileSync("app/lectures/[courseSlug]/[lectureId]/page.tsx", "utf8");

  assert.match(source, /함께 볼 이론 자료가 아직 없습니다/);
  assert.match(source, /이 강의와 함께 풀 문제가 아직 없습니다/);
  assert.doesNotMatch(source, /연결된 공개 이론 레슨|연결된 공개 문제/);
});

test("specialized detail related content copy avoids internal linkage language", () => {
  const source = readFileSync(
    "app/specialized/[courseSlug]/[contentType]/[contentId]/page.tsx",
    "utf8",
  );

  assert.match(source, /함께 학습할 과정/);
  assert.match(source, /이 자료와 함께 풀 문제가 아직 없습니다/);
  assert.doesNotMatch(source, /연결 과정|연결된 공개 문제/);
});
