import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("reviews prioritizes today's due action without changing the practice contract", () => {
  const source = readFileSync("app/reviews/page.tsx", "utf8");
  const styles = readFileSync("components/v2/review-v2.module.css", "utf8");

  assert.match(source, /<h1>오늘의 복습<\/h1>/);
  assert.match(source, /오늘 먼저 복습할 항목/);
  assert.match(source, /복습 시작/);
  assert.match(source, /reviewOnly=1&count=50/);
  assert.match(source, /summary\.items\.slice\(0, 5\)/);
  assert.match(source, /formatType\(item\.targetType\)/);
  assert.match(source, /오늘 예정된 복습이 없습니다/);
  assert.doesNotMatch(source, /new priority|sort\(/i);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /calc\(6rem \+ env\(safe-area-inset-bottom\)\)/);
});

test("wrong notes separates summary, filters, and retry actions", () => {
  const source = readFileSync("app/wrong-notes/page.tsx", "utf8");
  const card = readFileSync("components/wrong-note-card.tsx", "utf8");

  assert.match(source, /<h1>오답노트<\/h1>/);
  assert.match(source, /전체 오답/);
  assert.match(source, /반복 오답/);
  assert.match(source, /최근 추가/);
  assert.match(source, /<details className=\{styles\.filterDisclosure\}/);
  assert.match(card, /반복 오답 \{note\.wrongCount\}회/);
  assert.match(card, /wrongOnly=1&questionId=\$\{note\.questionId\}&count=1/);
  assert.match(card, /메모와 학습 상태 관리/);
  assert.match(card, /role="status" aria-live="polite"/);
});
