import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("course learn page prioritizes learner action board before curriculum sections", () => {
  const source = readFileSync("app/learn/[courseSlug]/page.tsx", "utf8");
  const actionBoardIndex = source.indexOf("<LearnActionBoard");
  const levelPathIndex = source.indexOf("<LearnLevelPathLoader");
  const curriculumPathIndex = source.indexOf("<CurriculumPathLoader");

  assert.ok(actionBoardIndex > -1);
  assert.ok(levelPathIndex > -1);
  assert.ok(curriculumPathIndex > -1);
  assert.ok(actionBoardIndex < levelPathIndex);
  assert.ok(levelPathIndex < curriculumPathIndex);
});

test("course learn action board exposes the core learner journey", () => {
  const source = readFileSync("app/learn/[courseSlug]/page.tsx", "utf8");
  const styles = readFileSync("app/globals.css", "utf8");

  assert.match(source, /오늘의 학습 보드/);
  assert.match(source, /이어서 학습/);
  assert.match(source, /문제풀이/);
  assert.match(source, /복습/);
  assert.match(source, /분석/);
  assert.match(source, /today-learning-board/);
  assert.match(styles, /\.learn-action-grid/);
  assert.match(styles, /\.learn-action-card:focus-visible/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.learn-action-grid/);
});

test("course learn page uses user-facing labels for level statuses", () => {
  const overviewSource = readFileSync("app/learn/[courseSlug]/page.tsx", "utf8");
  const levelSource = readFileSync(
    "app/learn/[courseSlug]/levels/[levelId]/page.tsx",
    "utf8",
  );
  const serviceSource = readFileSync("lib/services/level-service.ts", "utf8");

  assert.match(overviewSource, /levelStatusLabel\(level\.status\)/);
  assert.match(levelSource, /levelStatusLabel\(level\.status\)/);
  assert.match(serviceSource, /case "AVAILABLE":[\s\S]*?return "학습 가능"/);
  assert.match(serviceSource, /case "LOCKED":[\s\S]*?return "잠김"/);
  assert.doesNotMatch(overviewSource, /<span className="badge">\{level\.status\}<\/span>/);
});
