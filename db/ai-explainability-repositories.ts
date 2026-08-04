import { desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from ".";
import {
  aiExplainabilityFeedback,
  aiGenerationRecords,
  aiSpecializedGenerationRecords,
  courses,
  questions,
  users,
} from "./schema";
import { DatabaseRetrievalProvider } from "./ai-repositories";
import { AppError } from "@/lib/errors";
import {
  buildAIExplainabilityTrace,
  matchesAIExplainabilityTraceFilters,
  summarizeAITraceFeedback,
  summarizeAITraceMetrics,
  type AIExplainabilityTrace,
  type AIExplainabilityTraceFilters,
  type AIExplainabilityTraceSource,
} from "@/lib/ai/explainability";
import { getSecurityCertificationRetrievalConceptAliases } from "@/lib/curriculum/security-certification-ontology";

export type AIExplainabilityTraceList = {
  traces: AIExplainabilityTrace[];
  summary: ReturnType<typeof summarizeAITraceMetrics>;
};

export type AIExplainabilityFeedbackRating =
  | "HELPFUL"
  | "NOT_HELPFUL"
  | "NEEDS_REVIEW";

export type AIExplainabilityFeedbackIssueType =
  | "NONE"
  | "LOW_QUALITY_CONTEXT"
  | "MISSING_CITATION"
  | "WRONG_CONCEPT"
  | "PROMPT_ISSUE"
  | "SENSITIVE_CONTENT_RISK"
  | "OTHER";

type RawTraceRecord = {
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
  result: Record<string, unknown>;
  promptFingerprint: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
  latencyMs: number;
  disclaimer: string;
  errorCode?: string | null;
};

export async function listAdminAIExplainabilityTraces(
  limit = 50,
  filters: AIExplainabilityTraceFilters = {},
): Promise<AIExplainabilityTraceList> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const fetchLimit = Math.max(safeLimit, Math.min(safeLimit * 3, 300));
  const [questionRows, specializedRows] = await Promise.all([
    getDb()
      .select({
        id: aiGenerationRecords.id,
        requestId: aiGenerationRecords.requestId,
        courseId: aiGenerationRecords.courseId,
        courseName: courses.shortName,
        userEmail: users.email,
        questionId: aiGenerationRecords.questionId,
        questionTitle: questions.title,
        provider: aiGenerationRecords.provider,
        model: aiGenerationRecords.model,
        generatedAt: aiGenerationRecords.generatedAt,
        sourceContextIdsJson: aiGenerationRecords.sourceContextIdsJson,
        disclaimer: aiGenerationRecords.disclaimer,
        latencyMs: aiGenerationRecords.latencyMs,
        status: aiGenerationRecords.status,
        resultJson: aiGenerationRecords.resultJson,
        errorCode: aiGenerationRecords.errorCode,
        promptFingerprint: aiGenerationRecords.promptFingerprint,
        inputTokens: aiGenerationRecords.inputTokens,
        outputTokens: aiGenerationRecords.outputTokens,
        estimatedCostMicros: aiGenerationRecords.estimatedCostMicros,
      })
      .from(aiGenerationRecords)
      .innerJoin(courses, eq(aiGenerationRecords.courseId, courses.id))
      .innerJoin(users, eq(aiGenerationRecords.userId, users.id))
      .innerJoin(questions, eq(aiGenerationRecords.questionId, questions.id))
      .orderBy(desc(aiGenerationRecords.generatedAt))
      .limit(fetchLimit),
    getDb()
      .select({
        id: aiSpecializedGenerationRecords.id,
        requestId: aiSpecializedGenerationRecords.requestId,
        courseId: aiSpecializedGenerationRecords.courseId,
        courseName: courses.shortName,
        userEmail: users.email,
        targetType: aiSpecializedGenerationRecords.targetType,
        targetId: aiSpecializedGenerationRecords.targetId,
        provider: aiSpecializedGenerationRecords.provider,
        model: aiSpecializedGenerationRecords.model,
        generatedAt: aiSpecializedGenerationRecords.generatedAt,
        sourceContextIdsJson:
          aiSpecializedGenerationRecords.sourceContextIdsJson,
        disclaimer: aiSpecializedGenerationRecords.disclaimer,
        latencyMs: aiSpecializedGenerationRecords.latencyMs,
        generationStatus: aiSpecializedGenerationRecords.generationStatus,
        reviewStatus: aiSpecializedGenerationRecords.reviewStatus,
        originalResultJson: aiSpecializedGenerationRecords.originalResultJson,
        errorCode: aiSpecializedGenerationRecords.errorCode,
        inputFingerprint: aiSpecializedGenerationRecords.inputFingerprint,
        inputTokens: aiSpecializedGenerationRecords.inputTokens,
        outputTokens: aiSpecializedGenerationRecords.outputTokens,
        estimatedCostMicros:
          aiSpecializedGenerationRecords.estimatedCostMicros,
      })
      .from(aiSpecializedGenerationRecords)
      .innerJoin(
        courses,
        eq(aiSpecializedGenerationRecords.courseId, courses.id),
      )
      .innerJoin(users, eq(aiSpecializedGenerationRecords.userId, users.id))
      .orderBy(desc(aiSpecializedGenerationRecords.generatedAt))
      .limit(fetchLimit),
  ]);
  const rawRecords: RawTraceRecord[] = [
    ...questionRows.map((row) => ({
      id: row.id,
      requestId: row.requestId,
      source: "QUESTION_EXPLANATION" as const,
      courseId: row.courseId,
      courseName: row.courseName,
      userEmail: row.userEmail,
      targetType: "QUESTION",
      targetId: row.questionId,
      query: row.questionTitle,
      provider: row.provider,
      model: row.model,
      generationStatus: row.status,
      generatedAt: row.generatedAt,
      sourceContextIds: parseJson<string[]>(row.sourceContextIdsJson, []),
      result: parseJson<Record<string, unknown>>(row.resultJson, {}),
      promptFingerprint: row.promptFingerprint,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      estimatedCostMicros: row.estimatedCostMicros,
      latencyMs: row.latencyMs,
      disclaimer: row.disclaimer,
      errorCode: row.errorCode,
    })),
    ...specializedRows.map((row) => ({
      id: row.id,
      requestId: row.requestId,
      source: "SPECIALIZED_REVIEW" as const,
      courseId: row.courseId,
      courseName: row.courseName,
      userEmail: row.userEmail,
      targetType: row.targetType,
      targetId: row.targetId,
      query: `${row.targetType} ${row.targetId}`,
      provider: row.provider,
      model: row.model,
      generationStatus: row.generationStatus,
      reviewStatus: row.reviewStatus,
      generatedAt: row.generatedAt,
      sourceContextIds: parseJson<string[]>(row.sourceContextIdsJson, []),
      result: parseJson<Record<string, unknown>>(row.originalResultJson, {}),
      promptFingerprint: row.inputFingerprint,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      estimatedCostMicros: row.estimatedCostMicros,
      latencyMs: row.latencyMs,
      disclaimer: row.disclaimer,
      errorCode: row.errorCode,
    })),
  ]
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .filter((record) => matchesRawTraceRecord(record, filters))
    .slice(0, safeLimit);
  const feedbackByTrace = await listFeedbackByRawTrace(rawRecords);
  const retrieval = new DatabaseRetrievalProvider();
  const conceptCandidates = getSecurityCertificationRetrievalConceptAliases();
  const traces = await Promise.all(
    rawRecords.map(async (record) => {
      const trace = buildAIExplainabilityTrace(
        {
          ...record,
          contexts: await retrieval.getContextByIds(record.sourceContextIds),
        },
        conceptCandidates,
      );
      return {
        ...trace,
        feedbackSummary:
          feedbackByTrace.get(traceKey(record.source, record.id)) ??
          summarizeAITraceFeedback([]),
      };
    }),
  );
  const filteredTraces = traces.filter((trace) =>
    matchesAIExplainabilityTraceFilters(trace, filters),
  );
  return {
    traces: filteredTraces,
    summary: summarizeAITraceMetrics(filteredTraces),
  };
}

async function listFeedbackByRawTrace(records: readonly RawTraceRecord[]) {
  const questionIds = records
    .filter((record) => record.source === "QUESTION_EXPLANATION")
    .map((record) => record.id);
  const specializedIds = records
    .filter((record) => record.source === "SPECIALIZED_REVIEW")
    .map((record) => record.id);
  const conditions = [
    questionIds.length
      ? inArray(aiExplainabilityFeedback.questionGenerationId, questionIds)
      : undefined,
    specializedIds.length
      ? inArray(aiExplainabilityFeedback.specializedGenerationId, specializedIds)
      : undefined,
  ].filter(Boolean);
  if (!conditions.length) {
    return new Map<string, ReturnType<typeof summarizeAITraceFeedback>>();
  }

  const rows = await getDb()
    .select({
      traceSource: aiExplainabilityFeedback.traceSource,
      questionGenerationId: aiExplainabilityFeedback.questionGenerationId,
      specializedGenerationId:
        aiExplainabilityFeedback.specializedGenerationId,
      rating: aiExplainabilityFeedback.rating,
      issueType: aiExplainabilityFeedback.issueType,
      createdAt: aiExplainabilityFeedback.createdAt,
    })
    .from(aiExplainabilityFeedback)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .orderBy(desc(aiExplainabilityFeedback.createdAt))
    .limit(Math.min(500, Math.max(50, records.length * 20)));

  const grouped = new Map<
    string,
    Array<{ rating: string; issueType: string; createdAt: string }>
  >();
  for (const row of rows) {
    const source = row.traceSource as AIExplainabilityTraceSource;
    const id =
      source === "QUESTION_EXPLANATION"
        ? row.questionGenerationId
        : row.specializedGenerationId;
    if (!id) continue;
    const key = traceKey(source, id);
    grouped.set(key, [
      ...(grouped.get(key) ?? []),
      {
        rating: row.rating,
        issueType: row.issueType,
        createdAt: row.createdAt,
      },
    ]);
  }

  return new Map(
    [...grouped.entries()].map(([key, feedback]) => [
      key,
      summarizeAITraceFeedback(feedback),
    ]),
  );
}

function traceKey(source: AIExplainabilityTraceSource, id: string) {
  return `${source}:${id}`;
}

export async function submitAdminAIExplainabilityFeedback(input: {
  reviewerId: string;
  traceId: string;
  traceSource: AIExplainabilityTraceSource;
  rating: AIExplainabilityFeedbackRating;
  issueType: AIExplainabilityFeedbackIssueType;
  note: string;
}) {
  if (input.traceSource === "QUESTION_EXPLANATION") {
    const [record] = await getDb()
      .select({ id: aiGenerationRecords.id })
      .from(aiGenerationRecords)
      .where(eq(aiGenerationRecords.id, input.traceId))
      .limit(1);
    if (!record) {
      throw new AppError(
        "AI trace를 찾을 수 없습니다.",
        404,
        "AI_TRACE_NOT_FOUND",
      );
    }
  } else {
    const [record] = await getDb()
      .select({ id: aiSpecializedGenerationRecords.id })
      .from(aiSpecializedGenerationRecords)
      .where(eq(aiSpecializedGenerationRecords.id, input.traceId))
      .limit(1);
    if (!record) {
      throw new AppError(
        "AI trace를 찾을 수 없습니다.",
        404,
        "AI_TRACE_NOT_FOUND",
      );
    }
  }

  const id = crypto.randomUUID();
  await getDb().insert(aiExplainabilityFeedback).values({
    id,
    traceSource: input.traceSource,
    questionGenerationId:
      input.traceSource === "QUESTION_EXPLANATION" ? input.traceId : null,
    specializedGenerationId:
      input.traceSource === "SPECIALIZED_REVIEW" ? input.traceId : null,
    reviewerId: input.reviewerId,
    rating: input.rating,
    issueType: input.issueType,
    note: input.note,
    metadataJson: JSON.stringify({
      surface: "admin-ai-explainability-console",
    }),
  });
  return { id };
}

function matchesRawTraceRecord(
  record: RawTraceRecord,
  filters: AIExplainabilityTraceFilters,
) {
  const traceLike = {
    ...record,
    contexts: [],
    detectedConcepts: [],
    aliasExpansion: {
      originalQuery: record.query,
      expandedQueries: [record.query],
      addedQueries: [],
      matchedConceptLabels: [],
      courseId: record.courseId,
      candidateCount: 0,
      scopedCandidateCount: 0,
    },
    citations: [],
    metrics: {
      totalTokens: record.inputTokens + record.outputTokens,
      latencyMs: record.latencyMs,
      estimatedCostMicros: record.estimatedCostMicros,
    },
    promptViewer: {
      fingerprint: record.promptFingerprint,
      fullPromptStored: false as const,
      note: "",
    },
    feedbackSummary: summarizeAITraceFeedback([]),
  };
  return matchesAIExplainabilityTraceFilters(traceLike, filters);
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
