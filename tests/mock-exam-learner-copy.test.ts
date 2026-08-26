import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("mock exam V2 preserves exam APIs and hides grading during an active attempt", () => {
  const session = readFileSync("components/mock-exam-session.tsx", "utf8");
  assert.match(session, /\/api\/mock-exams\/answer/);
  assert.match(session, /\/api\/mock-exams\/submit/);
  assert.match(session, /new Date\(attempt\.expiresAt\)/);
  assert.match(session, /remaining === 0/);
  const resultBranch = session.indexOf("if (submitted) return");
  const activeBranch = session.indexOf("data-mock-exam-session-v2");
  assert.ok(resultBranch > -1);
  assert.ok(activeBranch > resultBranch);
  assert.match(session, /attempt\.resultsAvailable \?/);
});

test("mock exam V2 exposes navigation, submit confirmation, results, and review links", () => {
  const session = readFileSync("components/mock-exam-session.tsx", "utf8");
  const shell = readFileSync("components/learner-app-shell.tsx", "utf8");
  assert.match(session, /답변 완료/);
  assert.match(session, /미답변/);
  assert.match(session, /role="dialog" aria-modal="true"/);
  assert.match(session, /과목별 결과/);
  assert.match(session, /공식 해설/);
  assert.match(session, /href="\/reviews"/);
  assert.match(session, /href="\/wrong-notes"/);
  const nav = readFileSync("lib/ui-nav.ts", "utf8");
  assert.match(shell, /isLearnerFocusRoute\(pathname\)/);
  assert.match(nav, /mock-exams\/attempts/);
});

test("mock exam entry and instructions use actual repository metadata", () => {
  const entry = readFileSync("app/mock-exams/page.tsx", "utf8");
  const detail = readFileSync("app/mock-exams/[mockExamId]/page.tsx", "utf8");
  for (const value of ["questionCount", "timeLimitMinutes", "passingScore", "maxAttempts", "attemptCount"]) assert.match(entry + detail, new RegExp(value));
  assert.match(detail, /시험 중에는 정답과 해설이 표시되지 않습니다/);
  assert.match(detail, /<MockExamStart mockExamId=\{exam\.id\}/);
});
