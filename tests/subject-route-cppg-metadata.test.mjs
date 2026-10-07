import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { filterCppgRowsToCanonicalProjection } from "../lib/services/cppg-learner-visibility.ts";

// Execute the actual route with synthetic server-owned publication and repository
// results. The production membership filter and React rendering are not mocked.
const require = createRequire(import.meta.url);
const route = ts.transpileModule(readFileSync("app/learn/[courseSlug]/subjects/[subjectId]/page.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

async function renderSubject(overrides = {}) {
  const course = { id: "course-cppg", slug: "cppg", shortName: "CPPG" };
  const subject = { id: "cppg:subject:1", courseId: course.id, name: "Approved subject", description: "Approved description" };
  const state = {
    course, subject, enrolled: true,
    projection: { subjectIds: [subject.id], topicIds: ["approved-topic"] },
    topics: [{ id: "approved-topic", name: "Approved topic" }, { id: "extra-topic", name: "PRIVATE EXTRA TOPIC", description: "PRIVATE DESCRIPTION" }],
    canonical: true, ...overrides,
  };
  const calls = [];
  const lesson = { id: "canonical-lesson", title: "Approved lesson", summary: "Summary", status: "COMPLETED", progressPercent: 100, estimatedMinutes: 10 };
  const progress = { totalLessons: 1, completedLessons: 1, progressPercent: 100, lessons: [lesson] };
  const fail = (message) => { throw new Error(message); };
  const stubs = {
    "next/link": ({ href, children, ...props }) => createElement("a", { href, ...props }, children),
    "next/navigation": { notFound: () => fail("NOT_FOUND"), redirect: (url) => fail(`REDIRECT:${url}`) },
    "@/components/progress-bar": { ProgressBar: () => null },
    "@/components/state-ui": { EmptyState: () => null },
    "@/components/v2/learn-experience.module.css": {},
    "@/lib/auth": { requireCurrentAppUser: async () => { calls.push("auth"); return { id: "learner" }; } },
    "@/lib/public-copy": { publicCopy: (value) => value ?? "" },
    "@/db/repositories": {
      getPublicCourseBySlug: async () => state.course,
      getSubjectById: async (id) => { assert.equal(id, state.subject.id); return state.subject; },
      getEnrollmentForCourse: async () => state.enrolled ? {} : null,
      listTopicsForSubject: async () => { calls.push("topics"); return state.topics; },
    },
    "@/lib/services/cppg-learner-visibility": {
      filterCppgRowsToCanonicalProjection,
      getCanonicalCppgLearnerRowIds: async () => { calls.push("projection"); return state.projection; },
    },
    "@/db/shared-content-repositories": { listPublishedCourseLessonsForUser: async () => {
      calls.push("canonical"); return state.canonical ? progress : { ...progress, totalLessons: 0, lessons: [] };
    } },
    "@/db/lesson-repositories": {
      listPublishedLearningUnitsForSubject: async () => { calls.push("legacy"); return [{ id: "legacy-unit", title: "Legacy", lessons: [{ ...lesson, id: "legacy-lesson" }] }]; },
      getSubjectTheoryProgress: async () => progress,
    },
  };
  const exports = {};
  runInNewContext(route, { exports, require: (id) => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id === "react/jsx-runtime") return require(id);
    throw new Error(`Unexpected route dependency: ${id}`);
  } });
  try {
    const tree = await exports.default({ params: Promise.resolve({ courseSlug: state.course?.slug ?? "cppg", subjectId: encodeURIComponent(state.subject.id) }) });
    return { html: renderToStaticMarkup(tree), calls };
  } catch (error) {
    error.calls = calls;
    throw error;
  }
}

test("same-course noncanonical CPPG subject is denied before topics or lesson lookups", async () => {
  await assert.rejects(renderSubject({ subject: { id: "extra-subject", courseId: "course-cppg", name: "PRIVATE SUBJECT" } }), (error) => {
    assert.equal(error.message, "NOT_FOUND");
    assert.deepEqual(error.calls, ["auth", "projection"]);
    return true;
  });
});

test("canonical CPPG subject renders only canonical topic metadata and canonical lesson links", async () => {
  const { html, calls } = await renderSubject();
  assert.match(html, /Approved subject/);
  assert.match(html, /Approved topic/);
  assert.doesNotMatch(html, /PRIVATE EXTRA TOPIC|PRIVATE DESCRIPTION/);
  assert.match(html, /전체 주제 1개/);
  assert.match(html, /\/learn\/cppg\/course-lessons\/canonical-lesson/);
  assert.match(html, /100%/);
  assert.ok(!calls.includes("legacy"));
});

for (const projection of [null, { subjectIds: [], topicIds: [] }]) {
  test(`missing or empty canonical publication projection denies subject (${projection === null ? "null" : "empty"})`, async () => {
    await assert.rejects(renderSubject({ projection }), /NOT_FOUND/);
  });
}

test("canonical subject with no projected topics does not reveal repository topics", async () => {
  const { html } = await renderSubject({ projection: { subjectIds: ["cppg:subject:1"], topicIds: [] } });
  assert.doesNotMatch(html, /Approved topic|PRIVATE|전체 주제/);
});

test("unpublished CPPG course remains unavailable", async () => {
  await assert.rejects(renderSubject({ course: null }), /NOT_FOUND/);
});

test("cross-course subjects remain unavailable", async () => {
  await assert.rejects(renderSubject({ subject: { id: "foreign", courseId: "other" } }), /NOT_FOUND/);
});

test("unenrolled learner redirects before publication row resolution", async () => {
  await assert.rejects(renderSubject({ enrolled: false }), (error) => {
    assert.equal(error.message, "REDIRECT:/courses/cppg");
    assert.deepEqual(error.calls, ["auth"]);
    return true;
  });
});

test("unrelated course preserves topic metadata and legacy-only theory fallback", async () => {
  const { html, calls } = await renderSubject({
    course: { id: "course-isms-p", slug: "isms-p", shortName: "ISMS-P" },
    subject: { id: "isms-subject", courseId: "course-isms-p", name: "ISMS subject" },
    projection: null, canonical: false,
  });
  assert.match(html, /Approved topic/);
  assert.match(html, /PRIVATE EXTRA TOPIC/);
  assert.match(html, /\/learn\/isms-p\/lessons\/legacy-lesson/);
  assert.ok(calls.includes("legacy"));
});
