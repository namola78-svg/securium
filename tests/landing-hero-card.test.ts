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
