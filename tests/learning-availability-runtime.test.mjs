import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startVinextTestServer } from "./support/vinext-test-server.mjs";

let server;

before(async () => {
  server = await startVinextTestServer({
    label: "Learning availability runtime",
    env: { WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
  });
});

after(async () => {
  await server?.stop();
});

async function get(path, email) {
  return fetch(`${server.baseUrl}${path}`, {
    headers: email ? { "oai-authenticated-user-email": email } : undefined,
  });
}

test("base local fixture keeps published practice available without sample theory", async () => {
  const catalog = await get("/courses?status=available");
  const catalogHtml = await catalog.text();
  assert.equal(catalog.status, 200);
  assert.match(catalogHtml, /course-(?:isms-p|isrm|cppg)/);

  const detail = await get("/courses/isms-p");
  const detailHtml = await detail.text();
  assert.equal(detail.status, 200);
  assert.doesNotMatch(detailHtml, /course-unavailable/);
  assert.match(detailHtml, /35문제/);
  assert.doesNotMatch(detailHtml, /course-lesson-isms-access-control/);
});

test("practice-only course keeps authenticated practice and mock-exam routes reachable", async () => {
  const email = "dev-user-1@example.invalid";
  const practice = await get("/practice/isms-p?count=10", email);
  const practiceHtml = await practice.text();
  assert.equal(practice.status, 200);
  assert.match(practiceHtml, /data-practice-focus-v2/);
  assert.match(practiceHtml, /data-practice-session-v2/);

  const mockExams = await get("/mock-exams", email);
  const mockExamsHtml = await mockExams.text();
  assert.equal(mockExams.status, 200);
  assert.match(mockExamsHtml, /data-mock-exam-entry-v2/);
  assert.match(mockExamsHtml, /course-isms-p-mock-quick/);
});

test("sample theory is absent from learner and subject routes while enrollment remains gated", async () => {
  const email = "dev-user-1@example.invalid";
  const unauthenticated = await fetch(`${server.baseUrl}/learn/isms-p`, {
    redirect: "manual",
  });
  assert.ok([302, 307].includes(unauthenticated.status));

  const overview = await get("/learn/isms-p", email);
  const overviewHtml = await overview.text();
  assert.equal(overview.status, 200);
  assert.doesNotMatch(overviewHtml, /course-lesson-isms-access-control/);

  const subject = await get(
    "/learn/isms-p/subjects/course-isms-p-subject-foundation",
    email,
  );
  const subjectHtml = await subject.text();
  assert.equal(subject.status, 200);
  assert.doesNotMatch(subjectHtml, /\/learn\/isms-p\/lessons\//);

  const sampleLesson = await get(
    "/learn/isms-p/course-lessons/course-lesson-isms-access-control",
    email,
  );
  assert.equal(sampleLesson.status, 404);

  const crossCourseLesson = await get(
    "/learn/isms-p/course-lessons/course-lesson-cppg-access-control",
    email,
  );
  assert.equal(crossCourseLesson.status, 404);
});

test("unregistered Python 8H identity remains unavailable", async () => {
  const response = await get("/courses/secure-coding-8h-python-vibe");
  assert.equal(response.status, 404);
});
