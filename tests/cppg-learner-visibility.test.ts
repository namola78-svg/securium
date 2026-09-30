import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyCppgVisibilityIdentity, filterCanonicalCppgVisibility, filterCppgAssessmentRows, filterCppgRowsToCanonicalProjection, isCanonicalCppgContentRevision, isCanonicalCppgCourseLesson, isCanonicalCppgMockExam, isCanonicalCppgQuestion, isCanonicalCppgReviewTarget, shouldBypassCppgCurriculumCache } from "../lib/services/cppg-learner-visibility.ts";

test("CPPG visibility uses the exact canonical identity tuple, never the title", () => {
  assert.equal(classifyCppgVisibilityIdentity({ id: "course-cppg", slug: "cppg", code: "CPPG" }), "CANONICAL_CPPG_IDENTITY");
  assert.equal(classifyCppgVisibilityIdentity({ id: "legacy-cppg-sample", slug: "cppg-sample", code: "CPPG-SAMPLE" }), "UNRELATED");
  assert.equal(classifyCppgVisibilityIdentity({ id: "course-other", slug: "cppg", code: "OTHER" }), "IDENTITY_CONFLICT");
  assert.equal(classifyCppgVisibilityIdentity({ id: "course-cppg", slug: "legacy", code: "OLD" }), "IDENTITY_CONFLICT");
});

test("CPPG curriculum rows require exact current projection IDs; cache misses and revision drift fail closed", () => {
  const canonical = [{ id: "canonical-subject-01" }, { id: "canonical-subject-02" }];
  const legacy = [{ id: "sample-subject-01" }];
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-cppg", [...canonical, ...legacy], canonical.map(({ id }) => id)), canonical);
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-cppg", [...canonical, ...legacy], null), []);
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-cppg", [...canonical, ...legacy], ["new-revision-subject"]), []);
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-ordinary", legacy, null), legacy);
  assert.equal(shouldBypassCppgCurriculumCache("course-cppg"), true);
  assert.equal(shouldBypassCppgCurriculumCache("course-ordinary"), false);
});

test("legacy specialized and practical rows cannot fill domains absent from the CPPG projection", () => {
  const legacySpecialized = [{ id: "sample-legal-article-01" }];
  const legacyPractical = [{ id: "secure-code-sample-01" }];
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-cppg", legacySpecialized, []), []);
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-cppg", legacyPractical, []), []);
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-information-security-engineer", legacySpecialized, []), legacySpecialized);
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-information-security-engineer", legacyPractical, []), legacyPractical);
});

test("legacy lecture and audio identities are absent from CPPG projection and remain unavailable", () => {
  const legacyLecture = [{ id: "sample-lecture-01" }];
  const legacyAudio = [{ id: "sample-audio-01" }];
  const lectureProjectionIds: string[] = [];
  const audioProjectionIds: string[] = [];
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-cppg", legacyLecture, lectureProjectionIds), []);
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-cppg", legacyAudio, audioProjectionIds), []);
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-information-security-engineer", legacyLecture, lectureProjectionIds), legacyLecture);
  assert.deepEqual(filterCppgRowsToCanonicalProjection("course-information-security-engineer", legacyAudio, audioProjectionIds), legacyAudio);
});

test("content revision access requires exact revision and content projection identities", () => {
  const projection = {
    contentRevisionIds: ["course-cppg:revision:unit-01:v1"],
    contentIds: ["cppg-content-01"],
  };
  const canonical = { revisionId: "course-cppg:revision:unit-01:v1", contentId: "cppg-content-01", contentType: "LESSON", revisionStatus: "published", isLatest: true };
  assert.equal(isCanonicalCppgContentRevision(canonical, projection), true);
  assert.equal(isCanonicalCppgContentRevision({ ...canonical, revisionId: "legacy-revision-01" }, projection), false);
  assert.equal(isCanonicalCppgContentRevision({ ...canonical, contentId: "legacy-lecture-01" }, projection), false);
  assert.equal(isCanonicalCppgContentRevision({ ...canonical, contentType: "LECTURE" }, projection), false);
  assert.equal(isCanonicalCppgContentRevision({ ...canonical, revisionStatus: "superseded" }, projection), false);
  assert.equal(isCanonicalCppgContentRevision({ ...canonical, isLatest: false }, projection), false);
  assert.equal(isCanonicalCppgContentRevision(canonical, null), false);
});

test("assessment history is filtered by canonical question identities, never legacy records", () => {
  const rows = [
    { courseId: "course-cppg", questionId: "legacy-cppg-question", title: "legacy" },
    { courseId: "course-ordinary", questionId: "ordinary-question", title: "ordinary" },
  ];
  assert.deepEqual(filterCppgAssessmentRows(rows, []), [rows[1]]);
  assert.deepEqual(filterCppgAssessmentRows(rows, null), [rows[1]]);
  assert.deepEqual(filterCppgAssessmentRows(rows, ["legacy-cppg-question"]), rows);
  assert.equal(isCanonicalCppgQuestion("legacy-cppg-question", []), false);
  assert.equal(isCanonicalCppgQuestion("projected-question", ["projected-question"]), true);
  assert.equal(isCanonicalCppgQuestion("projected-question", null), false);
});

test("CPPG due-review targets require membership in the exact current projection domain", () => {
  const projection = {
    questionIds: ["projected-question"],
    topicIds: ["projected-topic"],
    contentIds: ["projected-content"],
  };
  assert.equal(isCanonicalCppgReviewTarget("QUESTION", "projected-question", projection), true);
  assert.equal(isCanonicalCppgReviewTarget("MOCK_EXAM_QUESTION", "projected-question", projection), true);
  assert.equal(isCanonicalCppgReviewTarget("QUESTION", "legacy-question", projection), false);
  assert.equal(isCanonicalCppgReviewTarget("MOCK_EXAM_QUESTION", "legacy-question", projection), false);
  assert.equal(isCanonicalCppgReviewTarget("TOPIC", "projected-topic", projection), true);
  assert.equal(isCanonicalCppgReviewTarget("CONTENT", "projected-content", projection), true);
  assert.equal(isCanonicalCppgReviewTarget("TOPIC", "legacy-topic", projection), false);
  assert.equal(isCanonicalCppgReviewTarget("UNKNOWN", "projected-question", projection), false);
  assert.equal(isCanonicalCppgReviewTarget("QUESTION", "legacy-question", { ...projection, questionIds: [] }), false);
  assert.equal(isCanonicalCppgReviewTarget("QUESTION", "projected-question", null), false);
});

test("CPPG mock exams require both an exact projected exam ID and all exact projected question IDs", () => {
  const projection = { mockExamIds: ["canonical-exam"], questionIds: ["canonical-question-01", "canonical-question-02"] };
  assert.equal(isCanonicalCppgMockExam("canonical-exam", ["canonical-question-01", "canonical-question-02"], projection), true);
  assert.equal(isCanonicalCppgMockExam("legacy-exam", ["canonical-question-01"], projection), false);
  assert.equal(isCanonicalCppgMockExam("canonical-exam", ["legacy-question"], projection), false);
  assert.equal(isCanonicalCppgMockExam("canonical-exam", [], projection), false);
  assert.equal(isCanonicalCppgMockExam("canonical-exam", ["canonical-question-01"], null), false);
  assert.equal(isCanonicalCppgMockExam("legacy-exam", ["legacy-question"], { mockExamIds: [], questionIds: [] }), false);
});

test("CPPG course-lesson progress requires exact projected lesson and content identities", () => {
  const projection = { courseLessonIds: ["projected-course-lesson"], contentIds: ["projected-content"] };
  assert.equal(isCanonicalCppgCourseLesson("course-cppg", "projected-course-lesson", "projected-content", projection), true);
  assert.equal(isCanonicalCppgCourseLesson("course-cppg", "legacy-course-lesson", "projected-content", projection), false);
  assert.equal(isCanonicalCppgCourseLesson("course-cppg", "projected-course-lesson", "legacy-content", projection), false);
  assert.equal(isCanonicalCppgCourseLesson("course-cppg", "projected-course-lesson", "projected-content", null), false);
  assert.equal(isCanonicalCppgCourseLesson("course-ordinary", "legacy-course-lesson", "legacy-content", null), true);
});

test("public discovery keeps non-CPPG behavior and requires publication proof for exact CPPG identity", async () => {
  const legacy = { id: "course-cppg", slug: "cppg", code: "CPPG", active: true, published: true, isSample: true };
  const ordinary = { id: "course-other", slug: "other", code: "OTHER", active: true, published: true };
  const registrationOnly = await filterCanonicalCppgVisibility([legacy, ordinary], async (course) =>
    classifyCppgVisibilityIdentity(course) === "UNRELATED");
  assert.deepEqual(registrationOnly, [ordinary]);
  const published = await filterCanonicalCppgVisibility([legacy, ordinary], async (course) =>
    classifyCppgVisibilityIdentity(course) === "UNRELATED" || course.id === "course-cppg");
  assert.deepEqual(published, [legacy, ordinary]);
});
