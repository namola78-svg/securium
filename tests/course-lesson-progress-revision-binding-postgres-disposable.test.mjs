import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { startVinextTestServer } from "./support/vinext-test-server.mjs";

const execFile = promisify(execFileCallback);
const runId = randomUUID();
const userOne = "pg-revision-user-1";
const userTwo = "pg-revision-user-2";
const courseA = "pg-revision-course-a";
const courseB = "pg-revision-course-b";
const lessonA = "pg-revision-lesson-a";
const lessonFailure = "pg-revision-lesson-failure";
const lessonConcurrent = "pg-revision-lesson-concurrent";
const lessonOther = "pg-revision-lesson-other";
const contentA = "pg-revision-content-a";
const contentB = "pg-revision-content-b";
const contentFailure = "pg-revision-content-failure";
const contentConcurrent = "pg-revision-content-concurrent";
const contentOther = "pg-revision-content-other";

let container;
let client;
let server;
let postgresUrl;

before(async () => {
  container = `securium-course-lesson-revision-${runId}`;
  const password = "course-lesson-revision-test-password";
  await execFile("docker", [
    "run", "--detach", "--rm", "--name", container,
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--publish", "127.0.0.1::5432", "postgres:17.6",
  ]);
  const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port, "Disposable PostgreSQL port was not published.");
  postgresUrl = `postgres://postgres:${password}@127.0.0.1:${port}/postgres`;
  const postgres = (await import("postgres")).default;
  client = postgres(postgresUrl, {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: false,
  });
  await waitForConnection();
  await client.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;");

  const migrations = (await readdir("db/postgres/migrations"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .filter((name) => !["0002_server_only_rls_lockdown.sql", "0009_security_certification_taxonomy_cleanup.sql"].includes(name))
    .sort();
  for (const name of migrations) {
    await client.unsafe(await readFile(`db/postgres/migrations/${name}`, "utf8"));
  }
  const ledger = await client.unsafe("SELECT count(*)::int AS count FROM app_schema_migrations");
  assert.equal(Number(ledger[0].count), migrations.length);
  await seedFixture();

  server = await startVinextTestServer({
    label: "CourseLesson revision binding PostgreSQL repository",
    env: {
      APP_ENV: "test",
      NODE_ENV: "test",
      AUTH_PROVIDER: "chatgpt",
      SECURIUM_POSTGRES_TEST_MODE: "1",
      DB_PROVIDER: "supabase",
      DATABASE_URL: postgresUrl,
      DIRECT_URL: postgresUrl,
      // postgres.js requires max: 1 for the transaction helper used by the
      // D1 compatibility batch path. Concurrent HTTP requests still exercise
      // the repository's idempotent conflict handling through the queue.
      POSTGRES_MAX_CONNECTIONS: "1",
      POSTGRES_CONNECT_TIMEOUT_SECONDS: "10",
      POSTGRES_QUERY_TIMEOUT_MS: "30000",
      POSTGRES_SSL_MODE: "disable",
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
    },
  });
});

after(async () => {
  await client?.unsafe("DROP FUNCTION IF EXISTS test_course_lesson_progress_activity_failure() CASCADE").catch(() => {});
  await server?.stop().catch(() => {});
  await client?.end({ timeout: 5 }).catch(() => {});
  if (container) await execFile("docker", ["rm", "--force", container]).catch(() => {});
});

test("PostgreSQL migration and app repository preserve CourseLesson revision identity", async () => {
  const first = await save(userOne, {
    courseLessonId: lessonA,
    contentId: contentA,
    contentVersion: "A",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 12,
  });
  assert.equal(first.response.status, 200, JSON.stringify({
    payload: first.payload,
    server: server?.diagnostics,
  }));
  assert.equal(first.payload.result.contentId, contentA);
  assert.equal(first.payload.result.contentVersion, "A");

  assert.deepEqual(await progressRows(lessonA), [
    { contentId: contentA, contentVersion: "A", status: "COMPLETED" },
  ]);

  await client.unsafe(`
    UPDATE course_lessons SET content_id = '${contentB}' WHERE id = '${lessonA}';
    UPDATE contents SET version = 'A' WHERE id = '${contentB}';
  `);
  const staleContent = await save(userOne, {
    courseLessonId: lessonA,
    contentId: contentA,
    contentVersion: "A",
    action: "COMPLETE",
    progressPercent: 100,
  });
  assert.equal(staleContent.response.status, 409);
  assert.equal(staleContent.payload.code, "COURSE_LESSON_REVISION_MISMATCH");

  await client.unsafe(`
    UPDATE course_lessons SET content_id = '${contentA}' WHERE id = '${lessonA}';
    UPDATE contents SET version = 'B' WHERE id = '${contentA}';
  `);
  for (const body of [
    { contentId: contentA, contentVersion: "A" },
    { contentId: "forged-content", contentVersion: "B" },
  ]) {
    const stale = await save(userOne, {
      courseLessonId: lessonA,
      ...body,
      action: "COMPLETE",
      progressPercent: 100,
    });
    assert.equal(stale.response.status, 409, JSON.stringify(stale.payload));
    assert.equal(stale.payload.code, "COURSE_LESSON_REVISION_MISMATCH");
  }

  const second = await save(userOne, {
    courseLessonId: lessonA,
    contentId: contentA,
    contentVersion: "B",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 14,
  });
  assert.equal(second.response.status, 200, JSON.stringify(second.payload));
  const replay = await save(userOne, {
    courseLessonId: lessonA,
    contentId: contentA,
    contentVersion: "B",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 14,
  });
  assert.equal(replay.response.status, 200, JSON.stringify(replay.payload));
  assert.equal(replay.payload.result.idempotentReplay, true);
  assert.deepEqual(await progressRows(lessonA), [
    { contentId: contentA, contentVersion: "A", status: "COMPLETED" },
    { contentId: contentA, contentVersion: "B", status: "COMPLETED" },
  ]);
  const activityRows = await client.unsafe(
    `SELECT id, metadata_json AS "metadataJson" FROM learning_activities WHERE target_id = '${lessonA}' ORDER BY id`,
  );
  assert.equal(activityRows.length, 2);
  assert.deepEqual(activityRows.map((row) => JSON.parse(row.metadataJson).contentId), [contentA, contentA]);

  const concurrent = await Promise.all(
    Array.from({ length: 4 }, () => save(userOne, {
      courseLessonId: lessonConcurrent,
      contentId: contentConcurrent,
      contentVersion: "C",
      action: "COMPLETE",
      progressPercent: 100,
    })),
  );
  assert.ok(concurrent.every((result) => result.response.status === 200), JSON.stringify(concurrent.map((result) => result.payload)));
  const concurrentRows = await progressRows(lessonConcurrent);
  assert.deepEqual(concurrentRows, [
    { contentId: contentConcurrent, contentVersion: "C", status: "COMPLETED" },
  ]);
  const concurrentActivities = await client.unsafe(`SELECT count(*)::int AS count FROM learning_activities WHERE target_id = '${lessonConcurrent}'`);
  assert.equal(Number(concurrentActivities[0].count), 1);

  const legacyRows = Array.from(await client.unsafe(`
    INSERT INTO user_course_lesson_progress
      (id, user_id, course_id, course_lesson_id, content_id, content_version, status, progress_percent, completed_at, last_viewed_at, time_spent_seconds, last_studied_at)
    VALUES ('pg-legacy-progress', '${userOne}', '${courseA}', '${lessonFailure}', NULL, NULL, 'COMPLETED', 100, CURRENT_TIMESTAMP::text, CURRENT_TIMESTAMP::text, 5, CURRENT_TIMESTAMP::text)
    RETURNING content_id AS "contentId", content_version AS "contentVersion", status
  `));
  assert.deepEqual(legacyRows, [{ contentId: null, contentVersion: null, status: "COMPLETED" }]);
  const current = await save(userOne, {
    courseLessonId: lessonFailure,
    contentId: contentFailure,
    contentVersion: "FAIL",
    action: "START",
    progressPercent: 10,
    timeSpentSeconds: 6,
  });
  assert.equal(current.response.status, 200, JSON.stringify(current.payload));
  assert.deepEqual(await progressRows(lessonFailure), [
    { contentId: null, contentVersion: null, status: "COMPLETED" },
    { contentId: contentFailure, contentVersion: "FAIL", status: "IN_PROGRESS" },
  ]);

  await client.unsafe(`
    CREATE OR REPLACE FUNCTION test_course_lesson_progress_activity_failure()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'intentional activity failure';
    END;
    $$;
    CREATE TRIGGER test_course_lesson_progress_activity_failure
      BEFORE INSERT ON learning_activities
      FOR EACH ROW WHEN (NEW.id = 'course-lesson-completed:${userOne}:${lessonFailure}:${contentFailure}:FAIL')
      EXECUTE FUNCTION test_course_lesson_progress_activity_failure();
  `);
  try {
    const failed = await save(userOne, {
      courseLessonId: lessonFailure,
      contentId: contentFailure,
      contentVersion: "FAIL",
      action: "COMPLETE",
      progressPercent: 100,
    });
    assert.ok(failed.response.status >= 400, JSON.stringify(failed.payload));
    const failedRows = Array.from(await client.unsafe(`
      SELECT status FROM user_course_lesson_progress
      WHERE course_lesson_id = '${lessonFailure}' AND content_id = '${contentFailure}' AND content_version = 'FAIL'
    `));
    assert.deepEqual(failedRows, [{ status: "IN_PROGRESS" }]);
    const remainingActivity = await client.unsafe(`SELECT count(*)::int AS count FROM learning_activities WHERE target_id = '${lessonFailure}'`);
    assert.equal(Number(remainingActivity[0].count), 1);
  } finally {
    await client.unsafe("DROP TRIGGER IF EXISTS test_course_lesson_progress_activity_failure ON learning_activities");
  }

  const unauthenticated = await save(null, {
    courseLessonId: lessonA,
    contentId: contentA,
    contentVersion: "B",
    action: "COMPLETE",
    progressPercent: 100,
  });
  assert.equal(unauthenticated.response.status, 401);
  const otherCourse = await save(userOne, {
    courseLessonId: lessonOther,
    contentId: contentOther,
    contentVersion: "O",
    action: "COMPLETE",
    progressPercent: 100,
  });
  assert.equal(otherCourse.response.status, 404);
  const otherUser = await save(userTwo, {
    courseLessonId: lessonA,
    contentId: contentA,
    contentVersion: "B",
    action: "COMPLETE",
    progressPercent: 100,
  });
  assert.equal(otherUser.response.status, 404);

  const overview = await fetch(`${server.baseUrl}/learn/pg-revision-course-a`, {
    headers: { "oai-authenticated-user-email": "pg-revision-user-1@example.invalid" },
  });
  const overviewHtml = await overview.text();
  assert.equal(overview.status, 200, overviewHtml.slice(0, 1000));
  assert.match(overviewHtml, /2\/3/);
});

async function seedFixture() {
  await client.unsafe(`
    INSERT INTO users (id, email, display_name) VALUES
      ('${userOne}', 'pg-revision-user-1@example.invalid', 'Revision User 1'),
      ('${userTwo}', 'pg-revision-user-2@example.invalid', 'Revision User 2');
    INSERT INTO course_groups (id, code, name, description) VALUES
      ('pg-revision-group', 'PG_REVISION', 'Revision fixture', 'Disposable PostgreSQL fixture');
    INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description, active, published) VALUES
      ('${courseA}', 'pg-revision-group', 'PG_REV_A', 'pg-revision-course-a', 'Revision Course A', 'REV A', 'Revision fixture A', 1, 1),
      ('${courseB}', 'pg-revision-group', 'PG_REV_B', 'pg-revision-course-b', 'Revision Course B', 'REV B', 'Revision fixture B', 1, 1);
    INSERT INTO user_course_enrollments (id, user_id, course_id, status) VALUES
      ('pg-revision-enrollment-1', '${userOne}', '${courseA}', 'ACTIVE'),
      ('pg-revision-enrollment-2', '${userTwo}', '${courseB}', 'ACTIVE');
    INSERT INTO contents (id, slug, canonical_key, title, summary, body, body_format, version, status) VALUES
      ('${contentA}', 'pg-revision-content-a', 'pg.revision.content.a', 'Content A', '', 'Body A', 'MARKDOWN', 'A', 'PUBLISHED'),
      ('${contentB}', 'pg-revision-content-b', 'pg.revision.content.b', 'Content B', '', 'Body B', 'MARKDOWN', 'B', 'PUBLISHED'),
      ('${contentFailure}', 'pg-revision-content-failure', 'pg.revision.content.failure', 'Failure Content', '', 'Body Failure', 'MARKDOWN', 'FAIL', 'PUBLISHED'),
      ('${contentConcurrent}', 'pg-revision-content-concurrent', 'pg.revision.content.concurrent', 'Concurrent Content', '', 'Body Concurrent', 'MARKDOWN', 'C', 'PUBLISHED'),
      ('${contentOther}', 'pg-revision-content-other', 'pg.revision.content.other', 'Other Content', '', 'Body Other', 'MARKDOWN', 'O', 'PUBLISHED');
    INSERT INTO course_lessons (id, course_id, content_id, display_title, sort_order, estimated_minutes, is_required, completion_rule, status) VALUES
      ('${lessonA}', '${courseA}', '${contentA}', 'Lesson A', 1, 10, 1, 'MANUAL', 'PUBLISHED'),
      ('${lessonFailure}', '${courseA}', '${contentFailure}', 'Lesson Failure', 2, 10, 1, 'MANUAL', 'PUBLISHED'),
      ('${lessonConcurrent}', '${courseA}', '${contentConcurrent}', 'Lesson Concurrent', 3, 10, 1, 'MANUAL', 'PUBLISHED'),
      ('${lessonOther}', '${courseB}', '${contentOther}', 'Lesson Other', 1, 10, 1, 'MANUAL', 'PUBLISHED');
    INSERT INTO learning_activities (id, user_id, course_id, activity_type, target_id, metadata_json)
      VALUES ('pg-legacy-activity', '${userOne}', '${courseA}', 'COURSE_LESSON_COMPLETED', '${lessonFailure}', '{"legacy":true}');
  `);
}

async function progressRows(courseLessonId) {
  const rows = await client.unsafe(`
    SELECT content_id AS "contentId", content_version AS "contentVersion", status
    FROM user_course_lesson_progress
    WHERE user_id = '${userOne}' AND course_lesson_id = '${courseLessonId}'
    ORDER BY content_id NULLS FIRST, content_version NULLS FIRST
  `);
  return Array.from(rows);
}

async function save(userId, body) {
  const headers = { "content-type": "application/json", origin: server.baseUrl };
  if (userId === userOne) headers["oai-authenticated-user-email"] = "pg-revision-user-1@example.invalid";
  if (userId === userTwo) headers["oai-authenticated-user-email"] = "pg-revision-user-2@example.invalid";
  const response = await fetch(`${server.baseUrl}/api/course-lessons/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

async function waitForConnection() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await client`SELECT 1`;
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}
