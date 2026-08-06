import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const aiFacingFiles = [
  "components/practice-session.tsx",
  "components/specialized-ai-review.tsx",
];

test("learner AI panels use product language for provider labels", () => {
  const practiceSession = readFileSync(aiFacingFiles[0], "utf8");
  const specializedReview = readFileSync(aiFacingFiles[1], "utf8");
  const combined = [practiceSession, specializedReview].join("\n");

  assert.match(combined, /시범 AI/);
  assert.match(combined, /AI 생성/);
  assert.match(combined, /검수 상태/);
  assert.doesNotMatch(combined, /Mock AI/);
  assert.doesNotMatch(combined, /관리자 검수 상태/);
});
