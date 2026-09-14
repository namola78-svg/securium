import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { startVinextTestServer } from "./support/vinext-test-server.mjs";

const AVAILABLE_LABEL = "\uD559\uC2B5 \uAC00\uB2A5";
const PLANNED_LABEL = "\uAC1C\uC124 \uC608\uC815";
const EMPTY_STATE_LABEL = "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uACFC\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4";
const HTTP_REQUEST_TIMEOUT_MS = 15_000;
const FIXTURE_EXECUTION_TIMEOUT_MS = 60_000;

const FIXTURE = Object.freeze({
  groupId: "http-contract-fixture-group",
  authorId: "http-contract-fixture-author",
  courses: Object.freeze({
    question: {
      id: "http-contract-course-question",
      slug: "http-contract-question",
      name: "HTTP contract fixture published question",
      displayOrder: 1,
    },
    lesson: {
      id: "http-contract-course-lesson",
      slug: "http-contract-lesson",
      name: "HTTP contract fixture published lesson",
      displayOrder: 2,
    },
    outline: {
      id: "http-contract-course-outline",
      slug: "http-contract-outline",
      name: "HTTP contract fixture outline-only course with a deliberately long name",
      displayOrder: 3,
    },
    draft: {
      id: "http-contract-course-draft",
      slug: "http-contract-draft",
      name: "HTTP contract fixture draft-only content",
      displayOrder: 4,
    },
    crossCourse: {
      id: "http-contract-course-cross-course",
      slug: "http-contract-cross-course",
      name: "HTTP contract fixture content belongs to another course",
      displayOrder: 5,
    },
    unpublished: {
      id: "http-contract-course-unpublished",
      slug: "http-contract-unpublished",
      name: "HTTP contract fixture unpublished course",
      displayOrder: 6,
    },
    inactive: {
      id: "http-contract-course-inactive",
      slug: "http-contract-inactive",
      name: "HTTP contract fixture inactive course",
      displayOrder: 7,
    },
  }),
});

const PUBLIC_COURSES = [
  FIXTURE.courses.question,
  FIXTURE.courses.lesson,
  FIXTURE.courses.outline,
  FIXTURE.courses.draft,
  FIXTURE.courses.crossCourse,
];

let server;
let baseUrl = "";

before(async () => {
  try {
    assert.equal(process.env.DB_PROVIDER, "d1");
    assert.equal(process.env.D1_TEST_MODE, "1");
    assert.ok(
      process.env.D1_TEST_PERSIST_PATH,
      "the existing D1 runner must provide owned persistence",
    );
    assert.equal(process.env.DATABASE_URL, undefined);
    assert.equal(process.env.DIRECT_URL, undefined);
    assert.equal(process.env.POSTGRES_SEED_URL, undefined);
    assert.equal(process.env.POSTGRES_MIGRATION_URL, undefined);
    assert.equal(process.env.POSTGRES_VERIFY_URL, undefined);

    await executeOwnedD1(buildFixtureSql());
    server = await startVinextTestServer({
      label: "Public course availability HTTP contract",
    });
    baseUrl = server.baseUrl;
    assert.match(baseUrl, /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/);
    console.log(
      `PUBLIC_AVAILABILITY_HTTP_SERVER_READY pid=${server.childPid} origin=${baseUrl} port=${server.port} persistence=owned`,
    );
  } catch (error) {
    try {
      await stopServer();
    } catch (cleanupError) {
      console.error(
        `PUBLIC_AVAILABILITY_HTTP_SERVER_CLEANUP FAIL ${cleanupError?.message ?? cleanupError}`,
      );
    }
    throw error;
  }
});

after(async () => {
  await stopServer();
});

test("public catalog renders availability from published question/lesson relations", async () => {
  const response = await fetchHtml(
    "/courses?q=HTTP%20contract%20fixture",
  );

  for (const course of PUBLIC_COURSES) {
    const card = courseCard(response.html, course);
    assert.ok(card, `${course.slug} must have a scoped server-rendered card`);
    assert.match(card, new RegExp(escapeRegExp(course.name)));
  }

  assert.equal(courseCard(response.html, FIXTURE.courses.unpublished), null);
  assert.equal(courseCard(response.html, FIXTURE.courses.inactive), null);
  assertAvailableCard(response.html, FIXTURE.courses.question);
  assertAvailableCard(response.html, FIXTURE.courses.lesson);
  assertPlannedCard(response.html, FIXTURE.courses.outline);
  assertPlannedCard(response.html, FIXTURE.courses.draft);
  assertPlannedCard(response.html, FIXTURE.courses.crossCourse);
});

test("server-side availability filters select only the matching fixture cards", async () => {
  const available = await fetchHtml(
    "/courses?q=HTTP%20contract%20fixture&status=available",
  );
  assertFixtureCardPresence(available.html, {
    question: true,
    lesson: true,
    outline: false,
    draft: false,
    crossCourse: false,
  });

  const planned = await fetchHtml(
    "/courses?q=HTTP%20contract%20fixture&status=planned",
  );
  assertFixtureCardPresence(planned.html, {
    question: false,
    lesson: false,
    outline: true,
    draft: true,
    crossCourse: true,
  });
});

test("public detail responses preserve the card availability contract", async () => {
  for (const course of [FIXTURE.courses.question, FIXTURE.courses.lesson]) {
    const response = await fetchHtml(`/courses/${course.slug}`);
    assert.match(response.html, new RegExp(`<h1[^>]*>${escapeRegExp(course.name)}`));
    assert.doesNotMatch(response.html, /class="enroll-action course-unavailable"/);
    assert.doesNotMatch(response.html, new RegExp(escapeRegExp(PLANNED_LABEL)));
  }

  for (const course of [
    FIXTURE.courses.outline,
    FIXTURE.courses.draft,
    FIXTURE.courses.crossCourse,
  ]) {
    const response = await fetchHtml(`/courses/${course.slug}`);
    const cta = detailCta(response.html);
    assert.match(cta, /class="enroll-action course-unavailable"/);
    assert.match(cta, new RegExp(`class="course-status planned">${escapeRegExp(PLANNED_LABEL)}`));
  }
});

test("public selection excludes unpublished and inactive detail routes", async () => {
  for (const course of [FIXTURE.courses.unpublished, FIXTURE.courses.inactive]) {
    const response = await fetch(`${baseUrl}/courses/${course.slug}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(HTTP_REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();
    assert.equal(response.status, 404, `${course.slug}: ${body.slice(0, 600)}`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    assert.doesNotMatch(body, new RegExp(escapeRegExp(course.name)));
  }
});

test("public catalog renders the supported empty result response", async () => {
  const response = await fetchHtml(
    "/courses?q=HTTP%20contract%20fixture%20does%20not%20exist",
  );
  assert.match(response.html, new RegExp(escapeRegExp(EMPTY_STATE_LABEL)));
  for (const course of PUBLIC_COURSES) {
    assert.equal(courseCard(response.html, course), null);
  }
});

async function fetchHtml(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(HTTP_REQUEST_TIMEOUT_MS),
  });
  const html = await response.text();
  assert.equal(response.status, 200, `${path}: ${html.slice(0, 900)}`);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
    `${path} must return server-rendered HTML`,
  );
  console.log(
    `PUBLIC_AVAILABILITY_HTTP_RESPONSE path=${path} status=${response.status} contentType=${response.headers.get("content-type")}`,
  );
  return { response, html };
}

function courseCard(html, course) {
  const match = html.match(
    new RegExp(
      `<article[^>]*aria-labelledby="course-${escapeRegExp(course.id)}"[^>]*>([\\s\\S]*?)<\\/article>`,
    ),
  );
  return match?.[1] ?? null;
}

function detailCta(html) {
  const match = html.match(
    /<aside[^>]*class="enroll-panel course-detail-cta"[^>]*>([\s\S]*?)<\/aside>/,
  );
  assert.ok(match, "detail response must contain the scoped course CTA panel");
  return match[1];
}

function assertAvailableCard(html, course) {
  const card = courseCard(html, course);
  assert.ok(card, `${course.slug} available card is missing`);
  assert.match(
    card,
    new RegExp(`class="course-status available">${escapeRegExp(AVAILABLE_LABEL)}<\\/span>`),
  );
  assert.match(card, new RegExp(`href="/courses/${escapeRegExp(course.slug)}"`));
  assert.match(card, /course-card-cta/);
  assert.doesNotMatch(card, new RegExp(escapeRegExp(PLANNED_LABEL)));
}

function assertPlannedCard(html, course) {
  const card = courseCard(html, course);
  assert.ok(card, `${course.slug} planned card is missing`);
  assert.match(
    card,
    new RegExp(`class="course-status planned">${escapeRegExp(PLANNED_LABEL)}<\\/span>`),
  );
  assert.match(card, /disabled/);
  assert.doesNotMatch(card, new RegExp(`href="/courses/${escapeRegExp(course.slug)}"`));
  assert.doesNotMatch(card, new RegExp(escapeRegExp(AVAILABLE_LABEL)));
}

function assertFixtureCardPresence(html, expected) {
  for (const [key, present] of Object.entries(expected)) {
    const course = FIXTURE.courses[key];
    assert.equal(Boolean(courseCard(html, course)), present, `${key} card presence mismatch`);
  }
}

function buildFixtureSql() {
  const c = FIXTURE.courses;
  return [
    "PRAGMA foreign_keys = ON",
    `INSERT INTO course_groups (id, code, name, description, display_order, active, is_sample) VALUES (${sql(FIXTURE.groupId)}, 'HTTP_CONTRACT_FIXTURE', 'HTTP contract fixture group', 'Synthetic public course availability fixture', 9000, 1, 0)`,
    `INSERT INTO users (id, email, display_name, status) VALUES (${sql(FIXTURE.authorId)}, 'http-contract-fixture-author@example.invalid', 'HTTP contract fixture author', 'ACTIVE')`,
    ...Object.values(c).map((course) =>
      `INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description, total_levels, passing_score, difficulty, active, published, display_order, is_sample) VALUES (${sql(course.id)}, ${sql(FIXTURE.groupId)}, ${sql(course.id.toUpperCase())}, ${sql(course.slug)}, ${sql(course.name)}, ${sql(course.name)}, ${sql(`Synthetic fixture for ${course.slug}`)}, 1, 60, 'BEGINNER', ${course === c.inactive ? 0 : 1}, ${course === c.unpublished ? 0 : 1}, ${course.displayOrder}, 0)`,
    ),
    `INSERT INTO subjects (id, course_id, code, name, description, display_order, active, is_sample) VALUES ('http-contract-subject-outline', ${sql(c.outline.id)}, 'OUTLINE', 'HTTP contract outline subject', 'Synthetic outline-only subject', 1, 1, 0)`,
    `INSERT INTO topics (id, subject_id, code, name, description, display_order, active, is_sample) VALUES ('http-contract-topic-outline', 'http-contract-subject-outline', 'OUTLINE-1', 'HTTP contract outline topic', 'Synthetic outline-only topic', 1, 1, 0)`,
    `INSERT INTO questions (id, title, content, type, difficulty, explanation, wrong_answer_explanation, status, version, answer_config_json, is_sample, created_by, published_at) VALUES ('http-contract-question-published', 'HTTP contract published question', 'Synthetic published question body', 'SINGLE_CHOICE', 'EASY', '', '', 'PUBLISHED', 1, '{}', 0, ${sql(FIXTURE.authorId)}, CURRENT_TIMESTAMP)`,
    `INSERT INTO questions (id, title, content, type, difficulty, explanation, wrong_answer_explanation, status, version, answer_config_json, is_sample, created_by) VALUES ('http-contract-question-draft', 'HTTP contract draft question', 'Synthetic draft question body', 'SINGLE_CHOICE', 'EASY', '', '', 'DRAFT', 1, '{}', 0, ${sql(FIXTURE.authorId)})`,
    `INSERT INTO question_courses (question_id, course_id, weight) VALUES ('http-contract-question-published', ${sql(c.question.id)}, 100)`,
    `INSERT INTO question_courses (question_id, course_id, weight) VALUES ('http-contract-question-draft', ${sql(c.draft.id)}, 100)`,
    `INSERT INTO contents (id, slug, canonical_key, title, summary, body, body_format, version, status, created_by) VALUES ('http-contract-content-published', 'http-contract-content-published', 'http.contract.published', 'HTTP contract published lesson', 'Synthetic published lesson summary', 'Synthetic published lesson body', 'PLAIN_TEXT', '1.0.0', 'PUBLISHED', ${sql(FIXTURE.authorId)})`,
    `INSERT INTO contents (id, slug, canonical_key, title, summary, body, body_format, version, status, created_by) VALUES ('http-contract-content-draft', 'http-contract-content-draft', 'http.contract.draft', 'HTTP contract draft lesson', 'Synthetic draft lesson summary', 'Synthetic draft lesson body', 'PLAIN_TEXT', '1.0.0', 'DRAFT', ${sql(FIXTURE.authorId)})`,
    `INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, estimated_minutes, is_required, completion_rule, status) VALUES ('http-contract-lesson-published', ${sql(c.lesson.id)}, 'http-contract-content-published', 'HTTP contract published lesson', 1, 10, 1, 'MANUAL', 'PUBLISHED')`,
    `INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, estimated_minutes, is_required, completion_rule, status) VALUES ('http-contract-lesson-draft-content', ${sql(c.draft.id)}, 'http-contract-content-draft', 'HTTP contract draft content lesson', 1, 10, 1, 'MANUAL', 'PUBLISHED')`,
  ].join(";\n") + ";";
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function executeOwnedD1(statement) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let forceKillTimer;
    const child = spawn(
      process.execPath,
      [
        "scripts/run-wrangler.mjs",
        "d1",
        "execute",
        "DB",
        "--local",
        "--config",
        "wrangler.local.jsonc",
        "--command",
        statement,
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 5_000);
      reject(
        new Error(
          `Owned D1 fixture timed out after ${FIXTURE_EXECUTION_TIMEOUT_MS}ms.`,
        ),
      );
    }, FIXTURE_EXECUTION_TIMEOUT_MS);
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      clearTimeout(forceKillTimer);
      if (settled) return;
      settled = true;
      if (code === 0) resolve(output);
      else reject(new Error(`Owned D1 fixture failed (${code}).\n${output}`));
    });
  });
}

async function stopServer() {
  const runningServer = server;
  server = undefined;
  await runningServer?.stop();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\[\]\\]/g, "\\$&");
}
