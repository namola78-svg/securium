import assert from "node:assert/strict";
import test from "node:test";
import {
  assertContentCanBeLinked,
  assertCourseLessonBelongsToCourse,
  createCourseLessonProgressKey,
  mergeCourseLessonPresentation,
  normalizeCanonicalKey,
} from "../lib/services/shared-content-service.ts";

test("canonicalKey는 공통 콘텐츠 식별자로 소문자 정규화한다", () => {
  assert.equal(
    normalizeCanonicalKey(" Privacy.Access-Control "),
    "privacy.access-control",
  );
});

test("보관된 공통 Content는 신규 CourseLesson에 연결할 수 없다", () => {
  assert.throws(
    () => assertContentCanBeLinked({ id: "content-1", status: "ARCHIVED" }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "SHARED_CONTENT_ARCHIVED",
  );
  assert.doesNotThrow(() =>
    assertContentCanBeLinked({ id: "content-1", status: "PUBLISHED" }),
  );
});

test("공통 Content는 공유하되 과정별 CourseLesson과 진도 키는 분리한다", () => {
  const contentId = "content-personal-data-encryption";
  const cppgLesson = {
    id: "course-lesson-cppg-encryption",
    courseId: "course-cppg",
    contentId,
    status: "PUBLISHED" as const,
  };
  const piaLesson = {
    id: "course-lesson-pia-encryption",
    courseId: "course-pia",
    contentId,
    status: "PUBLISHED" as const,
  };

  assert.equal(cppgLesson.contentId, piaLesson.contentId);
  assert.notEqual(cppgLesson.id, piaLesson.id);
  assert.notEqual(
    createCourseLessonProgressKey({
      userId: "user-1",
      courseId: cppgLesson.courseId,
      courseLessonId: cppgLesson.id,
    }),
    createCourseLessonProgressKey({
      userId: "user-1",
      courseId: piaLesson.courseId,
      courseLessonId: piaLesson.id,
    }),
  );
});

test("CourseLesson은 요청 과정 범위 밖에서 사용할 수 없다", () => {
  assert.throws(
    () =>
      assertCourseLessonBelongsToCourse({
        courseId: "course-cppg",
        courseLesson: {
          id: "lesson-1",
          courseId: "course-pia",
          contentId: "content-1",
          status: "PUBLISHED",
        },
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "COURSE_LESSON_SCOPE_MISMATCH",
  );
});

test("CourseLessonExtension은 원본 Content를 바꾸지 않고 과정별 표시만 보강한다", () => {
  const presentation = mergeCourseLessonPresentation({
    content: {
      id: "content-access-control",
      title: "접근통제",
      summary: "공통 접근통제 개념",
      body: "공통 본문",
    },
    courseLesson: {
      id: "course-lesson-isms-access-control",
      displayTitle: "ISMS-P 접근통제 심사 포인트",
    },
    extension: {
      additionalBody: "ISMS-P 과정 전용 보충 설명",
      examPointsJson: JSON.stringify(["증적 확인", "권한 검토"]),
      practicalNotes: "심사 현장 적용",
      legalNotes: "",
      standardNotes: "ISMS-P 2.6",
      evidenceNotes: "권한 신청서",
      commonMistakes: "공통 계정 방치",
    },
  });

  assert.equal(presentation.contentId, "content-access-control");
  assert.equal(presentation.courseLessonId, "course-lesson-isms-access-control");
  assert.equal(presentation.title, "ISMS-P 접근통제 심사 포인트");
  assert.match(presentation.body, /공통 본문/);
  assert.match(presentation.body, /과정 전용 보충 설명/);
  assert.deepEqual(presentation.examPoints, ["증적 확인", "권한 검토"]);
});
