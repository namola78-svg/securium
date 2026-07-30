export type RecommendationCandidate = {
  id: string;
  kind: "REVIEW" | "QUESTION" | "LEVEL" | "SUBJECT" | "MOCK_EXAM" | "LESSON";
  title: string;
  reason: string;
  priority:
    | "OVERDUE_REVIEW"
    | "REPEATED_WRONG"
    | "EXAM_WRONG"
    | "LOW_ACCURACY"
    | "CURRICULUM_LESSON"
    | "CURRICULUM_QUESTION"
    | "INCOMPLETE_LEVEL"
    | "STALE_SUBJECT"
    | "UNSEEN_QUESTION";
  estimatedMinutes: number;
  href: string;
};

const priorityScore: Record<RecommendationCandidate["priority"], number> = {
  OVERDUE_REVIEW: 700,
  REPEATED_WRONG: 600,
  EXAM_WRONG: 500,
  LOW_ACCURACY: 400,
  CURRICULUM_LESSON: 350,
  CURRICULUM_QUESTION: 325,
  INCOMPLETE_LEVEL: 300,
  STALE_SUBJECT: 200,
  UNSEEN_QUESTION: 100,
};

export interface RecommendationService {
  recommend(
    candidates: RecommendationCandidate[],
    limit?: number,
  ): RecommendationCandidate[];
}

export class RuleBasedRecommendationService
  implements RecommendationService
{
  recommend(candidates: RecommendationCandidate[], limit = 8) {
    return [...candidates]
      .sort(
        (left, right) =>
          priorityScore[right.priority] - priorityScore[left.priority],
      )
      .slice(0, limit);
  }
}

export const recommendationService: RecommendationService =
  new RuleBasedRecommendationService();
