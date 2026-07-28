import assert from "node:assert/strict";
import test from "node:test";
import {
  changeEnrollmentStatus,
  enrollInCourse,
  summarizeCourseProgress,
  type EnrollableCourse,
  type EnrollmentRecord,
  type EnrollmentRepository,
  type EnrollmentStatus,
} from "../lib/services/enrollment-service.ts";
import {
  assertCatalogManager,
  isPublicCourse,
} from "../lib/services/catalog-service.ts";
import {
  courseSchema,
  subjectSchema,
  topicSchema,
} from "../lib/validation.ts";
import {
  gradeMultipleChoice,
  gradeShortAnswer,
  gradeSingleChoice,
  gradeTrueFalse,
  isPublishedQuestion,
  toPublicChoices,
} from "../lib/services/grading-service.ts";
import {
  createQuestionVersionSnapshot,
  resolveQuestionTransition,
} from "../lib/services/question-workflow-service.ts";
import {
  bookmarkIdentity,
  nextWrongNoteState,
  progressScope,
} from "../lib/services/learning-record-service.ts";
import {
  assertLessonCompletionAllowed,
  deriveStudySeconds,
  normalizeReadingPosition,
  readingProgressPercent,
} from "../lib/services/lesson-service.ts";

class MemoryEnrollmentRepository implements EnrollmentRepository {
  courses = new Map<string, EnrollableCourse>();
  enrollments: EnrollmentRecord[] = [];

  async getCourseForEnrollment(courseId: string) {
    return this.courses.get(courseId) ?? null;
  }

  async findEnrollment(userId: string, courseId: string) {
    return (
      this.enrollments.find(
        (item) => item.userId === userId && item.courseId === courseId,
      ) ?? null
    );
  }

  async createEnrollment(userId: string, courseId: string) {
    const enrollment: EnrollmentRecord = {
      id: `enrollment-${this.enrollments.length + 1}`,
      userId,
      courseId,
      status: "ACTIVE",
    };
    this.enrollments.push(enrollment);
    return enrollment;
  }

  async getEnrollmentById(enrollmentId: string) {
    return this.enrollments.find((item) => item.id === enrollmentId) ?? null;
  }

  async updateEnrollmentStatus(
    enrollmentId: string,
    status: EnrollmentStatus,
  ) {
    const enrollment = this.enrollments.find(
      (item) => item.id === enrollmentId,
    );
    if (!enrollment) throw new Error("not found");
    enrollment.status = status;
    return enrollment;
  }
}

function publicCourse(id: string): EnrollableCourse {
  return { id, active: true, published: true, deletedAt: null };
}

test("과정 목록 조회에서 공개·활성 과정만 선택한다", () => {
  const courses = [
    publicCourse("course-1"),
    { ...publicCourse("course-2"), active: false },
    { ...publicCourse("course-3"), published: false },
  ];
  assert.deepEqual(courses.filter(isPublicCourse).map((course) => course.id), [
    "course-1",
  ]);
});

test("사용자가 과정을 수강한다", async () => {
  const repository = new MemoryEnrollmentRepository();
  repository.courses.set("course-1", publicCourse("course-1"));
  const enrollment = await enrollInCourse(repository, "user-1", "course-1");
  assert.equal(enrollment.status, "ACTIVE");
});

test("중복 수강을 방지한다", async () => {
  const repository = new MemoryEnrollmentRepository();
  repository.courses.set("course-1", publicCourse("course-1"));
  await enrollInCourse(repository, "user-1", "course-1");
  await assert.rejects(
    enrollInCourse(repository, "user-1", "course-1"),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "DUPLICATE_ENROLLMENT",
  );
});

test("한 사용자가 여러 과정을 동시에 수강한다", async () => {
  const repository = new MemoryEnrollmentRepository();
  repository.courses.set("course-1", publicCourse("course-1"));
  repository.courses.set("course-2", publicCourse("course-2"));
  await enrollInCourse(repository, "user-1", "course-1");
  await enrollInCourse(repository, "user-1", "course-2");
  assert.equal(repository.enrollments.length, 2);
});

test("과정별 진도를 분리한다", () => {
  const records = [
    { userId: "user-1", courseId: "course-1", progressPercent: 20 },
    { userId: "user-1", courseId: "course-1", progressPercent: 40 },
    { userId: "user-1", courseId: "course-2", progressPercent: 90 },
  ];
  assert.equal(
    summarizeCourseProgress(records, "user-1", "user-1", "course-1"),
    30,
  );
});

test("비활성 과정은 수강할 수 없다", async () => {
  const repository = new MemoryEnrollmentRepository();
  repository.courses.set("course-1", {
    ...publicCourse("course-1"),
    active: false,
  });
  await assert.rejects(
    enrollInCourse(repository, "user-1", "course-1"),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "COURSE_NOT_ENROLLABLE",
  );
});

test("일반 사용자의 관리자 접근을 차단한다", () => {
  assert.throws(
    () => assertCatalogManager(["USER"]),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "ADMIN_FORBIDDEN",
  );
});

test("관리자가 검증된 과정 데이터를 등록할 수 있다", () => {
  assert.doesNotThrow(() => assertCatalogManager(["ADMIN"]));
  const result = courseSchema.safeParse({
    courseGroupId: "group-1",
    code: "NEW_COURSE",
    slug: "new-course",
    name: "신규 개발용 과정",
    shortName: "신규 과정",
    description: "[개발용 샘플] 과정",
    thumbnailUrl: "",
    totalLevels: 10,
    passingScore: 70,
    difficulty: "BEGINNER",
    active: "on",
    published: "on",
    displayOrder: 8,
    returnTo: "/admin/courses",
  });
  assert.equal(result.success, true);
});

test("과목과 주제 생성 입력을 검증한다", () => {
  const subject = subjectSchema.safeParse({
    courseId: "course-1",
    code: "FOUNDATION",
    name: "개발용 과목",
    description: "[개발용 샘플]",
    displayOrder: 1,
    active: "on",
    returnTo: "/admin/courses/course-1/subjects",
  });
  const topic = topicSchema.safeParse({
    subjectId: "subject-1",
    parentTopicId: "",
    code: "CORE",
    name: "개발용 주제",
    description: "[개발용 샘플]",
    displayOrder: 1,
    active: "on",
    returnTo: "/admin/subjects/subject-1/topics",
  });
  assert.equal(subject.success, true);
  assert.equal(topic.success, true);
});

test("다른 사용자의 수강 및 학습기록 접근을 차단한다", async () => {
  const repository = new MemoryEnrollmentRepository();
  repository.enrollments.push({
    id: "enrollment-1",
    userId: "owner",
    courseId: "course-1",
    status: "ACTIVE",
  });
  await assert.rejects(
    changeEnrollmentStatus(repository, "attacker", "enrollment-1", "PAUSED"),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "ENROLLMENT_FORBIDDEN",
  );
  assert.throws(
    () =>
      summarizeCourseProgress(
        [{ userId: "owner", courseId: "course-1", progressPercent: 50 }],
        "attacker",
        "owner",
        "course-1",
      ),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "PROGRESS_FORBIDDEN",
  );
});

test("OX 문제를 서버 정답 기준으로 채점한다", () => {
  assert.equal(gradeTrueFalse("choice-true", "choice-true").isCorrect, true);
  assert.equal(gradeTrueFalse("choice-false", "choice-true").isCorrect, false);
});

test("단일선택형은 하나의 정답 ID가 일치해야 한다", () => {
  assert.equal(gradeSingleChoice("choice-1", "choice-1").score, 100);
  assert.equal(gradeSingleChoice(["choice-1", "choice-2"], "choice-1").score, 0);
});

test("복수선택형은 선택 집합이 정확히 일치해야 한다", () => {
  assert.equal(
    gradeMultipleChoice(["choice-3", "choice-1"], ["choice-1", "choice-3"])
      .isCorrect,
    true,
  );
  assert.equal(
    gradeMultipleChoice(["choice-1"], ["choice-1", "choice-3"]).isCorrect,
    false,
  );
});

test("단답형은 대소문자·공백·복수정답·동의어를 지원한다", () => {
  const config = {
    ignoreCase: true,
    normalizeWhitespace: true,
    acceptedAnswers: ["Risk Based"],
    synonyms: ["위험 기반"],
  };
  assert.equal(gradeShortAnswer("  RISK   based ", config).isCorrect, true);
  assert.equal(gradeShortAnswer("위험 기반", config).isCorrect, true);
});

test("공개 문제 DTO에서 정답과 선택지 해설을 제거한다", () => {
  const result = toPublicChoices("SINGLE_CHOICE", [
    {
      id: "choice-1",
      content: "선택지",
      displayOrder: 1,
      isCorrect: true,
      explanation: "정답 해설",
    },
  ]);
  assert.deepEqual(result, [
    { id: "choice-1", content: "선택지", displayOrder: 1 },
  ]);
  assert.equal("isCorrect" in result[0], false);
  assert.deepEqual(
    toPublicChoices("SHORT_ANSWER", [
      { id: "answer", content: "비밀 정답", displayOrder: 1 },
    ]),
    [],
  );
});

test("게시되지 않은 문제는 학습자에게 노출하지 않는다", () => {
  for (const status of [
    "DRAFT",
    "REVIEW_REQUESTED",
    "IN_REVIEW",
    "APPROVED",
    "REJECTED",
    "ARCHIVED",
  ]) {
    assert.equal(isPublishedQuestion(status), false);
  }
  assert.equal(isPublishedQuestion("PUBLISHED"), true);
});

test("오답은 한 행에서 횟수와 마지막 시도를 갱신한다", () => {
  const first = nextWrongNoteState(null, "attempt-1");
  const second = nextWrongNoteState(first, "attempt-2");
  assert.deepEqual(second, {
    wrongCount: 2,
    mastered: false,
    lastAttemptId: "attempt-2",
  });
});

test("즐겨찾기 유일 키에 사용자·대상·과정을 모두 포함한다", () => {
  const first = bookmarkIdentity({
    userId: "user-1",
    targetType: "QUESTION",
    targetId: "question-1",
    courseId: "course-1",
  });
  const duplicate = bookmarkIdentity({
    userId: "user-1",
    targetType: "QUESTION",
    targetId: "question-1",
    courseId: "course-1",
  });
  assert.equal(first, duplicate);
});

test("사용자별 오답노트 범위가 분리된다", () => {
  assert.notEqual(
    bookmarkIdentity({
      userId: "user-1",
      targetType: "QUESTION",
      targetId: "question-1",
      courseId: "course-1",
    }),
    bookmarkIdentity({
      userId: "user-2",
      targetType: "QUESTION",
      targetId: "question-1",
      courseId: "course-1",
    }),
  );
});

test("과정·과목·주제별 진도 통계 범위가 분리된다", () => {
  const base = {
    userId: "user-1",
    subjectId: "subject-1",
    topicId: "topic-1",
  };
  assert.notEqual(
    progressScope({ ...base, courseId: "course-1" }),
    progressScope({ ...base, courseId: "course-2" }),
  );
});

test("권한 없는 사용자의 문제 승인을 차단한다", () => {
  assert.throws(
    () =>
      resolveQuestionTransition({
        action: "APPROVE",
        status: "IN_REVIEW",
        roles: ["USER"],
        actorId: "user-1",
        createdBy: "editor-1",
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "QUESTION_REVIEW_FORBIDDEN",
  );
});

test("작성자와 검수자를 분리한다", () => {
  assert.throws(
    () =>
      resolveQuestionTransition({
        action: "APPROVE",
        status: "IN_REVIEW",
        roles: ["CONTENT_REVIEWER"],
        actorId: "same-user",
        createdBy: "same-user",
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "SELF_REVIEW_FORBIDDEN",
  );
});

test("문제 수정 이력용 버전 스냅샷을 생성한다", () => {
  const snapshot = createQuestionVersionSnapshot({
    id: "question-1",
    version: 2,
    content: "변경된 내용",
  });
  assert.deepEqual(JSON.parse(snapshot), {
    id: "question-1",
    version: 2,
    content: "변경된 내용",
  });
});

test("레슨 읽기 위치와 진도율을 서버 규칙으로 정규화한다", () => {
  assert.equal(normalizeReadingPosition(12_000), 10_000);
  assert.equal(normalizeReadingPosition(-1), 0);
  assert.equal(readingProgressPercent(7_550), 76);
});

test("학습시간은 서버 시각 차이를 최대 5분까지만 인정한다", () => {
  const now = new Date("2026-07-27T10:10:00.000Z");
  assert.equal(
    deriveStudySeconds("2026-07-27T10:09:20.000Z", now),
    40,
  );
  assert.equal(
    deriveStudySeconds("2026-07-27T09:00:00.000Z", now),
    300,
  );
});

test("본문 하단 및 최소 학습 조건 완료 정책을 검증한다", () => {
  assert.throws(
    () =>
      assertLessonCompletionAllowed({
        policy: "SCROLL_END",
        explicitRequest: true,
        progressPercent: 99,
        studySeconds: 100,
        minimumProgressPercent: 100,
        minimumStudySeconds: 0,
      }),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "LESSON_SCROLL_END_REQUIRED",
  );
  assert.doesNotThrow(() =>
    assertLessonCompletionAllowed({
      policy: "MINIMUM_REQUIREMENTS",
      explicitRequest: true,
      progressPercent: 90,
      studySeconds: 120,
      minimumProgressPercent: 80,
      minimumStudySeconds: 60,
    }),
  );
});
