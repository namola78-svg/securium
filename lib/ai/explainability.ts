import {
  describeRetrievalQueryExpansion,
  type ConceptAwareRetrievalCandidate,
  type RetrievalQueryExpansionDiagnostics,
} from "./retrieval-provider.ts";
import type { RetrievalContext } from "./types.ts";

export type AIExplainabilityTraceSource =
  | "QUESTION_EXPLANATION"
  | "SPECIALIZED_REVIEW";

export type AIExplainabilityRecordInput = {
  id: string;
  requestId: string;
  source: AIExplainabilityTraceSource;
  courseId: string;
  courseName: string;
  userEmail: string;
  targetType: string;
  targetId: string;
  query: string;
  provider: string;
  model: string;
  generationStatus: string;
  reviewStatus?: string;
  generatedAt: string;
  sourceContextIds: string[];
  contexts: RetrievalContext[];
  result: Record<string, unknown>;
  promptFingerprint: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
  latencyMs: number;
  disclaimer: string;
  errorCode?: string | null;
};

export type AIExplainabilityTrace = AIExplainabilityRecordInput & {
  detectedConcepts: string[];
  aliasExpansion: RetrievalQueryExpansionDiagnostics;
  citations: Array<{
    id: string;
    title: string;
    kind: RetrievalContext["kind"];
    reviewedAt: string | null;
  }>;
  metrics: {
    totalTokens: number;
    latencyMs: number;
    estimatedCostMicros: number;
  };
  promptViewer: {
    fingerprint: string;
    fullPromptStored: false;
    note: string;
  };
  feedbackSummary: AIExplainabilityFeedbackSummary;
};

export type AIExplainabilityTraceFilters = {
  source?: AIExplainabilityTraceSource;
  courseId?: string;
  provider?: string;
  status?: string;
  requestId?: string;
  feedbackRating?: string;
  feedbackIssueType?: string;
};

export type AIExplainabilityFeedbackRecord = {
  rating: string;
  issueType: string;
  createdAt: string;
};

export type AIExplainabilityFeedbackSummary = {
  total: number;
  helpful: number;
  notHelpful: number;
  needsReview: number;
  issueCounts: Record<string, number>;
  latestAt: string | null;
  latestRating: string | null;
  latestIssueType: string | null;
};

export function buildAIExplainabilityTrace(
  input: AIExplainabilityRecordInput,
  conceptCandidates: readonly ConceptAwareRetrievalCandidate[],
): AIExplainabilityTrace {
  const aliasExpansion = describeRetrievalQueryExpansion(
    {
      query: input.query,
      courseId: input.courseId,
      limit: 8,
    },
    conceptCandidates,
  );
  const citations = input.contexts.map((context) => ({
    id: context.id,
    title: context.title,
    kind: context.kind,
    reviewedAt: context.reviewedAt,
  }));

  return {
    ...input,
    detectedConcepts: aliasExpansion.matchedConceptLabels,
    aliasExpansion,
    citations,
    metrics: {
      totalTokens: Math.max(0, input.inputTokens) + Math.max(0, input.outputTokens),
      latencyMs: Math.max(0, input.latencyMs),
      estimatedCostMicros: Math.max(0, input.estimatedCostMicros),
    },
    promptViewer: {
      fingerprint: input.promptFingerprint,
      fullPromptStored: false,
      note:
        "Full prompts and raw answers are not stored in AI traces. The console shows a fingerprint and sanitized retrieval context only.",
    },
    feedbackSummary: summarizeAITraceFeedback([]),
  };
}

export function summarizeAITraceMetrics(
  traces: readonly AIExplainabilityTrace[],
) {
  return traces.reduce(
    (summary, trace) => ({
      count: summary.count + 1,
      totalTokens: summary.totalTokens + trace.metrics.totalTokens,
      totalCostMicros:
        summary.totalCostMicros + trace.metrics.estimatedCostMicros,
      averageLatencyMs:
        summary.count + 1 > 0
          ? Math.round(
              (summary.averageLatencyMs * summary.count +
                trace.metrics.latencyMs) /
                (summary.count + 1),
            )
          : 0,
    }),
    {
      count: 0,
      totalTokens: 0,
      totalCostMicros: 0,
      averageLatencyMs: 0,
    },
  );
}

export function matchesAIExplainabilityTraceFilters(
  trace: AIExplainabilityTrace,
  filters: AIExplainabilityTraceFilters,
) {
  const requestId = filters.requestId?.trim().toLowerCase();
  return (
    (!filters.source || trace.source === filters.source) &&
    (!filters.courseId || trace.courseId === filters.courseId) &&
    (!filters.provider || trace.provider === filters.provider) &&
    (!filters.status ||
      trace.generationStatus === filters.status ||
      trace.reviewStatus === filters.status) &&
    (!requestId || trace.requestId.toLowerCase().includes(requestId)) &&
    (!filters.feedbackRating ||
      feedbackSummaryHasRating(trace.feedbackSummary, filters.feedbackRating)) &&
    (!filters.feedbackIssueType ||
      (trace.feedbackSummary.issueCounts[filters.feedbackIssueType] ?? 0) > 0)
  );
}

export function summarizeAITraceFeedback(
  records: readonly AIExplainabilityFeedbackRecord[],
): AIExplainabilityFeedbackSummary {
  const sorted = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const initial: AIExplainabilityFeedbackSummary = {
    total: 0,
    helpful: 0,
    notHelpful: 0,
    needsReview: 0,
    issueCounts: {},
    latestAt: null,
    latestRating: null,
    latestIssueType: null,
  };
  return sorted.reduce<AIExplainabilityFeedbackSummary>(
    (summary, record) => {
      summary.total += 1;
      if (record.rating === "HELPFUL") summary.helpful += 1;
      if (record.rating === "NOT_HELPFUL") summary.notHelpful += 1;
      if (record.rating === "NEEDS_REVIEW") summary.needsReview += 1;
      summary.issueCounts[record.issueType] =
        (summary.issueCounts[record.issueType] ?? 0) + 1;
      if (!summary.latestAt) {
        summary.latestAt = record.createdAt;
        summary.latestRating = record.rating;
        summary.latestIssueType = record.issueType;
      }
      return summary;
    },
    initial,
  );
}

function feedbackSummaryHasRating(
  summary: AIExplainabilityFeedbackSummary,
  rating: string,
) {
  if (rating === "HELPFUL") return summary.helpful > 0;
  if (rating === "NOT_HELPFUL") return summary.notHelpful > 0;
  if (rating === "NEEDS_REVIEW") return summary.needsReview > 0;
  return false;
}
