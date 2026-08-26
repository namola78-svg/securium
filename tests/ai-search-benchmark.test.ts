import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createBenchmarkMcpACore } from "./ai-search-benchmark.fixture.ts";
import {
  FAST_GATE_CASE_IDS,
  FAILURE_CODES,
  HASH_CONTRACT_REVISION,
  LEGACY_HASH_CONTRACT_REVISION,
  classificationAuthorityIdentity,
  computeExecutionIdentityHash,
  computeSemanticResultHash,
  fixtureIdentity,
  interpretHashContractRevision,
  normalizeResults,
  runBenchmark,
  scoreCase,
  scoreRelevance,
  type BenchmarkCase,
  type NormalizedResult,
} from "./ai-search-benchmark-harness.ts";

const corpus = JSON.parse(
  readFileSync(new URL("./ai-search-benchmark-corpus.json", import.meta.url), "utf8"),
) as { cases: BenchmarkCase[]; queryCount: number; uniqueQueryCount: number };

const cases = corpus.cases;
const byId = new Map(cases.map((testCase) => [testCase.id, testCase]));
const result = (stableKey: string, domain = "Course"): NormalizedResult => ({
  stableKey,
  domain,
  rank: 1,
  title: "Synthetic result",
  sourceOperation: "search_learning_content",
  publicationStatus: "PUBLISHED",
  sourceAuthority: "published canonical database",
});

test("corpus preserves 100 unique authority records and exact classification counts", () => {
  assert.equal(corpus.queryCount, 100);
  assert.equal(corpus.uniqueQueryCount, 100);
  assert.equal(new Set(cases.map((testCase) => testCase.id)).size, 100);
  assert.equal(new Set(cases.map((testCase) => testCase.query)).size, 100);
  assert.equal(cases.filter((testCase) => testCase.currentClassification === "CURRENT_EXECUTABLE").length, 50);
  assert.equal(cases.filter((testCase) => testCase.currentClassification === "CURRENT_EXPECT_ABSTENTION").length, 3);
  assert.equal(cases.filter((testCase) => testCase.currentClassification === "FUTURE_ONLY").length, 21);
  assert.equal(cases.filter((testCase) => testCase.currentClassification === "BOUNDARY_TEST").length, 26);
});

test("fixture identity is deterministic and exposes only public canonical-style data", () => {
  assert.equal(fixtureIdentity(), fixtureIdentity());
  assert.match(fixtureIdentity(), /^MCPA_BENCHMARK_FIXTURE_V1:/);
});

test("normalization deduplicates stable identity and preserves first rank", () => {
  const normalized = normalizeResults([
    {
      ...result("course:one"),
      entityType: "Course",
      title: "First",
      summary: "First",
      navigationTarget: "/courses/one",
      traceability: { stableKey: "course:one", sourceAuthority: "published canonical database", revision: { value: "1" }, match: "LEXICAL" },
      revision: { value: "1" },
    },
    {
      ...result("course:one"),
      entityType: "Course",
      title: "Duplicate",
      summary: "Duplicate",
      navigationTarget: "/courses/one",
      traceability: { stableKey: "course:one", sourceAuthority: "published canonical database", revision: { value: "1" }, match: "LEXICAL" },
      revision: { value: "1" },
    },
  ]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].stableKey, "course:one");
  assert.equal(normalized[0].rank, 1);
});

test("exact identity requires the approved stable key", async () => {
  const core = createBenchmarkMcpACore();
  const output = await runBenchmark([byId.get("Q034")!], core, {
    mainSha: "test-main",
    benchmarkVersion: "AI_SEARCH_EVAL_V1",
  });
  assert.equal(output.results[0].disposition, "PASS");
  assert.equal(output.results[0].normalizedResults[0].stableKey, "question:q-1");
  const missing = scoreCase(
    { ...byId.get("Q034")!, expectedStableKeys: ["question:missing"] },
    [],
  );
  assert.deepEqual(missing.failureCodes, ["IDENTITY_ERROR"]);
});

test("membership accepts additional canonical results and does not require exact cardinality", () => {
  const testCase = { ...byId.get("Q001")!, expectedStableKeys: [] };
  const scored = scoreCase(testCase, [result("course:one"), result("lesson:one", "Lesson")]);
  assert.equal(scored.disposition, "PASS_UNJUDGED");
  assert.deepEqual(scored.failureCodes, []);
});

test("approved relevance rubric returns N/A without judged ground truth", () => {
  assert.deepEqual(scoreRelevance([]), { precisionAtK: "N/A", recallAtK: "N/A", ndcgAtK: "N/A" });
  assert.deepEqual(scoreRelevance([3, 2, 0]), { precisionAtK: 2 / 3, recallAtK: "N/A", ndcgAtK: (3 + 2 / Math.log2(3)) / 3 });
});

test("abstention and ambiguity permit safe empty or bounded results", () => {
  const abstention = scoreCase(byId.get("Q031")!, []);
  assert.equal(abstention.disposition, "PASS");
  const ambiguity = scoreCase(byId.get("Q035")!, [result("course:one"), result("lesson:one", "Lesson")]);
  assert.equal(ambiguity.disposition, "PASS");
  const failed = scoreCase(byId.get("Q031")!, [result("course:one")]);
  assert.equal(failed.disposition, "QUALITY_GAP");
  assert.deepEqual(failed.failureCodes, ["FAILED_TO_ABSTAIN"]);
});

test("future-only cases are contract-valid and never current quality failures", () => {
  const future = byId.get("Q019")!;
  const scored = scoreCase(future, [result("future:role")]);
  assert.equal(scored.disposition, "NOT_CURRENTLY_EXECUTABLE");
  assert.deepEqual(scored.failureCodes, []);
});

test("governance and private-data mutations are hard failures", () => {
  const privateResult = scoreCase(byId.get("Q095")!, [result("learner:attempt")]);
  assert.deepEqual(privateResult.failureCodes, ["PRIVATE_DATA_LEAKAGE"]);
  const draftResult = scoreCase(byId.get("Q078")!, [result("developer-secure-coding-8h")]);
  assert.deepEqual(draftResult.failureCodes, ["GOVERNANCE_LEAKAGE"]);
});

test("failure taxonomy and FAST_GATE ownership are stable", () => {
  assert.deepEqual(FAST_GATE_CASE_IDS.length, 12);
  assert.ok(FAST_GATE_CASE_IDS.every((id) => byId.has(id)));
  assert.deepEqual([...FAILURE_CODES].sort(), ["RELEVANCE_MISS", "RANKING_MISS", "UNSUPPORTED_RESULT", "HALLUCINATED_RELATION", "FAILED_TO_ABSTAIN", "OVER_ABSTENTION", "AMBIGUITY_FAILURE", "GOVERNANCE_LEAKAGE", "PRIVATE_DATA_LEAKAGE", "CONTEXT_BLOAT", "IDENTITY_ERROR"].sort());
});

test("FAST_GATE and FULL_BENCHMARK are deterministic against the same fixture", async () => {
  const coreA = createBenchmarkMcpACore();
  const coreB = createBenchmarkMcpACore();
  const runA = await runBenchmark(cases, coreA, { mainSha: "test-main", benchmarkVersion: "AI_SEARCH_EVAL_V1" });
  const runB = await runBenchmark(cases, coreB, { mainSha: "test-main", benchmarkVersion: "AI_SEARCH_EVAL_V1" });
  assert.equal(runA.summary.caseCount, 100);
  assert.equal(runA.summary.futureContractCount, 21);
  assert.equal(runA.summary.currentExecutedCount, 79);
  assert.equal(runA.summary.hardGateFailureCount, 0);
  assert.equal(runA.benchmarkImplementationHash, runB.benchmarkImplementationHash);
  assert.equal(runA.semanticResultHash, runB.semanticResultHash);
  assert.equal(runA.hashContractRevision, HASH_CONTRACT_REVISION);
  assert.equal(runA.summary.hashContractRevision, HASH_CONTRACT_REVISION);
  assert.deepEqual(runA.semanticIdentity, {
    hashContractRevision: HASH_CONTRACT_REVISION,
    semanticResultHash: runA.semanticResultHash,
  });
  assert.deepEqual(runA.results, runB.results);
});

test("SEMANTIC_HASH_V2 output is versioned and legacy absence is deterministic", async () => {
  const run = await runBenchmark(cases, createBenchmarkMcpACore(), {
    mainSha: "sha-a",
    benchmarkVersion: "AI_SEARCH_EVAL_V1",
  });
  assert.equal(run.summary.hashContractRevision, HASH_CONTRACT_REVISION);
  assert.equal(run.hashContractRevision, HASH_CONTRACT_REVISION);
  assert.equal(run.benchmarkImplementationHash, run.semanticResultHash);
  assert.equal(interpretHashContractRevision(undefined), LEGACY_HASH_CONTRACT_REVISION);
  assert.equal(interpretHashContractRevision(null), LEGACY_HASH_CONTRACT_REVISION);
  assert.equal(interpretHashContractRevision(HASH_CONTRACT_REVISION), HASH_CONTRACT_REVISION);
});

test("hash-contract metadata namespaces identity without changing semantic payload", async () => {
  const run = await runBenchmark(cases, createBenchmarkMcpACore(), {
    mainSha: "sha-a",
    benchmarkVersion: "AI_SEARCH_EVAL_V1",
  });
  const metadataChangedSummary = {
    ...run.summary,
    hashContractRevision: LEGACY_HASH_CONTRACT_REVISION,
    classificationAuthorityIdentity: "different-authority",
  };
  assert.equal(
    computeSemanticResultHash(cases, metadataChangedSummary, run.results),
    run.semanticResultHash,
  );
  assert.notEqual(
    computeExecutionIdentityHash({ mainSha: "sha-a", benchmarkVersion: "AI_SEARCH_EVAL_V1" }, metadataChangedSummary, cases, run.semanticResultHash),
    run.executionIdentityHash,
  );
});

test("classification-authority identity is deterministic and corpus/expectation-bound", () => {
  assert.equal(classificationAuthorityIdentity(cases), classificationAuthorityIdentity(cases));
  const changed = cases.map((testCase, index) => index === 0 ? {
    ...testCase,
    currentClassification: "BOUNDARY_TEST",
  } : testCase);
  assert.notEqual(classificationAuthorityIdentity(cases), classificationAuthorityIdentity(changed));
});

test("semantic identity excludes mainSha while execution identity preserves provenance", async () => {
  const runA = await runBenchmark(cases, createBenchmarkMcpACore(), {
    mainSha: "sha-a",
    benchmarkVersion: "AI_SEARCH_EVAL_V1",
  });
  const runB = await runBenchmark(cases, createBenchmarkMcpACore(), {
    mainSha: "sha-b",
    benchmarkVersion: "AI_SEARCH_EVAL_V1",
  });
  assert.equal(runA.semanticResultHash, runB.semanticResultHash);
  assert.equal(runA.benchmarkImplementationHash, runB.benchmarkImplementationHash);
  assert.notEqual(runA.executionIdentityHash, runB.executionIdentityHash);
  assert.equal(runA.summary.mainSha, "sha-a");
  assert.equal(runB.summary.mainSha, "sha-b");
});

test("semantic identity remains sensitive to a real benchmark outcome change", async () => {
  const run = await runBenchmark(cases, createBenchmarkMcpACore(), {
    mainSha: "sha-a",
    benchmarkVersion: "AI_SEARCH_EVAL_V1",
  });
  const changedResults = run.results.map((item, index) => index === 0 ? {
    ...item,
    disposition: "QUALITY_GAP" as const,
  } : item);
  assert.notEqual(
    computeSemanticResultHash(cases, run.summary, changedResults),
    run.semanticResultHash,
  );
});
