import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRisk,
  gradeWrittenAnswer,
} from "../lib/services/specialized-learning-service.ts";
import {
  DisabledCodeExecutionProvider,
  gradeCodeAnalysis,
  gradePrivacyAssessment,
} from "../lib/services/practical-specialization-service.ts";

const writtenRule = {
  modelAnswer: "자산과 위협을 식별하고 최소 권한과 로그 통제를 적용한다.",
  requiredKeywords: ["자산", "위협", "최소 권한"],
  optionalKeywords: ["로그", "변경관리"],
  maximumScore: 100,
  partialScoreRules: [
    { keywords: ["위험", "통제"], score: 10, mode: "ALL" as const },
  ],
  guidance: "참고용 보조채점",
};

test("서술형 키워드 보조채점은 충족·누락 키워드와 참고 점수를 반환한다", () => {
  const result = gradeWrittenAnswer(
    "자산과 위협을 식별하고 최소 권한 및 로그 통제를 적용한다.",
    writtenRule,
  );
  assert.equal(result.advisoryOnly, true);
  assert.deepEqual(result.fulfilledRequired, ["자산", "위협", "최소 권한"]);
  assert.deepEqual(result.missingRequired, []);
  assert.ok(result.earnedScore > 70);
});

test("서술형 보조채점은 누락 키워드에 대해 부분점수를 계산한다", () => {
  const result = gradeWrittenAnswer("자산을 식별하고 로그를 확인한다.", writtenRule);
  assert.ok(result.earnedScore > 0);
  assert.ok(result.earnedScore < result.maximumScore);
  assert.deepEqual(result.missingRequired, ["위협", "최소 권한"]);
});

test("위험 계산 방법을 바꾸면 같은 입력의 위험값이 달라진다", () => {
  const multiply = calculateRisk({
    formulaType: "MULTIPLY",
    likelihood: 3,
    impact: 4,
    configuration: { multiplier: 1 },
  });
  const weighted = calculateRisk({
    formulaType: "WEIGHTED",
    likelihood: 3,
    impact: 4,
    configuration: { likelihoodWeight: 1, impactWeight: 2 },
  });
  assert.equal(multiply.riskValue, 12);
  assert.equal(weighted.riskValue, 11);
  assert.notEqual(multiply.riskValue, weighted.riskValue);
});

test("위험등급 기준은 계산식과 분리되어 관리자 구간을 적용한다", () => {
  const result = calculateRisk({
    formulaType: "MULTIPLY",
    likelihood: 4,
    impact: 5,
    grades: [
      { code: "LOW", label: "낮음", minValue: 0, maxValue: 6 },
      { code: "HIGH", label: "높음", minValue: 7, maxValue: 25 },
    ],
  });
  assert.equal(result.riskValue, 20);
  assert.equal(result.riskLevel, "HIGH");
});

test("취약 라인·약점·CWE·정탐과 조치 키워드를 부분점수로 채점한다", () => {
  const result = gradeCodeAnalysis(
    {
      selectedLines: [2],
      weaknessId: "weak-sql",
      selectedCweCode: "CWE-89",
      truePositive: true,
      userExplanation: "입력 검증과 매개변수화를 적용한다.",
      remediationCode: "",
    },
    {
      expectedLines: [2, 3],
      weaknessId: "weak-sql",
      cweCode: "CWE-89",
      expectedTruePositive: true,
      remediationKeywords: ["검증", "매개변수화"],
      lineScore: 30,
      weaknessScore: 20,
      cweScore: 15,
      judgmentScore: 15,
      keywordScore: 15,
      remediationCodeScore: 5,
      maximumScore: 100,
    },
  );
  assert.equal(result.breakdown.vulnerableLines, 15);
  assert.equal(result.breakdown.cwe, 15);
  assert.equal(result.score, 80);
});

test("오탐 사례는 빈 취약 라인과 오탐 판단을 정답으로 채점한다", () => {
  const result = gradeCodeAnalysis(
    {
      selectedLines: [],
      weaknessId: "weak-null",
      selectedCweCode: "CWE-476",
      truePositive: false,
      userExplanation: "호출 전 검증이 이미 적용되어 있다.",
      remediationCode: "if (value == null) return;",
    },
    {
      expectedLines: [],
      weaknessId: "weak-null",
      cweCode: "CWE-476",
      expectedTruePositive: false,
      remediationKeywords: ["검증"],
      lineScore: 30,
      weaknessScore: 20,
      cweScore: 15,
      judgmentScore: 15,
      keywordScore: 15,
      remediationCodeScore: 5,
      maximumScore: 100,
    },
  );
  assert.equal(result.isCorrect, true);
  assert.equal(result.score, 100);
});

test("코드 실행 공급자는 기본적으로 실행을 거부한다", async () => {
  const provider = new DisabledCodeExecutionProvider();
  await assert.rejects(
    provider.execute({ language: "Java", sourceCode: "System.exit(0);" }),
    /CODE_EXECUTION_DISABLED/,
  );
});

test("영향평가 대상 판단과 평가항목 매핑을 분리해 채점한다", () => {
  const result = gradePrivacyAssessment(
    {
      targetDecision: "REQUIRED",
      selectedAssessmentItems: ["item-1"],
      identifiedRisks: "과다 수집과 암호화 누락",
      improvementPlan: "최소 수집과 암호화를 적용한다.",
    },
    {
      correctTargetDecision: "REQUIRED",
      expectedAssessmentItems: ["item-1", "item-2"],
      riskKeywords: ["과다 수집", "암호화"],
      improvementKeywords: ["최소 수집", "암호화"],
    },
  );
  assert.equal(result.breakdown.targetDecision, 30);
  assert.equal(result.breakdown.assessmentItems, 15);
  assert.deepEqual(result.missedItems, ["item-2"]);
  assert.equal(result.score, 85);
});
