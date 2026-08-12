import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("AI explanation stays secondary to official reviewed explanation", () => {
  const source = readFileSync("components/practice-session.tsx", "utf8");
  assert.ok(source.indexOf("공식 해설") < source.indexOf("AI 보조 설명"));
  assert.match(source, /AI에게 추가 설명 요청/);
  assert.match(source, /공식 해설을 대체하지 않습니다/);
  assert.match(source, /sourceContextIds/);
  assert.match(source, /internalSources/);
});
