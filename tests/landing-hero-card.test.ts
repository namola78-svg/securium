import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = () => readFileSync("app/page.tsx", "utf8");
const expectIncludes = (value: string, expected: string[]) => {
  for (const item of expected) assert.ok(value.includes(item), `missing: ${item}`);
};

test("public landing hero card explains knowledge-linked AI outcomes", () => {
  const value = source();
  const hero = value.slice(value.indexOf('className="hero-panel"'), value.indexOf('className="landing-learning-chain"'));
  expectIncludes(hero, ["공식 기준 기반 학습 흐름", "기준 · 이론 · 문제 · 복습", "검증 가능한 설명", "AI 보조 설명 예시", "출처와 참고 범위를 표시", "오답과 취약 영역 연결"]);
});

test("public landing ends with product value CTA instead of course count summary", () => {
  const value = source();
  const cta = value.slice(value.indexOf('className="landing-final-cta"'));
  expectIncludes(cta, ["SECURIUM 시작하기", "공식 기준으로 배우고, 기록으로 복습하세요", "무료로 학습 시작", "과정 먼저 둘러보기"]);
  assert.equal(value.includes("landing-course-summary"), false);
});

test("public landing course spotlight presents learner goal comparison facts", () => {
  const value = source();
  const spotlight = value.slice(value.indexOf('className="landing-course-spotlight"'));
  expectIncludes(spotlight, ["목표별 학습 경로", "지금 준비할 목표를 선택하세요", "실제 공개된 과목·주제·문제 수", "추천 대상", "난이도", "학습 구성", "과정 상세 보기"]);
  assert.equal(spotlight.includes("COURSE CATALOG"), false);
});

test("public landing dashboard preview emphasizes next learner actions", () => {
  const value = source();
  const preview = value.slice(value.indexOf("landing-dashboard-preview"), value.indexOf('className="landing-course-spotlight"'));
  expectIncludes(preview, ["로그인하면 오늘 할 일을 먼저 보여줍니다", "이어서 학습, 오늘 문제, 예정 복습, 취약 영역", "지금 할 일", "01 · 이어서 학습", "02 · 복습"]);
  assert.equal(preview.includes("통계 수를 먼저"), false);
});

test("public landing learning chain presents the SECURIUM knowledge engine", () => {
  const value = source();
  const chain = value.slice(value.indexOf('className="section landing-learning-chain"'), value.indexOf('className="section landing-knowledge-platform"'));
  expectIncludes(chain, ["학습 연결 구조", "공식 기준에서 복습까지 이어집니다", "AI 보조", "핵심 이론", "오답과 취약 영역 다시 학습"]);
});

test("public landing AI result card shows explainable answer outcomes", () => {
  const value = source();
  const card = value.slice(value.indexOf('className="ai-result-card"'), value.indexOf('className="landing-learning-chain"'));
  expectIncludes(card, ["답만 제시하지 않고 왜 그런지 확인합니다", "관련 기준과 핵심 개념을 연결", "01 · 질문", "02 · 설명", "03 · 근거", "04 · 다음 행동", "학습용 참고 설명"]);
});
