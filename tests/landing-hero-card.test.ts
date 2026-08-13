import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = () => readFileSync("app/page.tsx", "utf8");
const styles = () =>
  readFileSync("components/v2/public-landing.module.css", "utf8");
const buttonSource = () =>
  readFileSync("components/v2/v2-button.tsx", "utf8");
const layoutSource = () => readFileSync("app/layout.tsx", "utf8");

function expectIncludes(value: string, expected: string[]) {
  for (const item of expected) {
    assert.ok(value.includes(item), `missing: ${item}`);
  }
}

test("public landing explicitly opts into the isolated V2 foundation", () => {
  const value = source();
  expectIncludes(value, [
    "V2Foundation",
    "PublicLandingHeader",
    'data-public-v2=""',
    "V2Button",
  ]);
  assert.equal(value.includes("ActionButton"), false);
});

test("interactive V2 link buttons stay inside a client component boundary", () => {
  const value = buttonSource();
  assert.match(value, /^"use client";/);
  assert.match(value, /onClick={handleClick}/);
});

test("public landing hero presents an educational product promise", () => {
  const value = source();
  expectIncludes(value, [
    "정보보호·개인정보보호 자격증 전문 학습 플랫폼",
    "보안 전문가로 가는",
    "가장 확실한 학습 경로",
    "공식 기준에 맞춘 커리큘럼과 문제풀이, 오답 복습",
    "무료로 시작하기",
    "과정 둘러보기",
  ]);
});

test("product preview is clearly identified as non-account example data", () => {
  const value = source();
  const preview = value.slice(
    value.indexOf("productPreview"),
    value.indexOf("valueGrid"),
  );
  expectIncludes(preview, [
    "학습 화면 예시",
    "실제 계정 데이터 아님",
    "공식 근거",
    "취약 개념",
    "AI",
    "보조 설명",
  ]);
  assert.doesNotMatch(preview, /\b(?:45|68|95)%\b|50,000|24\/7/);
});

test("learning flow connects official scope to review in five concise steps", () => {
  const value = source();
  expectIncludes(value, [
    "문제를 외우기보다 지식을 연결합니다",
    "공식 기준",
    "핵심 이론",
    "문제풀이",
    "해설과 AI 보조",
    "오답과 복습",
  ]);
});

test("course spotlight uses published catalog facts without learner progress", () => {
  const value = source();
  expectIncludes(value, [
    "listPublishedCoursesCached",
    "공개 과정",
    "과목",
    "주제",
    "문제",
    "과정 상세 보기",
    "catalogFallback",
  ]);
  assert.doesNotMatch(value, /학습 중|진행률|합격률|학습자 수/);
});

test("trust and footer content use evidence language and real routes", () => {
  const value = source();
  expectIncludes(value, [
    "AI보다 먼저, 기준과 근거를 확인합니다",
    "공식 답안을 AI로 대체하지 않습니다",
    "검수 상태 확인",
    "개념과 문제 연결",
    'href="/courses"',
    'href="/guide"',
    'href="/about"',
    'href="/legal/privacy"',
    'href="/legal/terms"',
  ]);
  assert.equal(value.includes("/community"), false);
});

test("landing responsive CSS keeps V2 scoped and avoids tiny new type", () => {
  const css = styles();
  expectIncludes(css, [
    "[data-public-v2]",
    "max-width: 1023px",
    "max-width: 767px",
    "max-width: 389px",
    "min-height: var(--v2-control-min-size)",
  ]);
  assert.doesNotMatch(css, /font-size:\s*(?:10|11)px/);
  assert.doesNotMatch(css, /lime|aqua|linear-gradient|radial-gradient/);
});

test("mobile landing brand resists intrinsic-width collapse", () => {
  const css = styles();
  assert.match(css, /\.brand\s*\{[\s\S]*?min-width:\s*max-content/);
  assert.match(css, /\.brandText\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(css, /\.headerActions \.desktopLogin,[\s\S]*?display:\s*none/);
  assert.match(css, /\.headerActions \.menuButton\s*\{\s*display:\s*block/);
});

test("local metadata keeps favicon requests on the local HTTP origin", () => {
  const value = layoutSource();
  assert.match(value, /localhost\|127\\\.0\\\.0\\\.1\|\\\[::1\\\]/);
  assert.match(value, /localRequest[\s\S]*?\? "http"[\s\S]*?: "https"/);
  assert.match(value, /icon: "\/favicon\.svg"/);
});
