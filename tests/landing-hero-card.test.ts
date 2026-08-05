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
  assert.match(heroPanelSource, /SECURIUM Knowledge Core/);
  assert.match(heroPanelSource, /검증 가능/);
  assert.match(heroPanelSource, /공식 기준 기반 학습 엔진/);
  assert.match(heroPanelSource, /출제기준, 이론, 문제, AI 근거 설명, 복습 신호/);
  assert.match(heroPanelSource, /KISA · NCS 기반/);
  assert.match(heroPanelSource, /검증 가능한 해설/);
  assert.match(heroPanelSource, /취약 영역 추천/);
  assert.match(heroPanelSource, /href="\/courses"/);
  assert.doesNotMatch(heroPanelSource, /인증기준 2\.6 접근통제/);
  assert.doesNotMatch(heroPanelSource, /진행률/);
  assert.doesNotMatch(heroPanelSource, /68%/);
  assert.doesNotMatch(heroPanelSource, /progress-track/);
});
