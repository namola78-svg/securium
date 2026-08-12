import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync("components/learner-app-shell.tsx", "utf8");
const nav = readFileSync("lib/ui-nav.ts", "utf8");
const styles = readFileSync("components/v2/learner-app-shell.module.css", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

test("authenticated learner routes opt into an isolated V2 app shell", () => {
  assert.match(layout, /<LearnerAppShell user=\{shellUser\}>/);
  assert.match(shell, /data-learner-app-shell-v2=""/);
  assert.match(shell, /if \(!user \|\| !isLearnerRoute\(pathname\)\)/);
  assert.match(styles, /body:has\(\[data-learner-app-shell-v2\]\) > \.site-header/);
  assert.match(styles, /grid-template-columns: 14\.5rem minmax\(0, 1fr\)/);
});

test("desktop navigation maps only to real learner routes and handles nested paths", () => {
  for (const href of ["/dashboard", "/my-courses", "/practice", "/mock-exams", "/wrong-notes", "/bookmarks", "/analytics", "/profile", "/ai-tutor"]) assert.match(nav, new RegExp(`href: "${href}"`));
  assert.doesNotMatch(nav, /community|\/search/);
  assert.match(nav, /activeHrefs: \["\/my-courses", "\/my-learning", "\/learn", "\/lectures", "\/practical"\]/);
  assert.match(nav, /activeHrefs: \["\/practice", "\/questions"\]/);
  assert.match(shell, /aria-current=\{active \? "page" : undefined\}/);
});

test("tablet drawer preserves focus, escape, backdrop, and scroll-lock contracts", () => {
  assert.match(shell, /aria-expanded=\{drawerOpen\}/); assert.match(shell, /aria-controls="learner-navigation-drawer"/); assert.match(shell, /event\.key === "Escape"/); assert.match(shell, /event\.key !== "Tab"/); assert.match(shell, /body\.style\.position = "fixed"/); assert.match(shell, /drawerButtonRef\.current\?\.focus\(\)/); assert.match(shell, /학습 메뉴 바깥 영역 닫기/); assert.match(styles, /@media \(max-width: 1023px\)/);
});

test("mobile bottom navigation has five safe-area-aware 44px targets", () => {
  assert.match(nav, /label: "홈"/); assert.match(nav, /label: "학습"/); assert.match(nav, /label: "문제"/); assert.match(nav, /label: "모의고사"/); assert.match(nav, /label: "MY"/); assert.match(styles, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/); assert.match(styles, /min-height: 3\.25rem/); assert.match(styles, /env\(safe-area-inset-bottom\)/); assert.match(styles, /padding-bottom: calc\(5\.25rem \+ env\(safe-area-inset-bottom\)\)/);
});

test("learner route changes restore the main content position and focus", () => {
  assert.match(shell, /previousPathnameRef\.current === pathname/);
  assert.match(shell, /secondFrame = window\.requestAnimationFrame/);
  assert.match(shell, /scrollTimer = window\.setTimeout/);
  assert.match(shell, /window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
  assert.match(shell, /document\.documentElement\.scrollTop = 0/);
  assert.match(shell, /document\.body\.scrollTop = 0/);
  assert.match(shell, /contentRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
});

test("profile menu preserves real account actions and keyboard dismissal", () => {
  assert.match(shell, /aria-haspopup="menu"/); assert.match(shell, /id="learner-profile-menu" role="menu"/); assert.match(shell, /href="\/profile"/); assert.match(shell, /href="\/settings"/); assert.match(shell, /href="\/admin"/); assert.match(shell, /\/api\/auth\/supabase\/logout/); assert.match(shell, /profileButtonRef\.current\?\.focus\(\)/);
});
