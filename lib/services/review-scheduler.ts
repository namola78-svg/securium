export type ReviewState = {
  intervalDays: number;
  easeFactor: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  reviewCount: number;
};

export type ReviewOutcome = ReviewState & {
  nextReviewAt: string;
  status: "DUE" | "SCHEDULED";
};

export interface ReviewScheduler {
  schedule(
    current: ReviewState | null,
    correct: boolean,
    now?: Date,
  ): ReviewOutcome;
}

const intervals = [1, 3, 7, 14, 30];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export class LeitnerReviewScheduler implements ReviewScheduler {
  schedule(
    current: ReviewState | null,
    correct: boolean,
    now = new Date(),
  ): ReviewOutcome {
    const state = current ?? {
      intervalDays: 0,
      easeFactor: 250,
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      reviewCount: 0,
    };
    if (!correct) {
      return {
        intervalDays: 0,
        easeFactor: Math.max(130, state.easeFactor - 20),
        consecutiveCorrect: 0,
        consecutiveWrong: state.consecutiveWrong + 1,
        reviewCount: state.reviewCount + 1,
        nextReviewAt: now.toISOString(),
        status: "DUE",
      };
    }
    const consecutiveCorrect = state.consecutiveCorrect + 1;
    const intervalDays =
      intervals[Math.min(consecutiveCorrect - 1, intervals.length - 1)];
    return {
      intervalDays,
      easeFactor: Math.min(300, state.easeFactor + 5),
      consecutiveCorrect,
      consecutiveWrong: 0,
      reviewCount: state.reviewCount + 1,
      nextReviewAt: addDays(now, intervalDays).toISOString(),
      status: "SCHEDULED",
    };
  }
}

export const defaultReviewScheduler: ReviewScheduler =
  new LeitnerReviewScheduler();

