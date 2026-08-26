import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/practice/[courseSlug]/page.tsx", "utf8");
const session = readFileSync("components/practice-session.tsx", "utf8");
const styles = readFileSync("components/v2/practice-v2.module.css", "utf8");
const learnerShell = readFileSync("components/learner-app-shell.tsx", "utf8");
const headerControls = readFileSync("components/header-controls.tsx", "utf8");
const nav = readFileSync("lib/ui-nav.ts", "utf8");

test("Practice V2 uses a route-scoped focus mode", () => {
  assert.match(page, /data-practice-focus-v2/);
  assert.match(page, /학습으로 돌아가기/);
  assert.match(styles, /data-practice-focus-shell/);
  assert.match(nav, /isLearnerFocusRoute/);
  assert.match(learnerShell, /isLearnerFocusRoute\(pathname\)/);
  assert.match(learnerShell, /practiceFocusMode \? null : <MobileBottomNavigation/);
  assert.match(headerControls, /isSignedIn && !focusMode/);
});

test("Practice V2 preserves selection modes and submission safety", () => {
  assert.match(session, /MULTIPLE_CHOICE/);
  assert.match(session, /SHORT_ANSWER/);
  assert.match(session, /submittingRef\.current/);
  assert.match(session, /idempotencyKey/);
  assert.match(session, /answer === choice\.id \|\| publicCopy\(answer\) === publicCopy\(choice\.content\)/);
  assert.match(session, /disabled=\{submitting \|\| !selected\.length\}/);
  assert.match(session, /정답 확인/);
});

test("choices expose accessible and non-color-only result states", () => {
  assert.match(session, /<fieldset/);
  assert.match(session, /<legend>답안 선택<\/legend>/);
  assert.match(session, /data-state=\{state\}/);
  assert.match(session, /선택한 오답/);
  assert.match(session, /<strong>정답<\/strong>/);
  assert.match(styles, /min-height: 44px/);
  assert.doesNotMatch(styles, /font-size:\s*(10|11)px/);
});

test("submitted answers flow through official explanation to next question", () => {
  const gradePanelIndex = session.indexOf("<GradePanel");
  const secondaryActionIndex = session.indexOf("styles.explanationActions");
  const nextActionIndex = session.indexOf("styles.nextButton");
  assert.ok(gradePanelIndex > -1);
  assert.ok(secondaryActionIndex > gradePanelIndex);
  assert.ok(nextActionIndex > secondaryActionIndex);
  assert.match(session, /채점 결과/);
  assert.match(session, /공식 해설/);
  assert.match(session, /공식 근거와 검수 정보/);
  assert.match(session, /role="status"/);
  assert.match(session, /tabIndex=\{-1\}/);
});

test("query contracts remain available", () => {
  assert.match(page, /query\.reviewOnly === "1"/);
  assert.match(page, /query\.wrongOnly === "1"/);
  assert.match(page, /query\.random === "1"/);
  assert.match(page, /typeof query\.count === "string"/);
});
