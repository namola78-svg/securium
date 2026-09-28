import assert from "node:assert/strict";
import test from "node:test";
import {
  assertGenericCppgPublicationAllowed,
  assertGenericCppgStatusPublicationAllowed,
  CPPG_PUBLICATION_GATE_REQUIRED,
  isCppgPublicationTarget,
} from "../lib/services/cppg-generic-publication-guard.ts";

function denied(operation: () => void) {
  assert.throws(operation, (error: unknown) =>
    typeof error === "object" && error !== null &&
    "code" in error && error.code === CPPG_PUBLICATION_GATE_REQUIRED,
  );
}

test("CPPG target matching uses exact course identity fields, not labels", () => {
  assert.equal(isCppgPublicationTarget({ courseId: "course-cppg" }), true);
  assert.equal(isCppgPublicationTarget({ courseSlug: "CPPG" }), true);
  assert.equal(isCppgPublicationTarget({ courseCode: "cppg" }), true);
  assert.equal(isCppgPublicationTarget({ courseId: "course-other", courseSlug: "other", courseCode: "OTHER", courseName: "CPPG" } as never), false);
});

test("generic course, lesson, and unit writes cannot elevate either visibility flag", () => {
  for (const requested of [{ active: true }, { published: true }, { active: true, published: true }]) {
    denied(() => assertGenericCppgPublicationAllowed({ courseId: "course-cppg" }, { active: false, published: false }, requested));
  }
  assert.doesNotThrow(() => assertGenericCppgPublicationAllowed({ courseId: "course-cppg" }, { active: false, published: false }, { active: false, published: false }));
  assert.doesNotThrow(() => assertGenericCppgPublicationAllowed({ courseId: "course-cppg" }, { active: true, published: true }, { active: true, published: true }));
  assert.doesNotThrow(() => assertGenericCppgPublicationAllowed({ courseId: "course-other" }, { active: false, published: false }, { active: true, published: true }));
  denied(() => assertGenericCppgPublicationAllowed(
    { courseId: "course-other", courseSlug: "cppg", courseCode: "CPPG" },
    { active: true, published: true },
    { active: true, published: true },
    { courseId: "course-other", courseSlug: "other", courseCode: "OTHER" },
  ));
  denied(() => assertGenericCppgPublicationAllowed(
    { courseId: "course-other", courseSlug: "other", courseCode: "OTHER" },
    { active: false, published: false },
    { active: true, published: true },
    { courseId: "course-other", courseSlug: "cppg", courseCode: "CPPG" },
  ));
  denied(() => assertGenericCppgPublicationAllowed(
    { courseId: "course-other", courseSlug: "other", courseCode: "OTHER" },
    { active: false, published: false },
    { active: true, published: true },
    { courseId: "course-other", courseSlug: "cppg", courseCode: "OTHER" },
  ));
  assert.doesNotThrow(() => assertGenericCppgPublicationAllowed(
    { courseId: "course-other", courseSlug: "cppg", courseCode: "CPPG" },
    { active: true, published: false },
    { active: true, published: false },
    { courseId: "course-other", courseSlug: "other", courseCode: "OTHER" },
  ));
});

test("generic revision and course-link publication is denied only for CPPG transitions", () => {
  denied(() => assertGenericCppgStatusPublicationAllowed({ courseId: "course-cppg" }, "review", "published", "published"));
  denied(() => assertGenericCppgStatusPublicationAllowed({ courseId: "course-cppg" }, "DRAFT", "PUBLISHED", "PUBLISHED"));
  assert.doesNotThrow(() => assertGenericCppgStatusPublicationAllowed({ courseId: "course-cppg" }, "PUBLISHED", "PUBLISHED", "PUBLISHED"));
  assert.doesNotThrow(() => assertGenericCppgStatusPublicationAllowed({ courseId: "course-other" }, "review", "published", "published"));
  assert.doesNotThrow(() => assertGenericCppgStatusPublicationAllowed({}, "DRAFT", "PUBLISHED", "PUBLISHED"));
});
