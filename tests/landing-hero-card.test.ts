import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public landing hero card explains platform value instead of personal progress", () => {
  const source = readFileSync("app/page.tsx", "utf8");
  const heroPanelSource =
    source.match(
      /<div className="hero-panel"[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/,
    )?.[0] ?? "";

  assert.match(heroPanelSource, /SECURIUM 학습 경험/);
  assert.match(heroPanelSource, /공식 커리큘럼부터 AI 복습까지/);
  assert.match(heroPanelSource, /공식 기준 기반/);
  assert.match(heroPanelSource, /근거 기반 설명/);
  assert.match(heroPanelSource, /이론 · 문제 · 복습/);
  assert.match(heroPanelSource, /href="\/courses"/);
  assert.doesNotMatch(heroPanelSource, /인증기준 2\.6 접근통제/);
  assert.doesNotMatch(heroPanelSource, /진행률/);
  assert.doesNotMatch(heroPanelSource, /68%/);
  assert.doesNotMatch(heroPanelSource, /progress-track/);
});
