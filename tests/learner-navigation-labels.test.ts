import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("learner navigation pages use learner-friendly Korean labels", () => {
  const pages = [
    ["app/my-courses/page.tsx", /<p className="eyebrow">내 학습<\/p>/],
    ["app/profile/page.tsx", /<p className="eyebrow">내 프로필<\/p>/],
    ["app/settings/page.tsx", /<p className="eyebrow">학습 설정<\/p>/],
    ["app/settings/page.tsx", /<p className="eyebrow">하루 목표<\/p>/],
    ["app/practice/page.tsx", /<p className="eyebrow">문제풀이<\/p>/],
    ["app/practice/page.tsx", /<p className="eyebrow">내 과정<\/p>/],
  ] as const;

  for (const [path, pattern] of pages) {
    assert.match(readFileSync(path, "utf8"), pattern);
  }
});

test("profile page does not expose raw USER role as a fallback", () => {
  const source = readFileSync("app/profile/page.tsx", "utf8");

  assert.match(source, /일반 사용자/);
  assert.doesNotMatch(source, /\|\|\s*"USER"/);
});
