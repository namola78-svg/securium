import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { startVinextTestServer } from "./support/vinext-test-server.mjs";

const host = "127.0.0.1";
const courseId = "course-isms-p";
const userId = "user-learner-1";
const accessLessonId = "course-lesson-isms-access-control";
const encryptionLessonId = "course-lesson-isms-encryption";
const failureLessonId = "course-lesson-isms-incident-response";
const accessContentId = "content-shared-access-control-basics";
const encryptionContentId = "content-shared-personal-data-encryption";
const failureContentId = "content-shared-incident-response-lifecycle";
const port = await getFreeLoopbackPort();
let server;
let baseUrl;

const userHeaders = {
  "content-type": "application/json",
  origin: `http://${host}:${port}`,
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};
const otherUserHeaders = {
  "content-type": "application/json",
  origin: `http://${host}:${port}`,
  "oai-authenticated-user-email": "dev-user-2@example.invalid",
};

before(async () => {
  server = await startVinextTestServer({
    label: "CourseLesson revision binding integration",
    env: { WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
  });
  baseUrl = server.baseUrl;
  userHeaders.origin = baseUrl;
  otherUserHeaders.origin = baseUrl;
  await runLocalSql(`
    DROP TRIGGER IF EXISTS test_course_lesson_progress_activity_failure;
    DELETE FROM learning_activities
      WHERE user_id = '${userId}'
        AND course_id = '${courseId}'
        AND target_id IN ('${accessLessonId}', '${encryptionLessonId}', '${failureLessonId}');
    DELETE FROM user_course_lesson_progress
      WHERE user_id = '${userId}'
        AND course_id = '${courseId}'
        AND course_lesson_id IN ('${accessLessonId}', '${encryptionLessonId}', '${failureLessonId}');
    UPDATE contents SET version = 'A' WHERE id = '${accessContentId}';
    UPDATE contents SET version = 'L1' WHERE id = '${encryptionContentId}';
    UPDATE contents SET version = 'FAIL' WHERE id = '${failureContentId}';
  `);
});

after(async () => {
  await runLocalSql(`
    DROP TRIGGER IF EXISTS test_course_lesson_progress_activity_failure;
    DELETE FROM learning_activities
      WHERE user_id = '${userId}'
        AND course_id = '${courseId}'
        AND target_id IN ('${accessLessonId}', '${encryptionLessonId}', '${failureLessonId}');
    DELETE FROM user_course_lesson_progress
      WHERE user_id = '${userId}'
        AND course_id = '${courseId}'
        AND course_lesson_id IN ('${accessLessonId}', '${encryptionLessonId}', '${failureLessonId}');
  `);
  await server?.stop();
});

test("CourseLesson progress remains bound to the server-resolved revision", async () => {
  const first = await save(userHeaders, {
    courseLessonId: accessLessonId,
    contentVersion: "A",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 12,
  });
  assert.equal(first.response.status, 200, JSON.stringify(first.payload));
  assert.equal(first.payload.result.contentVersion, "A");
  assert.equal(first.payload.result.idempotentReplay, false);

  const revisionA = await queryRows(`
    SELECT content_version AS contentVersion, status, progress_percent AS progressPercent
    FROM user_course_lesson_progress
    WHERE user_id = '${userId}' AND course_lesson_id = '${accessLessonId}';
  `);
  assert.deepEqual(revisionA, [
    { contentVersion: "A", status: "COMPLETED", progressPercent: 100 },
  ]);

  await runLocalSql(`UPDATE contents SET version = 'B' WHERE id = '${accessContentId}';`);

  const stalePage = await save(userHeaders, {
    courseLessonId: accessLessonId,
    contentVersion: "A",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 13,
  });
  assert.equal(stalePage.response.status, 409, JSON.stringify(stalePage.payload));
  assert.equal(stalePage.payload.code, "COURSE_LESSON_REVISION_MISMATCH");

  const forgedRevision = await save(userHeaders, {
    courseLessonId: accessLessonId,
    contentVersion: "forged-revision",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 13,
  });
  assert.equal(forgedRevision.response.status, 409);
  assert.equal(forgedRevision.payload.code, "COURSE_LESSON_REVISION_MISMATCH");

  const revisionB = await save(userHeaders, {
    courseLessonId: accessLessonId,
    contentVersion: "B",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 14,
  });
  assert.equal(revisionB.response.status, 200, JSON.stringify(revisionB.payload));
  assert.equal(revisionB.payload.result.contentVersion, "B");
  assert.equal(revisionB.payload.result.idempotentReplay, false);

  const replay = await save(userHeaders, {
    courseLessonId: accessLessonId,
    contentVersion: "B",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 14,
  });
  assert.equal(replay.response.status, 200, JSON.stringify(replay.payload));
  assert.equal(replay.payload.result.idempotentReplay, true);
  assert.equal(replay.payload.result.contentVersion, "B");

  const revisions = await queryRows(`
    SELECT content_version AS contentVersion, status, progress_percent AS progressPercent
    FROM user_course_lesson_progress
    WHERE user_id = '${userId}' AND course_lesson_id = '${accessLessonId}'
    ORDER BY content_version;
  `);
  assert.deepEqual(revisions, [
    { contentVersion: "A", status: "COMPLETED", progressPercent: 100 },
    { contentVersion: "B", status: "COMPLETED", progressPercent: 100 },
  ]);

  const activities = await queryRows(`
    SELECT id, metadata_json AS metadataJson
    FROM learning_activities
    WHERE user_id = '${userId}' AND target_id = '${accessLessonId}'
    ORDER BY id;
  `);
  assert.equal(activities.length, 2);
  assert.deepEqual(
    activities.map((row) => JSON.parse(row.metadataJson).contentVersion),
    ["A", "B"],
  );

  const unauthenticated = await save(
    { "content-type": "application/json", origin: baseUrl },
    {
      courseLessonId: accessLessonId,
      contentVersion: "B",
      action: "COMPLETE",
      progressPercent: 100,
    },
  );
  assert.equal(unauthenticated.response.status, 401);

  const wrongCourseLesson = await save(otherUserHeaders, {
    courseLessonId: "course-lesson-cppg-access-control",
    contentVersion: "B",
    action: "COMPLETE",
    progressPercent: 100,
  });
  assert.equal(wrongCourseLesson.response.status, 404);

  await runLocalSql(`
    INSERT INTO user_course_lesson_progress
      (id, user_id, course_id, course_lesson_id, status, progress_percent,
       completed_at, last_viewed_at, time_spent_seconds, last_studied_at)
    VALUES
      ('legacy-course-lesson-progress', '${userId}', '${courseId}',
       '${encryptionLessonId}', 'COMPLETED', 100,
       '2026-09-11T00:00:00.000Z', '2026-09-11T00:00:00.000Z', 5,
       '2026-09-11T00:00:00.000Z');
  `);
  const currentAfterLegacy = await save(userHeaders, {
    courseLessonId: encryptionLessonId,
    contentVersion: "L1",
    action: "START",
    progressPercent: 10,
    timeSpentSeconds: 6,
  });
  assert.equal(currentAfterLegacy.response.status, 200);
  const legacyRows = await queryRows(`
    SELECT content_version AS contentVersion, status
    FROM user_course_lesson_progress
    WHERE user_id = '${userId}' AND course_lesson_id = '${encryptionLessonId}'
    ORDER BY content_version IS NOT NULL, content_version;
  `);
  assert.deepEqual(legacyRows, [
    { contentVersion: null, status: "COMPLETED" },
    { contentVersion: "L1", status: "IN_PROGRESS" },
  ]);

  await runLocalSql(`
    CREATE TRIGGER test_course_lesson_progress_activity_failure
    BEFORE INSERT ON learning_activities
    WHEN NEW.id = 'course-lesson-completed:${userId}:${failureLessonId}:FAIL'
    BEGIN
      SELECT RAISE(ABORT, 'intentional activity failure');
    END;
  `);
  try {
    const failed = await save(userHeaders, {
      courseLessonId: failureLessonId,
      contentVersion: "FAIL",
      action: "COMPLETE",
      progressPercent: 100,
      timeSpentSeconds: 2,
    });
    assert.ok(failed.response.status >= 400, JSON.stringify(failed.payload));
    const partialRows = await queryRows(`
      SELECT count(*) AS count
      FROM user_course_lesson_progress
      WHERE user_id = '${userId}' AND course_lesson_id = '${failureLessonId}'
        AND content_version = 'FAIL';
    `);
    const partialActivities = await queryRows(`
      SELECT count(*) AS count
      FROM learning_activities
      WHERE user_id = '${userId}' AND target_id = '${failureLessonId}';
    `);
    assert.equal(Number(partialRows[0].count), 0);
    assert.equal(Number(partialActivities[0].count), 0);
  } finally {
    await runLocalSql("DROP TRIGGER IF EXISTS test_course_lesson_progress_activity_failure;");
  }
});

async function save(headers, body) {
  const response = await fetch(`${baseUrl}/api/course-lessons/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

async function queryRows(command) {
  const output = await runLocalSql(command, { json: true });
  return output?.[0]?.results ?? [];
}

async function runLocalSql(command, { json = false } = {}) {
  const args = [
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
    "--command",
    command,
  ];
  if (json) args.push("--json");
  const child = spawn(process.execPath, args, {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`Local SQL stopped by ${signal}.`));
      else if (code !== 0) reject(new Error(`Local SQL failed with ${code}. ${stderr}\n${stdout}`));
      else if (json) {
        try {
          resolve(JSON.parse(stdout));
        } catch (error) {
          reject(new Error(`Local SQL returned invalid JSON: ${error.message}\n${stdout}`));
        }
      } else resolve();
    });
  });
}

function getFreeLoopbackPort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, host, () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close();
        reject(new Error("Could not allocate a loopback port."));
        return;
      }
      probe.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}
