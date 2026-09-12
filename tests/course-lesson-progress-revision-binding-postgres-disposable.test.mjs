import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { startVinextTestServer } from "./support/vinext-test-server.mjs";
import { generateSecurityContentV3Sql } from "../lib/data/security-content-upgrade-v3.mjs";

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
const raceContentId = "sec-upgrade-lesson-pg-seed-race";
const raceLessonId = "pg-revision-seed-race-lesson";

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

  const contentRow = (await client.unsafe(`
    SELECT id, slug, canonical_key AS "canonicalKey", title, summary, body,
      body_format AS "bodyFormat",
      learning_objectives_json AS "learningObjectivesJson",
      core_concepts_json AS "coreConceptsJson",
      practical_examples_json AS "practicalExamplesJson",
      diagrams_json AS "diagramsJson", media_json AS "mediaJson", version, status
    FROM contents WHERE id = '${contentA}'
  `))[0];
  const adminHeaders = {
    "content-type": "application/json",
    origin: server.baseUrl,
    "oai-authenticated-user-email": "pg-revision-admin@example.invalid",
  };
  const draftContentRow = (await client.unsafe(`
    SELECT id, slug, canonical_key AS "canonicalKey", title, summary, body,
      body_format AS "bodyFormat",
      learning_objectives_json AS "learningObjectivesJson",
      core_concepts_json AS "coreConceptsJson",
      practical_examples_json AS "practicalExamplesJson",
      diagrams_json AS "diagramsJson", media_json AS "mediaJson", version, status
    FROM contents WHERE id = '${contentB}'
  `))[0];
  const draftRevisionStart = await saveContent(adminHeaders, contentInput(draftContentRow));
  assert.equal(draftRevisionStart.response.status, 200, JSON.stringify(draftRevisionStart.payload));
  const draftRevisionSave = await saveContent(adminHeaders, contentInput({
    ...draftContentRow,
    version: "C",
    body: "PostgreSQL draft revision C body",
    status: "DRAFT",
  }));
  assert.equal(draftRevisionSave.response.status, 200, JSON.stringify(draftRevisionSave.payload));
  const draftRevisionPublish = await saveContent(adminHeaders, contentInput({
    ...draftContentRow,
    version: "C",
    body: "PostgreSQL draft revision C body",
    status: "PUBLISHED",
  }));
  assert.equal(draftRevisionPublish.response.status, 200, JSON.stringify(draftRevisionPublish.payload));
  assert.deepEqual(Array.from(await client.unsafe(`
    SELECT version, revision_status AS "revisionStatus", is_latest AS "isLatest",
      previous_version_id AS "previousVersionId", snapshot_json AS "snapshotJson"
    FROM content_revisions
    WHERE content_type = 'LEARNING_UNIT' AND content_id = '${contentB}'
    ORDER BY version
  `)).map((row) => ({
    version: row.version,
    revisionStatus: row.revisionStatus,
    isLatest: Boolean(row.isLatest),
    hasPrevious: Boolean(row.previousVersionId),
    body: JSON.parse(row.snapshotJson).payload.body,
  })), [
    { version: "A", revisionStatus: "superseded", isLatest: false, hasPrevious: false, body: "Body B" },
    { version: "C", revisionStatus: "published", isLatest: true, hasPrevious: true, body: "PostgreSQL draft revision C body" },
  ]);
  const sameRevision = await saveContent(adminHeaders, contentInput(contentRow));
  assert.equal(sameRevision.response.status, 200, JSON.stringify(sameRevision.payload));
  const sameVersionMutation = await saveContent(adminHeaders, contentInput({
    ...contentRow,
    body: "Changed PostgreSQL v2 body",
  }));
  assert.equal(sameVersionMutation.response.status, 409, JSON.stringify(sameVersionMutation.payload));
  assert.equal(sameVersionMutation.payload.code, "SHARED_CONTENT_REVISION_CONFLICT");

  const directImportStatement = contentImportStatement({ overview: "Direct import original overview" });
  await client.unsafe(directImportStatement);
  await client.unsafe(directImportStatement);
  const directImportBefore = Array.from(await client.unsafe(`
    SELECT title, summary, body, version, status
    FROM contents WHERE id = 'sec-upgrade-lesson-pg-boundary'
  `));
  assert.equal(directImportBefore.length, 1);
  await assert.rejects(
    client.unsafe(contentImportStatement({
      title: "Direct import tampered title",
      overview: "Direct import tampered overview",
      learningObjectives: ["Tampered learning objective"],
    })),
    /duplicate key|unique constraint/i,
  );
  await client.unsafe("ROLLBACK;");
  assert.deepEqual(Array.from(await client.unsafe(`
    SELECT title, summary, body, version, status
    FROM contents WHERE id = 'sec-upgrade-lesson-pg-boundary'
  `)), directImportBefore);
  assert.equal(Number((await client.unsafe(`
    SELECT count(*)::int AS count FROM content_revisions
    WHERE content_type = 'LEARNING_UNIT' AND content_id = 'sec-upgrade-lesson-pg-boundary'
  `))[0].count), 0);

  // Deterministic preflight/write barrier: A has completed its empty-row
  // preflight, B commits a same-id/version different payload, and A resumes
  // with a downstream link in the same transaction.
  assert.equal(Number((await client.unsafe(`
    SELECT count(*)::int AS count FROM contents WHERE id = '${raceContentId}'
  `))[0].count), 0);
  await client.unsafe(`
    INSERT INTO contents
      (id, slug, canonical_key, title, summary, body, body_format,
       learning_objectives_json, core_concepts_json, practical_examples_json,
       diagrams_json, media_json, version, status, created_by)
    VALUES ('${raceContentId}', 'pg-seed-race', 'pg.seed.race',
      'B payload', '', 'B body', 'STRUCTURED_JSON', '["B objective"]',
      '["DNS"]', '[]', '[]', '[]', '3.0.0', 'DRAFT', 'pg-revision-admin')
  `);
  const racePayloadBeforeA = Array.from(await client.unsafe(`
    SELECT title, body, version, status FROM contents WHERE id = '${raceContentId}'
  `));
  await assert.rejects(
    client.unsafe(contentImportStatement(
      { id: raceContentId, title: "A payload", overview: "A overview" },
      { downstreamLessonId: raceLessonId },
    )),
    /duplicate key|unique constraint/i,
  );
  await client.unsafe("ROLLBACK;");
  assert.deepEqual(Array.from(await client.unsafe(`
    SELECT title, body, version, status FROM contents WHERE id = '${raceContentId}'
  `),), racePayloadBeforeA);
  assert.equal(Number((await client.unsafe(`
    SELECT count(*)::int AS count FROM course_lessons WHERE id = '${raceLessonId}'
  `))[0].count), 0);

  const newRevision = await saveContent(adminHeaders, contentInput({
    ...contentRow,
    version: "C",
    body: "PostgreSQL revision C body",
  }));
  assert.equal(newRevision.response.status, 200, JSON.stringify(newRevision.payload));
  assert.deepEqual(Array.from(await client.unsafe(`
    SELECT version, revision_status AS "revisionStatus", is_latest AS "isLatest",
      snapshot_json AS "snapshotJson"
    FROM content_revisions
    WHERE content_type = 'LEARNING_UNIT' AND content_id = '${contentA}'
    ORDER BY version
  `)).map((row) => ({
    version: row.version,
    revisionStatus: row.revisionStatus,
    isLatest: Boolean(row.isLatest),
    body: JSON.parse(row.snapshotJson).payload.body,
  })), [
    { version: "B", revisionStatus: "superseded", isLatest: false, body: "Body A" },
    { version: "C", revisionStatus: "published", isLatest: true, body: "PostgreSQL revision C body" },
  ]);

  const concurrentPublishDraft = await saveContent(adminHeaders, contentInput({
    ...contentRow,
    version: "D",
    body: "PostgreSQL concurrent publish body",
    status: "DRAFT",
  }));
  assert.equal(concurrentPublishDraft.response.status, 200, JSON.stringify(concurrentPublishDraft.payload));
  const concurrentPublish = await Promise.all([
    saveContent(adminHeaders, contentInput({
      ...contentRow,
      version: "D",
      body: "PostgreSQL concurrent publish body",
      status: "PUBLISHED",
    })),
    saveContent(adminHeaders, contentInput({
      ...contentRow,
      version: "D",
      body: "PostgreSQL concurrent publish body",
      status: "PUBLISHED",
    })),
  ]);
  const concurrentPublishResults = concurrentPublish.map((result) => ({
    status: result.response.status,
    payload: result.payload,
  }));
  assert.ok(
    concurrentPublish.every((result) => result.response.status === 200 || result.response.status === 409),
    JSON.stringify(concurrentPublishResults),
  );
  assert.ok(concurrentPublish.some((result) => result.response.status === 200), JSON.stringify(concurrentPublishResults));
  const concurrentPublishRows = Array.from(await client.unsafe(`
    SELECT id, version, revision_status AS "revisionStatus", is_latest AS "isLatest",
      previous_version_id AS "previousVersionId"
    FROM content_revisions
    WHERE content_type = 'LEARNING_UNIT' AND content_id = '${contentA}'
    ORDER BY version
  `));
  assert.equal(concurrentPublishRows.filter((row) => Boolean(row.isLatest)).length, 1);
  const latestConcurrentPublish = concurrentPublishRows.find((row) => Boolean(row.isLatest));
  assert.equal(latestConcurrentPublish.version, "D");
  assert.equal(latestConcurrentPublish.revisionStatus, "published");
  assert.equal(latestConcurrentPublish.previousVersionId, concurrentPublishRows.find((row) => row.version === "C").id);

  const rollback = await saveContent(adminHeaders, contentInput({
    ...contentRow,
    version: "E",
    body: "PostgreSQL revision E body",
    slug: "pg-revision-content-b",
    canonicalKey: "pg.revision.content.d",
  }));
  assert.ok(rollback.response.status >= 400, JSON.stringify(rollback.payload));
  assert.deepEqual(Array.from(await client.unsafe(`
    SELECT version, body FROM contents WHERE id = '${contentA}'
  `)), [{ version: "D", body: "PostgreSQL concurrent publish body" }]);
  assert.deepEqual(Array.from(await client.unsafe(`
    SELECT version FROM content_revisions
    WHERE content_type = 'LEARNING_UNIT' AND content_id = '${contentA}'
    ORDER BY version
  `)), [{ version: "B" }, { version: "C" }, { version: "D" }]);

  await assert.rejects(
    client.unsafe(`DELETE FROM contents WHERE id = '${contentA}'`),
    /violates foreign key constraint/,
  );
  await client.unsafe(`UPDATE contents SET deleted_at = CURRENT_TIMESTAMP::text WHERE id = '${contentA}'`);
  assert.equal(Number((await client.unsafe(`
    SELECT count(*)::int AS count FROM content_revisions
    WHERE content_type = 'LEARNING_UNIT' AND content_id = '${contentA}'
  `))[0].count), 3);
  await client.unsafe(`UPDATE contents SET deleted_at = NULL WHERE id = '${contentA}'`);
});

async function seedFixture() {
  await client.unsafe(`
    INSERT INTO users (id, email, display_name) VALUES
      ('${userOne}', 'pg-revision-user-1@example.invalid', 'Revision User 1'),
      ('${userTwo}', 'pg-revision-user-2@example.invalid', 'Revision User 2'),
      ('pg-revision-admin', 'pg-revision-admin@example.invalid', 'Revision Admin');
    INSERT INTO roles (id, code, name, description)
      VALUES ('pg-revision-role-admin', 'ADMIN', 'Admin', 'Disposable test admin');
    INSERT INTO user_roles (id, user_id, role_id, granted_by)
      VALUES ('pg-revision-admin-role', 'pg-revision-admin', 'pg-revision-role-admin', 'pg-revision-admin');
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

async function saveContent(headers, content) {
  const response = await fetch(`${server.baseUrl}/api/admin/shared-content`, {
    method: "POST",
    headers,
    body: JSON.stringify({ operation: "saveContent", content }),
  });
  return { response, payload: await response.json() };
}

function contentInput(row) {
  return {
    id: row.id,
    slug: row.slug,
    canonicalKey: row.canonicalKey,
    title: row.title,
    summary: row.summary ?? "",
    body: row.body,
    bodyFormat: row.bodyFormat ?? "MARKDOWN",
    learningObjectivesJson: row.learningObjectivesJson ?? "[]",
    coreConceptsJson: row.coreConceptsJson ?? "[]",
    practicalExamplesJson: row.practicalExamplesJson ?? "[]",
    diagramsJson: row.diagramsJson ?? "[]",
    mediaJson: row.mediaJson ?? "[]",
    version: row.version,
    status: row.status,
  };
}

function contentImportStatement(overrides = {}, { downstreamLessonId } = {}) {
  const sql = generateSecurityContentV3Sql({
    lessons: [
      {
        id: "sec-upgrade-lesson-pg-boundary",
        title: "Direct import original title",
        concepts: ["DNS security"],
        source_refs: ["disposable-boundary-fixture"],
        difficulty: 3,
        learningObjectives: ["Original learning objective"],
        overview: "Direct import original overview",
        keyPoints: ["Original key point"],
        practiceTip: "Original practice tip",
        fieldExample: "Original field example",
        relatedConcepts: [],
        provenance: { canonicalConcept: "DNS security" },
        ...overrides,
      },
    ],
    writtenQuestions: [],
    practicalQuestions: [],
  }, { dialect: "postgres", actorId: "pg-revision-admin" });
  const marker = "-- SECURITY_CONTENT_V3_IMMUTABLE_CONTENT_GUARD";
  const markerOffset = sql.indexOf(marker);
  assert.ok(markerOffset >= 0, "Expected generated immutable contents guard.");
  const guardEnd = sql.indexOf(";", markerOffset);
  assert.ok(guardEnd >= markerOffset, "Expected generated guard statement terminator.");
  const downstream = downstreamLessonId
    ? `\nINSERT INTO "course_lessons" ("id","course_id","content_id","display_title","sort_order","estimated_minutes","is_required","completion_rule","status") VALUES ('${downstreamLessonId}','${courseA}', '${overrides.id ?? "sec-upgrade-lesson-pg-boundary"}','Seed race downstream link',99998,10,1,'MANUAL','DRAFT');`
    : "";
  return `${sql.slice(0, guardEnd + 1)}${downstream}\nCOMMIT;`;
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
