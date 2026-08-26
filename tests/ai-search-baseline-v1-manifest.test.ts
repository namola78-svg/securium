import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createBenchmarkMcpACore } from "./ai-search-benchmark.fixture.ts";
import {
  HASH_CONTRACT_REVISION,
  classificationAuthorityIdentity,
  corpusIdentity,
  expectationIdentity,
  fixtureIdentity,
  runBenchmark,
  type BenchmarkCase,
  type BenchmarkRun,
} from "./ai-search-benchmark-harness.ts";

type BaselineManifest = {
  schemaVersion: string;
  baselineVersion: string;
  freezeStatus: "DRAFT" | "READY_FOR_HUMAN_FREEZE" | "FROZEN" | "SUPERSEDED";
  semantic: {
    benchmarkVersion: string;
    hashContractRevision: string;
    semanticResultHash: string;
    corpusIdentity: string;
    expectationIdentity: string;
    fixtureIdentity: string;
    classificationAuthorityIdentity: string;
    caseContract: { total: number; executed: number; contractOnly: number };
    acceptance: { hardGateCount: number; qualityGapCount: number };
  };
  provenance: {
    sourceGitSha: string;
    executionIdentityHash: string;
    technicalReview: { status: "PASS" | "FAIL"; evidenceRef: string; reviewedAt: string };
  };
  governance: {
    humanFreezeDecision: "NOT_RECORDED" | "APPROVED" | "REJECTED";
    humanDecision?: "APPROVE_BASELINE_V1_FOR_FREEZE_TRANSITION";
    humanDecisionHash?: string | null;
    freezeEvidenceRef: string | null;
    frozenAt: string | null;
  };
};

const manifestPath = new URL("../reports/ai-search/securium-ai-search-baseline-v1.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as BaselineManifest;
const corpus = JSON.parse(readFileSync(new URL("./ai-search-benchmark-corpus.json", import.meta.url), "utf8")) as {
  benchmarkVersion: string;
  cases: BenchmarkCase[];
};

function cloneManifest(): BaselineManifest {
  return structuredClone(manifest);
}

function assertDeclaredGovernanceState(candidate: BaselineManifest, run: BenchmarkRun): void {
  assert.deepEqual(validateManifest(candidate, run), []);
  if (candidate.freezeStatus === "DRAFT") {
    assert.equal(candidate.governance.humanFreezeDecision, "NOT_RECORDED");
    assert.equal(candidate.governance.humanDecision, undefined);
    assert.equal(candidate.governance.humanDecisionHash, undefined);
    assert.equal(candidate.governance.freezeEvidenceRef, null);
    assert.equal(candidate.governance.frozenAt, null);
    return;
  }
  if (candidate.freezeStatus === "FROZEN") {
    assert.equal(candidate.governance.humanFreezeDecision, "APPROVED");
    assert.equal(candidate.governance.humanDecision, "APPROVE_BASELINE_V1_FOR_FREEZE_TRANSITION");
    assert.match(candidate.governance.humanDecisionHash ?? "", /^[0-9a-f]{64}$/);
    assert.ok(candidate.governance.freezeEvidenceRef);
    assert.ok(candidate.governance.frozenAt);
    return;
  }
  assert.fail(`Unsupported actual manifest state: ${candidate.freezeStatus}`);
}

function validateManifest(candidate: BaselineManifest, run: BenchmarkRun): string[] {
  const errors: string[] = [];
  const semantic = candidate.semantic;
  const contract = semantic.caseContract;
  const governance = candidate.governance;

  if (candidate.schemaVersion !== "AI_SEARCH_BASELINE_MANIFEST_V1") errors.push("SCHEMA_VERSION");
  if (candidate.baselineVersion !== "V1") errors.push("BASELINE_VERSION");
  if (!["DRAFT", "READY_FOR_HUMAN_FREEZE", "FROZEN", "SUPERSEDED"].includes(candidate.freezeStatus)) errors.push("FREEZE_STATUS");
  if (semantic.benchmarkVersion !== run.summary.benchmarkVersion) errors.push("BENCHMARK_VERSION");
  if (semantic.hashContractRevision !== HASH_CONTRACT_REVISION) errors.push("HASH_CONTRACT_REVISION");
  if (semantic.semanticResultHash !== run.semanticResultHash) errors.push("SEMANTIC_DRIFT");
  if (semantic.corpusIdentity !== corpusIdentity(corpus.cases)) errors.push("CORPUS_DRIFT");
  if (semantic.expectationIdentity !== expectationIdentity(corpus.cases)) errors.push("EXPECTATION_DRIFT");
  if (semantic.fixtureIdentity !== fixtureIdentity()) errors.push("FIXTURE_DRIFT");
  if (semantic.classificationAuthorityIdentity !== classificationAuthorityIdentity(corpus.cases)) errors.push("CLASSIFICATION_AUTHORITY_DRIFT");
  if (contract.total !== 100 || contract.executed !== 79 || contract.contractOnly !== 21) errors.push("EXECUTION_STATUS_DRIFT");
  if (contract.total !== contract.executed + contract.contractOnly) errors.push("INVALID_COUNT_EQUATION");
  if (semantic.acceptance.hardGateCount !== run.summary.hardGateFailureCount) errors.push("HARD_GATE_DRIFT");
  if (semantic.acceptance.qualityGapCount !== run.summary.qualityGapCount) errors.push("QUALITY_GAP_DRIFT");
  if (!/^[0-9a-f]{40}$/.test(candidate.provenance.sourceGitSha)) errors.push("SOURCE_SHA");
  if (candidate.provenance.executionIdentityHash !== run.executionIdentityHash) errors.push("EXECUTION_IDENTITY");
  if (candidate.provenance.technicalReview.status !== "PASS") errors.push("TECHNICAL_REVIEW");
  if (!candidate.provenance.technicalReview.evidenceRef || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.provenance.technicalReview.reviewedAt)) errors.push("REVIEW_EVIDENCE");
  if (JSON.stringify(candidate).includes("benchmarkImplementationHash")) errors.push("LEGACY_HASH_FIELD");
  if (candidate.freezeStatus === "FROZEN") {
    if (governance.humanFreezeDecision !== "APPROVED") errors.push("FROZEN_WITHOUT_APPROVAL");
    if (governance.humanDecision !== "APPROVE_BASELINE_V1_FOR_FREEZE_TRANSITION") errors.push("FROZEN_DECISION_MISMATCH");
    if (!governance.humanDecisionHash || !/^[0-9a-f]{64}$/.test(governance.humanDecisionHash)) errors.push("FROZEN_DECISION_HASH");
    if (!governance.freezeEvidenceRef) errors.push("FROZEN_WITHOUT_EVIDENCE");
    if (governance.freezeEvidenceRef && (/^[A-Za-z]:[\\/]/.test(governance.freezeEvidenceRef) || governance.freezeEvidenceRef.startsWith("/"))) errors.push("ABSOLUTE_FREEZE_EVIDENCE");
    if (!governance.frozenAt) errors.push("FROZEN_WITHOUT_TIMESTAMP");
    if (governance.frozenAt && Number.isNaN(Date.parse(governance.frozenAt))) errors.push("INVALID_FROZEN_TIMESTAMP");
    if (candidate.baselineVersion === "V1" && semantic.hashContractRevision !== HASH_CONTRACT_REVISION) errors.push("FROZEN_SEMANTIC_MUTATION");
  } else {
    if (governance.humanFreezeDecision !== "NOT_RECORDED") errors.push("APPROVAL_STATE");
    if (governance.humanDecision !== undefined) errors.push("DRAFT_DECISION_STATE");
    if (governance.humanDecisionHash !== undefined && governance.humanDecisionHash !== null) errors.push("DRAFT_DECISION_HASH");
    if (governance.freezeEvidenceRef !== null) errors.push("DRAFT_FREEZE_EVIDENCE");
    if (governance.frozenAt !== null) errors.push("DRAFT_FROZEN_AT");
  }
  return errors;
}

test("Baseline V1 DRAFT manifest validates against the current benchmark authority", async () => {
  const run = await runBenchmark(corpus.cases, createBenchmarkMcpACore(), {
    mainSha: manifest.provenance.sourceGitSha,
    benchmarkVersion: corpus.benchmarkVersion,
  });
  assertDeclaredGovernanceState(manifest, run);
});

test("Baseline V1 supports an explicit synthetic DRAFT governance state", async () => {
  const run = await runBenchmark(corpus.cases, createBenchmarkMcpACore(), {
    mainSha: manifest.provenance.sourceGitSha,
    benchmarkVersion: corpus.benchmarkVersion,
  });
  const draft = cloneManifest();
  draft.freezeStatus = "DRAFT";
  draft.governance = { humanFreezeDecision: "NOT_RECORDED", freezeEvidenceRef: null, frozenAt: null };
  assertDeclaredGovernanceState(draft, run);
});

test("Baseline V1 contract rejects revision, identity, count, acceptance, and legacy-hash drift", async () => {
  const run = await runBenchmark(corpus.cases, createBenchmarkMcpACore(), {
    mainSha: manifest.provenance.sourceGitSha,
    benchmarkVersion: corpus.benchmarkVersion,
  });
  const mutations: Array<[string, (candidate: BaselineManifest) => void, string]> = [
    ["missing revision", (candidate) => { candidate.semantic.hashContractRevision = ""; }, "HASH_CONTRACT_REVISION"],
    ["legacy revision", (candidate) => { candidate.semantic.hashContractRevision = "LEGACY_EXECUTION_BOUND"; }, "HASH_CONTRACT_REVISION"],
    ["semantic hash", (candidate) => { candidate.semantic.semanticResultHash = "0".repeat(64); }, "SEMANTIC_DRIFT"],
    ["corpus identity", (candidate) => { candidate.semantic.corpusIdentity = "0".repeat(64); }, "CORPUS_DRIFT"],
    ["expectation identity", (candidate) => { candidate.semantic.expectationIdentity = "0".repeat(64); }, "EXPECTATION_DRIFT"],
    ["classification authority", (candidate) => { candidate.semantic.classificationAuthorityIdentity = "0".repeat(64); }, "CLASSIFICATION_AUTHORITY_DRIFT"],
    ["execution status", (candidate) => { candidate.semantic.caseContract = { total: 100, executed: 80, contractOnly: 20 }; }, "EXECUTION_STATUS_DRIFT"],
    ["count equation", (candidate) => { candidate.semantic.caseContract = { total: 100, executed: 79, contractOnly: 20 }; }, "INVALID_COUNT_EQUATION"],
    ["hard gate", (candidate) => { candidate.semantic.acceptance.hardGateCount = 1; }, "HARD_GATE_DRIFT"],
    ["quality gap", (candidate) => { candidate.semantic.acceptance.qualityGapCount = 1; }, "QUALITY_GAP_DRIFT"],
    ["legacy alias", (candidate) => { (candidate as unknown as Record<string, unknown>).benchmarkImplementationHash = "legacy"; }, "LEGACY_HASH_FIELD"],
  ];
  for (const [label, mutate, expected] of mutations) {
    const candidate = cloneManifest();
    mutate(candidate);
    assert.ok(validateManifest(candidate, run).includes(expected), label);
  }
});

test("Baseline V1 distinguishes provenance-only SHA drift from semantic drift", async () => {
  const run = await runBenchmark(corpus.cases, createBenchmarkMcpACore(), {
    mainSha: manifest.provenance.sourceGitSha,
    benchmarkVersion: corpus.benchmarkVersion,
  });
  const provenanceOnly = cloneManifest();
  provenanceOnly.provenance.sourceGitSha = "a".repeat(40);
  provenanceOnly.provenance.executionIdentityHash = "b".repeat(64);
  assert.equal(provenanceOnly.semantic.semanticResultHash, manifest.semantic.semanticResultHash);
  assert.equal(provenanceOnly.semantic.corpusIdentity, manifest.semantic.corpusIdentity);
  assert.deepEqual(validateManifest(provenanceOnly, run), ["EXECUTION_IDENTITY"]);
});

test("Baseline V1 rejects invalid frozen governance states and validates the declared state", async () => {
  const run = await runBenchmark(corpus.cases, createBenchmarkMcpACore(), {
    mainSha: manifest.provenance.sourceGitSha,
    benchmarkVersion: corpus.benchmarkVersion,
  });
  const draftBase = cloneManifest();
  draftBase.freezeStatus = "DRAFT";
  draftBase.governance = { humanFreezeDecision: "NOT_RECORDED", freezeEvidenceRef: null, frozenAt: null };
  const withoutApproval = structuredClone(draftBase);
  withoutApproval.freezeStatus = "FROZEN";
  assert.ok(validateManifest(withoutApproval, run).includes("FROZEN_WITHOUT_APPROVAL"));
  const withoutEvidence = structuredClone(draftBase);
  withoutEvidence.freezeStatus = "FROZEN";
  withoutEvidence.governance.humanFreezeDecision = "APPROVED";
  assert.ok(validateManifest(withoutEvidence, run).includes("FROZEN_WITHOUT_EVIDENCE"));
  const withoutTimestamp = structuredClone(draftBase);
  withoutTimestamp.freezeStatus = "FROZEN";
  withoutTimestamp.governance.humanFreezeDecision = "APPROVED";
  withoutTimestamp.governance.freezeEvidenceRef = "human-freeze-evidence";
  assert.ok(validateManifest(withoutTimestamp, run).includes("FROZEN_WITHOUT_TIMESTAMP"));
  assertDeclaredGovernanceState(manifest, run);
});

test("Baseline V1 accepts the designed frozen state and rejects partial governance states", async () => {
  const run = await runBenchmark(corpus.cases, createBenchmarkMcpACore(), {
    mainSha: manifest.provenance.sourceGitSha,
    benchmarkVersion: corpus.benchmarkVersion,
  });
  const frozen = cloneManifest();
  frozen.freezeStatus = "FROZEN";
  frozen.governance = {
    humanFreezeDecision: "APPROVED",
    humanDecision: "APPROVE_BASELINE_V1_FOR_FREEZE_TRANSITION",
    humanDecisionHash: "b4da07afecab9712e0393a5e2b318431c9dcb567306d86d07594797c5d60bfdc",
    freezeEvidenceRef: "reports/ai-search/securium-ai-search-baseline-v1-b4-freeze-evidence.json",
    frozenAt: "2026-08-26T00:00:00.000Z",
  };
  assert.deepEqual(validateManifest(frozen, run), []);

  const invalidStates: Array<[string, (candidate: BaselineManifest) => void, string]> = [
    ["draft approval", (candidate) => { candidate.freezeStatus = "DRAFT"; candidate.governance.humanFreezeDecision = "APPROVED"; }, "APPROVAL_STATE"],
    ["draft decision hash", (candidate) => { candidate.freezeStatus = "DRAFT"; candidate.governance.humanDecisionHash = "b4da07afecab9712e0393a5e2b318431c9dcb567306d86d07594797c5d60bfdc"; }, "DRAFT_DECISION_HASH"],
    ["draft evidence", (candidate) => { candidate.freezeStatus = "DRAFT"; candidate.governance.humanFreezeDecision = "NOT_RECORDED"; candidate.governance.freezeEvidenceRef = "freeze-evidence"; }, "DRAFT_FREEZE_EVIDENCE"],
    ["draft timestamp", (candidate) => { candidate.freezeStatus = "DRAFT"; candidate.governance.humanFreezeDecision = "NOT_RECORDED"; candidate.governance.frozenAt = "2026-08-26T00:00:00.000Z"; }, "DRAFT_FROZEN_AT"],
    ["frozen not recorded", (candidate) => { candidate.governance.humanFreezeDecision = "NOT_RECORDED"; candidate.governance.humanDecision = undefined; candidate.governance.humanDecisionHash = null; candidate.governance.freezeEvidenceRef = null; candidate.governance.frozenAt = null; }, "FROZEN_WITHOUT_APPROVAL"],
    ["unsupported decision", (candidate) => { candidate.governance.humanDecision = "APPROVE_OTHER" as BaselineManifest["governance"]["humanDecision"]; }, "FROZEN_DECISION_MISMATCH"],
    ["missing decision hash", (candidate) => { candidate.governance.humanDecisionHash = null; }, "FROZEN_DECISION_HASH"],
    ["missing evidence", (candidate) => { candidate.governance.freezeEvidenceRef = null; }, "FROZEN_WITHOUT_EVIDENCE"],
    ["missing timestamp", (candidate) => { candidate.governance.frozenAt = null; }, "FROZEN_WITHOUT_TIMESTAMP"],
    ["malformed decision hash", (candidate) => { candidate.governance.humanDecisionHash = "not-a-sha"; }, "FROZEN_DECISION_HASH"],
    ["semantic drift", (candidate) => { candidate.semantic.semanticResultHash = "0".repeat(64); }, "SEMANTIC_DRIFT"],
    ["hash revision drift", (candidate) => { candidate.semantic.hashContractRevision = "SEMANTIC_HASH_V3"; }, "HASH_CONTRACT_REVISION"],
    ["corpus drift", (candidate) => { candidate.semantic.corpusIdentity = "0".repeat(64); }, "CORPUS_DRIFT"],
    ["expectation drift", (candidate) => { candidate.semantic.expectationIdentity = "0".repeat(64); }, "EXPECTATION_DRIFT"],
    ["fixture drift", (candidate) => { candidate.semantic.fixtureIdentity = "MCPA_BENCHMARK_FIXTURE_V1:invalid"; }, "FIXTURE_DRIFT"],
    ["classification drift", (candidate) => { candidate.semantic.classificationAuthorityIdentity = "0".repeat(64); }, "CLASSIFICATION_AUTHORITY_DRIFT"],
    ["execution status drift", (candidate) => { candidate.semantic.caseContract = { total: 100, executed: 80, contractOnly: 20 }; }, "EXECUTION_STATUS_DRIFT"],
    ["hard gate drift", (candidate) => { candidate.semantic.acceptance.hardGateCount = 1; }, "HARD_GATE_DRIFT"],
    ["quality gap drift", (candidate) => { candidate.semantic.acceptance.qualityGapCount = 1; }, "QUALITY_GAP_DRIFT"],
  ];
  for (const [label, mutate, expected] of invalidStates) {
    const candidate = structuredClone(frozen);
    mutate(candidate);
    assert.ok(validateManifest(candidate, run).includes(expected), label);
  }
});
