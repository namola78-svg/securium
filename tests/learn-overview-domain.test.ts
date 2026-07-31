import assert from "node:assert/strict";
import test from "node:test";
import {
  getCurriculumNodeLabel,
  hasPrimaryCurriculumPath,
} from "../lib/services/learn-overview-service.ts";

test("학습 개요는 연결 레슨이 있는 공식 커리큘럼을 주 경로로 사용한다", () => {
  assert.equal(hasPrimaryCurriculumPath(null), false);
  assert.equal(hasPrimaryCurriculumPath({ linkedLessonCount: 0 }), false);
  assert.equal(hasPrimaryCurriculumPath({ linkedLessonCount: 3 }), true);
});

test("학습자 화면은 내부 CurriculumNode 타입보다 한글 계층명을 우선 표시한다", () => {
  assert.equal(getCurriculumNodeLabel("TRACK"), "필기/실기");
  assert.equal(getCurriculumNodeLabel("SUBJECT"), "과목");
  assert.equal(getCurriculumNodeLabel("MAJOR_ITEM"), "주요항목");
  assert.equal(getCurriculumNodeLabel("SUB_ITEM"), "세부항목");
  assert.equal(getCurriculumNodeLabel("UNKNOWN_INTERNAL_TYPE"), "학습 항목");
});

