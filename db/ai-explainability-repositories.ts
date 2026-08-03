import { desc, eq } from "drizzle-orm";
import { getDb } from ".";
import {
  aiGenerationRecords,
  aiSpecializedGenerationRecords,
  courses,
  questions,
  users,
} from "./schema";
import { DatabaseRetrievalProvider } from "./ai-repositories";
import {
  buildAIExplainabilityTrace,
  matchesAIExplainabilityTraceFilters,
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
  const retrieval = new DatabaseRetrievalProvider();
  const conceptCandidates = getSecurityCertificationRetrievalConceptAliases();
  const traces = await Promise.all(
    rawRecords.map(async (record) =>
      buildAIExplainabilityTrace(
        {
          ...record,
          contexts: await retrieval.getContextByIds(record.sourceContextIds),
        },
        conceptCandidates,
      ),
    ),
  );
  return {
    traces,
    summary: summarizeAITraceMetrics(traces),
  };
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
