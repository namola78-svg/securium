import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("signed-in mobile header exposes app-like bottom navigation", () => {
  const source = readFileSync("components/header-controls.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /mobileBottomItems/);
  assert.match(source, /모바일 학습 빠른 이동/);
  assert.match(source, /href: "\/dashboard", label: "홈"/);
  assert.match(source, /href: "\/my-courses", label: "학습"/);
  assert.match(source, /href: "\/practice", label: "문제"/);
  assert.match(source, /href: "\/reviews", label: "복습"/);
  assert.match(source, /href: "\/profile", label: "마이"/);
  assert.match(source, /\{isSignedIn \? \(/);
  assert.match(styles, /\.mobile-bottom-nav\s*\{\s*display: none;/);
  assert.match(styles, /body:has\(\.mobile-bottom-nav\)/);
  assert.match(styles, /padding-bottom: calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.mobile-bottom-nav\s*\{/);
  assert.match(styles, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /min-height: 52px/);
  assert.match(styles, /\.mobile-bottom-nav a:focus-visible/);
  assert.match(styles, /\.mobile-bottom-nav a\.active/);
});
