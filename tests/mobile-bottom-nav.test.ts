import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("signed-in mobile header exposes app-like bottom navigation", () => {
  const source = readFileSync("components/header-controls.tsx", "utf8");
  const navConfig = readFileSync("lib/ui-nav.ts", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /mobileBottomItems/);
  assert.match(source, /모바일 학습 빠른 이동/);
  assert.match(source, /isMobileBottomActive\(activePath, item\)/);
  assert.match(source, /function isMobileBottomActive/);
  assert.match(navConfig, /href: '\/dashboard'/);
  assert.match(navConfig, /href: '\/my-courses'/);
  assert.match(navConfig, /href: '\/practice'/);
  assert.match(navConfig, /href: '\/practical'/);
  assert.match(navConfig, /href: '\/my-learning'/);
  assert.match(navConfig, /activeHrefs: \['\/my-courses', '\/learn', '\/courses'\]/);
  assert.match(navConfig, /activeHrefs: \['\/practice', '\/questions'\]/);
  assert.match(navConfig, /activeHrefs: \['\/my-learning', '\/reviews', '\/analytics', '\/bookmarks', '\/wrong-notes'\]/);
  assert.match(styles, /\.mobile-bottom-nav\s*\{\s*display: none;/);
  assert.match(styles, /body:has\(\.mobile-bottom-nav\)/);
  assert.match(styles, /padding-bottom: calc\(92px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.mobile-bottom-nav\s*\{/);
  assert.match(styles, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /min-height: 52px/);
  assert.match(styles, /\.mobile-bottom-nav a:focus-visible/);
  assert.match(styles, /\.mobile-bottom-nav a\.active/);
});
