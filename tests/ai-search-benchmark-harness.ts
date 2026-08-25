import { createHash } from "node:crypto";
import type { McpACore, McpAResult } from "../lib/mcp/mcpa-core.ts";
import { BENCHMARK_FIXTURE_ID, benchmarkFixtureData } from "./ai-search-benchmark.fixture.ts";

export const FAILURE_CODES = [
  "RELEVANCE_MISS",
  "RANKING_MISS",
  "UNSUPPORTED_RESULT",
  "HALLUCINATED_RELATION",
  "FAILED_TO_ABSTAIN",
  "OVER_ABSTENTION",
  "AMBIGUITY_FAILURE",
  "GOVERNANCE_LEAKAGE",
  "PRIVATE_DATA_LEAKAGE",
  "CONTEXT_BLOAT",
  "IDENTITY_ERROR",
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];
export type BenchmarkCase = {
  id: string;
  query: string;
  intent: string;
  authorityStatus: string[];
  currentClassification: string;
  currentExpectedBehavior: string;
  futureExpectedBehavior: string;
  allowedDomains: string[];
  forbiddenDomains: string[];
  expectedStableKeys: string[];
  relevanceRubric: { grades: Record<string, string>; minimumTopK: number | null; acceptableRecall: number | null };
  abstentionExpected: { mode: string; success: string };
  ambiguityExpected: boolean;
  privateDataBoundary: string;
  governanceBoundary: string;
};

export type NormalizedResult = {
  stableKey: string;
  domain: string;
  rank: number;
  title: string;
  sourceOperation: "search_learning_content" | "get_question";
  publicationStatus: "PUBLISHED";
  sourceAuthority: "published canonical database";
};

export type CaseMetrics = {
  resultCount: number;
  duplicateStableKeyCount: number;
  serializedResultBytes: number;
  irrelevantResultRatio: number | "N/A";
  supportRatio: number | "N/A";
};

export type CaseResult = {
  id: string;
  disposition: "PASS" | "PASS_UNJUDGED" | "NOT_CURRENTLY_EXECUTABLE" | "HARD_FAIL" | "QUALITY_GAP";
  failureCodes: FailureCode[];
  normalizedResults: NormalizedResult[];
  metrics: CaseMetrics;
};

export const FAST_GATE_CASE_IDS = [
  "Q001", "Q031", "Q034", "Q039", "Q040", "Q076",
  "Q077", "Q078", "Q079", "Q094", "Q095", "Q096",
] as const;

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function fixtureIdentity(): string {
  const digest = createHash("sha256").update(canonicalJson(benchmarkFixtureData)).digest("hex");
  return BENCHMARK_FIXTURE_ID + ":" + digest;
}

export function normalizeResults(
  results: readonly McpAResult[],
  sourceOperation: NormalizedResult["sourceOperation"] = "search_learning_content",
): NormalizedResult[] {
  const seen = new Set<string>();
  return results.flatMap((result, index) => {
    if (seen.has(result.stableKey)) return [];
    seen.add(result.stableKey);
    return [{
      stableKey: result.stableKey,
      domain: result.entityType,
      rank: index + 1,
      title: result.title,
      sourceOperation,
      publicationStatus: result.publicationStatus,
      sourceAuthority: result.sourceAuthority,
    }];
  });
}

function serializedSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function forbiddenFailure(results: readonly NormalizedResult[]): FailureCode | null {
  const text = JSON.stringify(results);
  if (/attempt|wrong|analytics|settings|user_skill_state|progress|learner|private/i.test(text)) return "PRIVATE_DATA_LEAKAGE";
  if (/draft|unpublished|deleted|MUST_EXCLUDE|developer-secure-coding-8h/i.test(text)) return "GOVERNANCE_LEAKAGE";
  if (/concept|role|skill|competency|certification|secure coding/i.test(text)) return "HALLUCINATED_RELATION";
  return null;
}

export function scoreRelevance(grades: readonly number[]) {
  if (grades.length === 0) return { precisionAtK: "N/A", recallAtK: "N/A", ndcgAtK: "N/A" };
  const relevant = grades.filter((grade) => grade >= 2).length;
  const dcg = grades.reduce((sum, grade, index) => sum + Math.max(grade, 0) / Math.log2(index + 2), 0);
  return { precisionAtK: relevant / grades.length, recallAtK: "N/A", ndcgAtK: dcg === 0 ? 0 : dcg / grades.length };
}

export function scoreCase(testCase: BenchmarkCase, results: readonly NormalizedResult[]): CaseResult {
  const normalized = [...results];
  const metrics: CaseMetrics = {
    resultCount: normalized.length,
    duplicateStableKeyCount: results.length - normalized.length,
    serializedResultBytes: serializedSize(normalized),
    irrelevantResultRatio: "N/A",
    supportRatio: testCase.expectedStableKeys.length === 0 ? "N/A" :
      testCase.expectedStableKeys.filter((key) => normalized.some((item) => item.stableKey === key)).length /
      testCase.expectedStableKeys.length,
  };
  if (testCase.currentClassification === "FUTURE_ONLY") {
    const valid = testCase.authorityStatus.some((status) => ["FUTURE", "DESIGN_ONLY", "BLOCKED_BY_CP_A", "BLOCKED_BY_CS1A"].includes(status));
    return { id: testCase.id, disposition: valid ? "NOT_CURRENTLY_EXECUTABLE" : "HARD_FAIL", failureCodes: valid ? [] : ["UNSUPPORTED_RESULT"], normalizedResults: [], metrics };
  }
  const failure = forbiddenFailure(normalized);
  if (failure) return { id: testCase.id, disposition: "HARD_FAIL", failureCodes: [failure], normalizedResults: normalized, metrics };
  if (testCase.expectedStableKeys.some((key) => !normalized.some((item) => item.stableKey === key))) {
    return { id: testCase.id, disposition: "HARD_FAIL", failureCodes: ["IDENTITY_ERROR"], normalizedResults: normalized, metrics };
  }
  if (testCase.abstentionExpected.mode === "MUST_ABSTAIN_OR_SAFE_BOUNDARY") {
    const abstained = normalized.length === 0;
    return { id: testCase.id, disposition: abstained ? "PASS" : "QUALITY_GAP", failureCodes: abstained ? [] : ["FAILED_TO_ABSTAIN"], normalizedResults: normalized, metrics };
  }
  if (testCase.ambiguityExpected && normalized.length > 1) {
    return { id: testCase.id, disposition: "PASS", failureCodes: [], normalizedResults: normalized, metrics };
  }
  return { id: testCase.id, disposition: testCase.expectedStableKeys.length > 0 ? "PASS" : "PASS_UNJUDGED", failureCodes: [], normalizedResults: normalized, metrics };
}

export async function executeCase(core: McpACore, testCase: BenchmarkCase): Promise<CaseResult> {
  if (testCase.currentClassification === "FUTURE_ONLY") return scoreCase(testCase, []);
  if (testCase.expectedStableKeys.length === 1) {
    const result = await core.getQuestion(testCase.expectedStableKeys[0], "DETAIL");
    return scoreCase(testCase, normalizeResults([result], "get_question"));
  }
  const response = await core.search({ text: testCase.query, detail: "SUMMARY", limit: 50 });
  return scoreCase(testCase, normalizeResults(response.results));
}

export async function runBenchmark(
  cases: readonly BenchmarkCase[],
  core: McpACore,
  metadata: Readonly<{ mainSha: string; benchmarkVersion: string }>,
) {
  const results: CaseResult[] = [];
  for (const testCase of cases) results.push(await executeCase(core, testCase));
  const current = results.filter((result) => result.disposition !== "NOT_CURRENTLY_EXECUTABLE");
  const future = results.filter((result) => result.disposition === "NOT_CURRENTLY_EXECUTABLE");
  const hardFailures = results.flatMap((result) => result.failureCodes);
  const qualityGaps = results.filter((result) => result.disposition === "QUALITY_GAP");
  const summary = {
    ...metadata,
    fixtureIdentity: fixtureIdentity(),
    caseCount: cases.length,
    currentExecutedCount: current.length,
    futureContractCount: future.length,
    hardGateFailureCount: hardFailures.length,
    qualityGapCount: qualityGaps.length,
    metrics: {
      precisionAtK: "N/A",
      recallAtK: "N/A",
      mrr: "N/A",
      ndcgAtK: "N/A",
      hitRateAtK: "N/A",
      resultCount: results.reduce((sum, result) => sum + result.metrics.resultCount, 0),
      duplicateStableKeyCount: results.reduce((sum, result) => sum + result.metrics.duplicateStableKeyCount, 0),
      serializedResultBytes: results.reduce((sum, result) => sum + result.metrics.serializedResultBytes, 0),
    },
  };
  return {
    summary,
    results,
    benchmarkImplementationHash: createHash("sha256").update(canonicalJson({ summary, results })).digest("hex"),
  };
}
