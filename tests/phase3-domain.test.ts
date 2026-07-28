import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLevelResult,
  assertLevelAccessible,
  initialLevelStatus,
} from "../lib/services/level-service.ts";
import { LeitnerReviewScheduler } from "../lib/services/review-scheduler.ts";
import {
  assertExamInProgress,
  calculateExamResult,
  shouldAutoSubmit,
  toPublicExamQuestion,
} from "../lib/services/mock-exam-service.ts";
import { safeRate } from "../lib/services/statistics-service.ts";
import { RuleBasedRecommendationService } from "../lib/services/recommendation-service.ts";

test("첫 단계는 해제되고 선행 단계가 있으면 잠긴다", () => {
  assert.equal(initialLevelStatus(null), "AVAILABLE");
  assert.equal(initialLevelStatus("level-1"), "LOCKED");
});

test("통과 시 다음 단계를 해제하고 미통과 시 잠금을 유지한다", () => {
  const base = {
    status: "AVAILABLE" as const,
    bestScore: 0,
    attemptCount: 0,
    completedAt: null,
    masteredAt: null,
  };
  const failed = applyLevelResult(base, 59, 60);
  assert.equal(failed.passed, false);
  assert.equal(failed.unlockNext, false);
  assert.equal(failed.progress.status, "IN_PROGRESS");
  const passed = applyLevelResult(base, 60, 60);
  assert.equal(passed.passed, true);
  assert.equal(passed.unlockNext, true);
  assert.equal(passed.progress.status, "COMPLETED");
});

test("단계 재학습 시 최고점수와 시도 횟수를 유지한다", () => {
  const result = applyLevelResult(
    {
      status: "COMPLETED",
      bestScore: 88,
      attemptCount: 2,
      completedAt: "2026-01-01T00:00:00.000Z",
      masteredAt: null,
    },
    72,
    60,
  );
  assert.equal(result.progress.bestScore, 88);
  assert.equal(result.progress.attemptCount, 3);
  assert.equal(result.progress.status, "COMPLETED");
});

test("잠긴 단계 접근을 서버 도메인 규칙이 차단한다", () => {
  assert.throws(
    () => assertLevelAccessible("LOCKED"),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "LEVEL_LOCKED",
  );
});

test("정답 연속 횟수에 따라 복습 간격이 1, 3, 7, 14, 30일로 증가한다", () => {
  const scheduler = new LeitnerReviewScheduler();
  const now = new Date("2026-01-01T00:00:00.000Z");
  let state = null;
  const intervals: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const outcome = scheduler.schedule(state, true, now);
    intervals.push(outcome.intervalDays);
    state = outcome;
  }
  assert.deepEqual(intervals, [1, 3, 7, 14, 30]);
});

test("오답은 복습일을 당일로 조정하고 연속 정답을 초기화한다", () => {
  const scheduler = new LeitnerReviewScheduler();
  const now = new Date("2026-01-01T12:00:00.000Z");
  const outcome = scheduler.schedule(
    {
      intervalDays: 7,
      easeFactor: 250,
      consecutiveCorrect: 3,
      consecutiveWrong: 0,
      reviewCount: 3,
    },
    false,
    now,
  );
  assert.equal(outcome.nextReviewAt, now.toISOString());
  assert.equal(outcome.consecutiveCorrect, 0);
  assert.equal(outcome.consecutiveWrong, 1);
  assert.equal(outcome.status, "DUE");
});

test("모의고사 결과를 배점 기준으로 계산한다", () => {
  assert.deepEqual(
    calculateExamResult([
      { questionId: "q1", answered: true, isCorrect: true, earnedScore: 20, possibleScore: 20 },
      { questionId: "q2", answered: true, isCorrect: false, earnedScore: 0, possibleScore: 30 },
      { questionId: "q3", answered: false, isCorrect: false, earnedScore: 0, possibleScore: 50 },
    ]),
    { score: 20, correctCount: 1, wrongCount: 1, unansweredCount: 1 },
  );
});

test("제출 완료 모의고사는 중복 제출을 차단한다", () => {
  assert.throws(
    () =>
      assertExamInProgress({
        status: "SUBMITTED",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "EXAM_ALREADY_SUBMITTED",
  );
});

test("서버 시간이 제한시간을 넘으면 자동 제출 대상이다", () => {
  assert.equal(
    shouldAutoSubmit(
      "2026-01-01T00:00:00.000Z",
      new Date("2026-01-01T00:00:01.000Z"),
    ),
    true,
  );
});

test("제출 전 모의고사 응답에서 정답과 해설을 제거한다", () => {
  const safe = toPublicExamQuestion({
    id: "q1",
    content: "sample",
    isCorrect: true,
    explanation: "secret",
  });
  assert.equal("isCorrect" in safe, false);
  assert.equal("explanation" in safe, false);
});

test("정답률 분모가 0이면 0을 반환한다", () => {
  assert.equal(safeRate(0, 0), 0);
});

test("규칙 기반 추천은 연체 복습을 가장 먼저 배치한다", () => {
  const service = new RuleBasedRecommendationService();
  const results = service.recommend([
    { id: "new", kind: "QUESTION", title: "new", reason: "미풀이", priority: "UNSEEN_QUESTION", estimatedMinutes: 2, href: "/" },
    { id: "level", kind: "LEVEL", title: "level", reason: "미완료", priority: "INCOMPLETE_LEVEL", estimatedMinutes: 10, href: "/" },
    { id: "due", kind: "REVIEW", title: "due", reason: "2일 연체", priority: "OVERDUE_REVIEW", estimatedMinutes: 3, href: "/" },
  ]);
  assert.equal(results[0]?.id, "due");
});
