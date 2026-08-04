import assert from "node:assert/strict";
import test from "node:test";
import { createAIProvider } from "../lib/ai/provider-factory.ts";
import { OpenAIProvider } from "../lib/ai/openai-provider.ts";
import {
  assertDailyAILimit,
  maskSensitiveText,
  readLimitedAIJson,
} from "../lib/ai/safety.ts";
import {
  AI_DISCLAIMER,
  INSUFFICIENT_CONTEXT_MESSAGE,
  type QuestionExplanationInput,
} from "../lib/ai/types.ts";
import {
  describeRetrievalQueryExpansion,
  expandRetrievalQueriesWithConceptAliases,
} from "../lib/ai/retrieval-provider.ts";
import {
  buildAIExplainabilityTrace,
  matchesAIExplainabilityTraceFilters,
  summarizeAITraceFeedback,
  summarizeAITraceMetrics,
} from "../lib/ai/explainability.ts";
import { aiExplainabilityFeedbackSchema } from "../lib/validation.ts";

function explanationInput(
  contexts: QuestionExplanationInput["contexts"] = [
    {
      id: "LESSON:lesson-1",
      kind: "LESSON",
      title: "검수된 개발용 레슨",
      excerpt: "검수된 근거 본문",
      courseId: "course-1",
      topicId: "topic-1",
      version: "1",
      reviewedAt: "2026-07-27",
    },
  ],
): QuestionExplanationInput {
  return {
    requestId: "request-1",
    question: {
      id: "question-1",
      title: "개발용 질문",
      content: "검수 근거에 맞는 답은?",
      type: "SINGLE_CHOICE",
      explanation: "기존 관리자 검수 해설",
      wrongAnswerExplanation: "기존 관리자 오답 해설",
      choices: [
        {
          id: "choice-1",
          content: "정답",
          isCorrect: true,
          explanation: "검수된 선택지 해설",
        },
        {
          id: "choice-2",
          content: "오답",
          isCorrect: false,
          explanation: "검수된 오답 선택지 해설",
        },
      ],
    },
    contexts,
    similarQuestions: [],
  };
}

test("API Key가 없으면 OpenAI 외부 호출 없이 Mock provider를 선택한다", async () => {
  let calls = 0;
  const provider = createAIProvider({
    provider: "openai",
    apiKey: "",
    fetchImplementation: async () => {
      calls += 1;
      return new Response();
    },
  });

  const result = await provider.explainQuestion(explanationInput());
  assert.equal(calls, 0);
  assert.equal(result.provider, "mock");
  assert.equal(result.model, "mock-ai-v1");
  assert.equal(result.errorCode, "MISSING_API_KEY");
  assert.equal(result.disclaimer, AI_DISCLAIMER);
});

test("Provider Factory는 명시적 Mock과 OpenAI 구현체를 중앙 선택한다", () => {
  const mock = createAIProvider({ provider: "mock" });
  const openai = createAIProvider({
    provider: "openai",
    apiKey: "test-key-not-used",
  });
  assert.equal(mock.constructor.name, "MockAIProvider");
  assert.equal(openai.constructor.name, "OpenAIProvider");
});

test("검수 근거가 없으면 insufficient_context로 표시한다", async () => {
  const result = await createAIProvider({ provider: "mock" }).explainQuestion(
    explanationInput([]),
  );
  assert.equal(result.status, "insufficient_context");
  assert.equal(result.content.intent, INSUFFICIENT_CONTEXT_MESSAGE);
});

test("Mock AI는 기존 관리자 검수 해설을 변경하지 않는다", async () => {
  const input = explanationInput();
  const reviewedExplanation = input.question.explanation;
  const result = await createAIProvider({ provider: "mock" }).explainQuestion(
    input,
  );
  assert.equal(input.question.explanation, reviewedExplanation);
  assert.equal(result.content.correctReason, reviewedExplanation);
  assert.match(result.content.intent, /^Mock AI:/);
  assert.equal(result.reviewed, false);
});

test("일일 호출 한도를 넘으면 요청을 차단한다", () => {
  assert.doesNotThrow(() => assertDailyAILimit(19, 20));
  assert.throws(
    () => assertDailyAILimit(20, 20),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "AI_DAILY_LIMIT_REACHED",
  );
});

test("AI 요청 본문 길이를 제한한다", async () => {
  const request = new Request("https://app.local/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(5000) }),
  });
  await assert.rejects(
    readLimitedAIJson(request),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "AI_REQUEST_TOO_LARGE",
  );
});

test("OpenAI 호출 시간이 초과되면 제한된 실패 응답을 반환한다", async () => {
  const provider = new OpenAIProvider({
    apiKey: "test-key-not-used",
    model: "test-model",
    timeoutMs: 10,
    maxRetries: 0,
    fetchImplementation: ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      })) as typeof fetch,
  });

  const result = await provider.explainQuestion(explanationInput());
  assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "OPENAI_TIMEOUT");
});

test("민감정보를 provider 전달 전에 마스킹한다", () => {
  const masked = maskSensitiveText(
    "email=user@example.com 주민번호 900101-1234567 api_key=secret-value token=abc123",
  );
  assert.doesNotMatch(masked, /user@example\.com/);
  assert.doesNotMatch(masked, /900101-1234567/);
  assert.doesNotMatch(masked, /secret-value/);
  assert.match(masked, /\[REDACTED/);
});

test("서술형 AI 보조채점은 기존 공식 점수를 변경하지 않는다", async () => {
  const officialResult = { score: 73, reviewedBy: "admin-1" };
  const provider = createAIProvider({ provider: "mock" });
  const result = await provider.gradeWrittenAnswer({
    requestId: "written-review-1",
    sourceContextIds: ["QUESTION:essay-1"],
    context: {
      referenceScore: 70,
      maximumScore: 100,
      includedKeywords: ["자산", "위협"],
      missingKeywords: ["취약점"],
      modelAnswer: "자산·위협·취약점을 연결한다.",
      evidence: [
        {
          id: "QUESTION:essay-1",
          title: "개발용 서술형",
          kind: "QUESTION_EXPLANATION",
        },
      ],
    },
  });
  assert.deepEqual(officialResult, { score: 73, reviewedBy: "admin-1" });
  assert.equal(result.content.advisoryOnly, true);
  assert.deepEqual(result.content.includedKeywords, ["자산", "위협"]);
  assert.deepEqual(result.content.missingKeywords, ["취약점"]);
});

test("보안약점 AI 설명은 코드를 실행하지 않는다", async () => {
  const result = await createAIProvider({ provider: "mock" }).explainSecureCode({
    requestId: "secure-code-1",
    sourceContextIds: ["SECURE_WEAKNESS:sample-1"],
    context: {
      weaknessName: "SQL 삽입",
      cweCode: "CWE-89",
      vulnerableLines: [2],
      secureCode: "query(parameter)",
      evidence: [],
    },
  });
  assert.equal(result.content.codeExecuted, false);
  assert.equal(result.content.weaknessClassification, "SQL 삽입");
});

test("RetrievalProvider query expansion adds course-scoped concept aliases", () => {
  const expanded = expandRetrievalQueriesWithConceptAliases(
    { query: "access control", courseId: "course-ise", limit: 8 },
    [
      {
        label: "access control",
        aliases: ["Access Control", "RBAC", "permission management"],
        courseIds: ["course-ise"],
      },
      {
        label: "privacy impact assessment",
        aliases: ["PIA"],
        courseIds: ["course-pia"],
      },
    ],
  );

  assert.deepEqual(expanded, [
    "access control",
    "RBAC",
    "permission management",
  ]);
});

test("RetrievalProvider query expansion diagnostics explain matched aliases", () => {
  const candidates = [
    {
      label: "access control",
      aliases: ["Access Control", "ACL", "RBAC", "authorization"],
      courseIds: ["course-ise"],
    },
    {
      label: "privacy impact assessment",
      aliases: ["PIA"],
      courseIds: ["course-pia"],
    },
  ];
  const diagnostics = describeRetrievalQueryExpansion(
    { query: "RBAC", courseId: "course-ise", limit: 8 },
    candidates,
  );

  assert.deepEqual(diagnostics.expandedQueries, [
    "RBAC",
    "access control",
    "Access Control",
    "ACL",
    "authorization",
  ]);
  assert.deepEqual(diagnostics.addedQueries, [
    "access control",
    "Access Control",
    "ACL",
    "authorization",
  ]);
  assert.deepEqual(diagnostics.matchedConceptLabels, ["access control"]);
  assert.equal(diagnostics.candidateCount, 2);
  assert.equal(diagnostics.scopedCandidateCount, 1);
});

test("AI explainability trace exposes concepts, citations, metrics and prompt fingerprint", () => {
  const trace = buildAIExplainabilityTrace(
    {
      id: "ai-record-1",
      requestId: "request-1",
      source: "QUESTION_EXPLANATION",
      courseId: "course-ise",
      courseName: "정보보안기사",
      userEmail: "learner@example.invalid",
      targetType: "QUESTION",
      targetId: "question-1",
      query: "RBAC",
      provider: "mock",
      model: "mock-ai-v1",
      generationStatus: "generated",
      generatedAt: "2026-08-04T00:00:00.000Z",
      sourceContextIds: ["LESSON:lesson-1"],
      contexts: [
        {
          id: "LESSON:lesson-1",
          kind: "LESSON",
          title: "접근통제 개요",
          excerpt: "역할 기반 접근통제 설명",
          courseId: "course-ise",
          topicId: null,
          version: "1",
          reviewedAt: "2026-08-04T00:00:00.000Z",
        },
      ],
      result: { intent: "접근통제 이해" },
      promptFingerprint: "sha256:prompt",
      inputTokens: 10,
      outputTokens: 20,
      estimatedCostMicros: 30,
      latencyMs: 40,
      disclaimer: "AI generated reference.",
    },
    [
      {
        label: "접근통제",
        aliases: ["RBAC", "Access Control"],
        courseIds: ["course-ise"],
      },
    ],
  );

  assert.deepEqual(trace.detectedConcepts, ["접근통제"]);
  assert.ok(trace.aliasExpansion.expandedQueries.includes("Access Control"));
  assert.equal(trace.citations[0]?.title, "접근통제 개요");
  assert.equal(trace.metrics.totalTokens, 30);
  assert.equal(trace.metrics.estimatedCostMicros, 30);
  assert.equal(trace.promptViewer.fullPromptStored, false);
  assert.equal(trace.promptViewer.fingerprint, "sha256:prompt");
});

test("AI explainability metric summary handles empty and populated traces", () => {
  assert.deepEqual(summarizeAITraceMetrics([]), {
    count: 0,
    totalTokens: 0,
    totalCostMicros: 0,
    averageLatencyMs: 0,
  });

  const makeTrace = (latencyMs: number, inputTokens: number, outputTokens: number) =>
    buildAIExplainabilityTrace(
      {
        id: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        source: "SPECIALIZED_REVIEW",
        courseId: "course-ise",
        courseName: "정보보안기사",
        userEmail: "learner@example.invalid",
        targetType: "SECURE_CODE",
        targetId: "sample-1",
        query: "SQL Injection",
        provider: "mock",
        model: "mock-ai-v1",
        generationStatus: "generated",
        generatedAt: "2026-08-04T00:00:00.000Z",
        sourceContextIds: [],
        contexts: [],
        result: {},
        promptFingerprint: "sha256:test",
        inputTokens,
        outputTokens,
        estimatedCostMicros: inputTokens + outputTokens,
        latencyMs,
        disclaimer: "AI generated reference.",
      },
      [],
    );

  assert.deepEqual(summarizeAITraceMetrics([
    makeTrace(100, 5, 7),
    makeTrace(200, 11, 17),
  ]), {
    count: 2,
    totalTokens: 40,
    totalCostMicros: 40,
    averageLatencyMs: 150,
  });
});

test("AI explainability trace filters support source, course, provider, status and request id", () => {
  const trace = buildAIExplainabilityTrace(
    {
      id: "ai-record-1",
      requestId: "request-filter-1",
      source: "SPECIALIZED_REVIEW",
      courseId: "course-ise",
      courseName: "정보보안기사",
      userEmail: "learner@example.invalid",
      targetType: "SECURE_CODE",
      targetId: "sample-1",
      query: "DDoS",
      provider: "mock",
      model: "mock-ai-v1",
      generationStatus: "generated",
      reviewStatus: "PENDING",
      generatedAt: "2026-08-04T00:00:00.000Z",
      sourceContextIds: [],
      contexts: [],
      result: {},
      promptFingerprint: "sha256:filter",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostMicros: 0,
      latencyMs: 0,
      disclaimer: "AI generated reference.",
    },
    [],
  );

  assert.equal(
    matchesAIExplainabilityTraceFilters(trace, {
      source: "SPECIALIZED_REVIEW",
      courseId: "course-ise",
      provider: "mock",
      status: "PENDING",
      requestId: "filter",
    }),
    true,
  );
  assert.equal(
    matchesAIExplainabilityTraceFilters(trace, {
      source: "QUESTION_EXPLANATION",
    }),
    false,
  );
});

test("AI explainability feedback validation accepts bounded admin review metadata", () => {
  const valid = aiExplainabilityFeedbackSchema.parse({
    traceId: "ai-record-1",
    traceSource: "QUESTION_EXPLANATION",
    rating: "NEEDS_REVIEW",
    issueType: "MISSING_CITATION",
    note: "Need stronger citation coverage.",
  });

  assert.equal(valid.traceId, "ai-record-1");
  assert.equal(valid.rating, "NEEDS_REVIEW");
  assert.throws(() =>
    aiExplainabilityFeedbackSchema.parse({
      traceId: "ai-record-1",
      traceSource: "QUESTION_EXPLANATION",
      rating: "OFFICIAL_SCORE_CHANGE",
      issueType: "NONE",
      note: "",
    }),
  );
  assert.throws(() =>
    aiExplainabilityFeedbackSchema.parse({
      traceId: "ai-record-1",
      traceSource: "SPECIALIZED_REVIEW",
      rating: "HELPFUL",
      issueType: "NONE",
      note: "x".repeat(2001),
    }),
  );
});

test("AI explainability feedback summary supports review filters", () => {
  const summary = summarizeAITraceFeedback([
    {
      rating: "HELPFUL",
      issueType: "NONE",
      createdAt: "2026-08-04T00:00:00.000Z",
    },
    {
      rating: "NEEDS_REVIEW",
      issueType: "MISSING_CITATION",
      createdAt: "2026-08-04T01:00:00.000Z",
    },
  ]);
  const trace = {
    ...buildAIExplainabilityTrace(
      {
        id: "ai-record-1",
        requestId: "request-feedback-1",
        source: "QUESTION_EXPLANATION",
        courseId: "course-ise",
        courseName: "Information Security Engineer",
        userEmail: "admin@example.invalid",
        targetType: "QUESTION",
        targetId: "question-1",
        query: "access control",
        provider: "mock",
        model: "mock-ai-v1",
        generationStatus: "generated",
        generatedAt: "2026-08-04T01:00:00.000Z",
        sourceContextIds: [],
        contexts: [],
        result: {},
        promptFingerprint: "sha256:feedback",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostMicros: 0,
        latencyMs: 0,
        disclaimer: "AI generated reference.",
      },
      [],
    ),
    feedbackSummary: summary,
  };

  assert.equal(summary.total, 2);
  assert.equal(summary.needsReview, 1);
  assert.equal(summary.latestRating, "NEEDS_REVIEW");
  assert.equal(summary.issueCounts.MISSING_CITATION, 1);
  assert.equal(
    matchesAIExplainabilityTraceFilters(trace, {
      feedbackRating: "NEEDS_REVIEW",
      feedbackIssueType: "MISSING_CITATION",
    }),
    true,
  );
  assert.equal(
    matchesAIExplainabilityTraceFilters(trace, {
      feedbackRating: "NOT_HELPFUL",
    }),
    false,
  );
});
