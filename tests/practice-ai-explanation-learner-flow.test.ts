import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("practice AI explanation panel shows how learners should use the explanation", () => {
  const source = readFileSync("components/practice-session.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /AI 해설 활용 순서/);
  assert.match(source, /의도 확인/);
  assert.match(source, /근거 확인/);
  assert.match(source, /복습 연결/);
  assert.match(source, /다음 행동/);
  assert.match(source, /오답노트에서/);
  assert.match(source, /ai-explanation-map/);
  assert.match(source, /ai-next-action/);
  assert.match(styles, /\.ai-explanation-map/);
  assert.match(styles, /\.ai-next-action/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.ai-explanation-map/);
});
