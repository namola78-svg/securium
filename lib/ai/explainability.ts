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
