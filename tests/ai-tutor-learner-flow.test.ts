import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("AI tutor page explains the learner use flow before recommendations", () => {
  const source = readFileSync("app/ai-tutor/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /문제를 풉니다/);
  assert.match(source, /AI 설명을 요청합니다/);
  assert.match(source, /근거를 확인합니다/);
  assert.match(source, /복습으로 이어갑니다/);
  assert.match(source, /AI 설명은 참고용이며 공식 기준·법령·채점 결과가 아닙니다/);
  assert.match(source, /ai-tutor-flow/);
  assert.match(styles, /\.ai-tutor-flow/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.ai-tutor-flow/);
});
