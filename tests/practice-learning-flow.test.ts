import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("practice session explains the learner flow before AI explanation is available", () => {
  const source = readFileSync("components/practice-session.tsx", "utf8");

  assert.match(source, /풀이 → 채점 → 검수 해설 → AI 근거/);
  assert.match(source, /practice-learning-flow/);
  assert.match(source, /답안 선택/);
  assert.match(source, /서버 채점/);
  assert.match(source, /검수 해설/);
  assert.match(source, /AI 근거/);
  assert.match(
    source,
    /AI 참고\s+해설은 채점 이후 요청할 수 있으며 공식 채점 결과가 아닙니다/,
  );
});

test("practice result separates reviewed explanation from AI reference explanation", () => {
  const source = readFileSync("components/practice-session.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /관리자 검수 해설/);
  assert.match(source, /AI 참고 해설은 이 해설을\s+대체하지 않고/);
  assert.match(source, /AI 근거 해설 보기/);
  assert.match(styles, /\.practice-learning-flow/);
  assert.match(styles, /\.grade-panel-heading/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.practice-learning-flow/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.practice-learning-flow/);
});
