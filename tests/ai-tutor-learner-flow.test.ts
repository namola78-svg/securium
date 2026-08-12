import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/ai-tutor/page.tsx", "utf8");
const styles = readFileSync("components/v2/phase11-v2.module.css", "utf8");

test("AI tutor preserves the existing practice-first AI contract", () => {
  assert.match(source, /문제를 먼저 풀고 채점 결과를 확인한 뒤 요청/);
  assert.match(source, /독립적인 자유 대화나 정답 대행 기능은 제공하지 않습니다/);
  assert.match(source, /`\/practice\/\$\{currentCourse\.courseSlug\}\?random=1&count=5`/);
  assert.match(source, /AI 설명은 학습 보조용입니다/);
  assert.doesNotMatch(source, /\/api\/ai\/question-explanations/);
  assert.doesNotMatch(source, /textarea|<input/);
});

test("AI tutor presents real context and source authority without raw identifiers", () => {
  assert.match(source, /현재 과정/);
  assert.match(source, /선택된 문제/);
  assert.match(source, /아직 선택되지 않음/);
  assert.match(source, /공식 채점 결과와 해설/);
  assert.match(source, /연결된 근거와 학습 콘텐츠/);
  assert.match(source, /AI 보조 설명/);
  assert.doesNotMatch(source, /user\.id\}|sourceContextIds|requestId|providerId/);
});

test("AI tutor presentation is responsive and accessible", () => {
  assert.match(source, /aria-label="AI 튜터 학습 시작"/);
  assert.match(source, /aria-labelledby="ai-context-title"/);
  assert.match(source, /aria-labelledby="ai-source-title"/);
  assert.match(styles, /@media \(max-width: 1100px\)/);
  assert.match(styles, /@media \(max-width: 680px\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /:focus-visible/);
});
