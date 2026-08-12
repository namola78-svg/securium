import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overview = readFileSync("app/learn/[courseSlug]/page.tsx", "utf8");
const subject = readFileSync("app/learn/[courseSlug]/subjects/[subjectId]/page.tsx", "utf8");
const legacyLesson = readFileSync("app/learn/[courseSlug]/lessons/[lessonId]/page.tsx", "utf8");
const courseLesson = readFileSync("app/learn/[courseSlug]/course-lessons/[courseLessonId]/page.tsx", "utf8");
const styles = readFileSync("components/v2/learn-experience.module.css", "utf8");

test("course overview prioritizes one next-learning action before curriculum", () => {
  const nextIndex = overview.indexOf("data-learn-primary");
  const curriculumIndex = overview.indexOf("data-learn-curriculum");
  assert.ok(nextIndex > -1);
  assert.ok(curriculumIndex > nextIndex);
  assert.equal((overview.match(/className=\{styles\.primaryButton\}/g) ?? []).length, 1);
  assert.match(overview, /이어서 학습/);
  assert.match(overview, /필기·실기 과정 구성/);
});

test("subject page presents current lesson before topic inventory", () => {
  assert.ok(subject.indexOf("지금 배울 내용") < subject.indexOf("이 과목에서 다루는 주제"));
  assert.match(subject, /aria-current=\{lesson\.id === nextLesson\?\.id \? "step"/);
  assert.match(subject, /과목 이론 진도/);
});

test("lesson pages follow learning, evidence, question, next-learning flow", () => {
  for (const source of [legacyLesson, courseLesson]) {
    assert.ok(source.indexOf('id="learning-content"') > -1);
    assert.ok(source.indexOf("문제 확인") > source.indexOf('id="learning-content"'));
    assert.match(source, /5문제로 확인하기/);
    assert.match(source, /다음 학습/);
    assert.match(source, /data-learn-lesson-v2/);
  }
  assert.match(courseLesson, /시험 포인트/);
  assert.match(courseLesson, /헷갈리기 쉬운 포인트/);
  assert.match(courseLesson, /공식 근거 보기/);
  assert.match(legacyLesson, /공식 근거와 검수 정보/);
});

test("Learn V2 keeps responsive reading and accessibility contracts", () => {
  assert.match(styles, /grid-template-columns: minmax\(0, 800px\)/);
  assert.match(styles, /line-height: 1\.78/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /min-height: 44px/);
  assert.doesNotMatch(styles, /font-size:\s*(10|11)px/);
});
