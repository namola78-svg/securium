import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public landing hero card explains knowledge-linked AI outcomes", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  const heroPanelSource =
    source.match(
      /<div className="hero-panel"[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/,
    )?.[0] ?? "";

  assert.match(heroPanelSource, /SECURIUM 학습 경험/);
  assert.match(heroPanelSource, /공식 기준 기반 학습 코어/);
  assert.match(heroPanelSource, /Knowledge-linked Learning/);
  assert.match(heroPanelSource, /검증 가능/);
  assert.match(heroPanelSource, /공식 기준 기반 학습 엔진/);
  assert.match(heroPanelSource, /출제기준, 이론, 문제, AI 근거 설명, 복습 신호/);
  assert.match(heroPanelSource, /KISA · NCS 기반/);
  assert.match(heroPanelSource, /검증 가능한 해설/);
  assert.match(heroPanelSource, /취약 영역 추천/);
  assert.match(heroPanelSource, /AI 근거 학습 결과 예시/);
  assert.match(heroPanelSource, /왜 접근권한 검토가 반복되어야 하나요/);
  assert.match(heroPanelSource, /공식 기준 2개 · 관련 개념 4개 연결/);
  assert.match(heroPanelSource, /오답 5문제 복습 추천/);
  assert.match(source, /공식 기준으로 배우고/);
  assert.match(source, /AI 근거로 이해하세요/);
  assert.match(source, /자격시험과 실무 기준을 이론, 문제, 근거 해설, 복습으로 연결하는/);
  assert.doesNotMatch(heroPanelSource, /href="\/courses"/);
  assert.doesNotMatch(heroPanelSource, /인증기준 2\.6 접근통제/);
  assert.doesNotMatch(heroPanelSource, /진행률/);
  assert.doesNotMatch(heroPanelSource, /68%/);
  assert.doesNotMatch(heroPanelSource, /progress-track/);
});

test("public landing ends with product value CTA instead of course count summary", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  const finalCtaSource =
    source.match(/<div className="landing-final-cta"[\s\S]*?<\/div>\s*<\/section>/)?.[0] ??
    "";

  assert.match(finalCtaSource, /SECURIUM 시작하기/);
  assert.match(finalCtaSource, /공식 기준으로 배우고, AI 근거로 복습하세요/);
  assert.match(finalCtaSource, /무료로 학습 시작하기/);
  assert.match(finalCtaSource, /과정 먼저 둘러보기/);
  assert.doesNotMatch(source, /landing-course-summary/);
  assert.doesNotMatch(source, /개 과정이 준비되어 있습니다/);
});

test("public landing course spotlight presents learner goal comparison facts", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  const courseSpotlightSource =
    source.match(/<section className="landing-course-spotlight"[\s\S]*?<\/section>/)?.[0] ??
    "";

  assert.match(courseSpotlightSource, /목표별 학습 경로/);
  assert.match(courseSpotlightSource, /내가 준비하는 목표를 선택하세요/);
  assert.match(courseSpotlightSource, /자격시험과 실무 역량을 공식 기준 기반 커리큘럼으로/);
  assert.match(courseSpotlightSource, /추천 대상/);
  assert.match(courseSpotlightSource, /난이도/);
  assert.match(courseSpotlightSource, /학습 구성/);
  assert.match(courseSpotlightSource, /과정 자세히 보기/);
  assert.doesNotMatch(courseSpotlightSource, /COURSE CATALOG/);
  assert.doesNotMatch(courseSpotlightSource, /INTERMEDIATE|BEGINNER|ADVANCED/);
});

test("public landing dashboard preview emphasizes next learner actions", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  const dashboardPreviewSource =
    source.match(/<section[\s\S]*?landing-dashboard-preview[\s\S]*?<\/section>/)?.[0] ??
    "";

  assert.match(dashboardPreviewSource, /로그인하면 오늘 할 일이 먼저 보입니다/);
  assert.match(dashboardPreviewSource, /행동 순서대로 확인합니다/);
  assert.match(dashboardPreviewSource, /지금 할 일/);
  assert.match(dashboardPreviewSource, /01 · 이어서 학습/);
  assert.match(dashboardPreviewSource, /02 · AI 근거 확인/);
  assert.match(dashboardPreviewSource, /03 · 복습/);
  assert.match(dashboardPreviewSource, /04 · 약한 영역/);
  assert.match(dashboardPreviewSource, /05 · 시험 감각/);
  assert.doesNotMatch(dashboardPreviewSource, /통계표를 먼저/);
});

test("public landing learning chain presents the SECURIUM knowledge engine", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  const learningChainSource =
    source.match(/<section className="section landing-learning-chain"[\s\S]*?<\/section>/)?.[0] ??
    "";

  assert.match(learningChainSource, /Knowledge Engine/);
  assert.match(learningChainSource, /공식 기준이 문제와 AI 근거까지 이어집니다/);
  assert.match(learningChainSource, /검증 가능한 AI 근거/);
  assert.match(learningChainSource, /핵심 이론/);
  assert.match(learningChainSource, /정답 이유와 오답 이유를 근거 콘텐츠와 함께 설명/);
  assert.match(learningChainSource, /다음 학습 행동으로 다시 추천/);
});

test("public landing AI result card shows explainable answer outcomes", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  const aiResultSource =
    source.match(/<article className="ai-result-card"[\s\S]*?<\/article>/)?.[0] ?? "";

  assert.match(aiResultSource, /AI 답변보다 중요한 것은, 왜 그런지 확인하는 것입니다/);
  assert.match(aiResultSource, /설명, 공식 근거, 관련 문제, 관련 개념, 다음 복습/);
  assert.match(aiResultSource, /01 · 질문/);
  assert.match(aiResultSource, /02 · AI 설명/);
  assert.match(aiResultSource, /03 · 공식 근거/);
  assert.match(aiResultSource, /04 · 다음 학습/);
  assert.match(aiResultSource, /근거 표시 · 검수 상태 확인/);
});
