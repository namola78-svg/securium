import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { startVinextTestServer } from "./support/vinext-test-server.mjs";

const host = "127.0.0.1";
const courseId = "course-isms-p";
const userId = "user-learner-1";
const contentId = "repair-revision-integrity-content";
const collisionContentId = "repair-revision-integrity-collision";
const lessonId = "repair-revision-integrity-lesson";
const legacyProgressId = "repair-revision-integrity-legacy";
const port = await getFreeLoopbackPort();
let server;
let baseUrl;

const userHeaders = {
  "content-type": "application/json",
  origin: `http://${host}:${port}`,
  "oai-authenticated-user-email": "dev-user-1@example.invalid",
};
const adminHeaders = {
  "content-type": "application/json",
  origin: `http://${host}:${port}`,
  "oai-authenticated-user-email": "dev-admin@example.invalid",
};

before(async () => {
  server = await startVinextTestServer({
    label: "Theory revision integrity D1 integration",
    env: { WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
  });
  baseUrl = server.baseUrl;
  userHeaders.origin = baseUrl;
  adminHeaders.origin = baseUrl;
  await runLocalSql(`
    DELETE FROM learning_activities WHERE target_id = '${lessonId}';
    DELETE FROM user_course_lesson_progress WHERE course_lesson_id = '${lessonId}';
    DELETE FROM content_revisions WHERE content_type = 'LEARNING_UNIT'
      AND content_id IN ('${contentId}', '${collisionContentId}')
      AND version = 'v4';
    DELETE FROM content_revisions WHERE content_type = 'LEARNING_UNIT'
      AND content_id IN ('${contentId}', '${collisionContentId}')
      AND version = 'v3';
    DELETE FROM content_revisions WHERE content_type = 'LEARNING_UNIT'
      AND content_id IN ('${contentId}', '${collisionContentId}')
      AND version = 'v2';
    DELETE FROM content_revisions WHERE content_type = 'LEARNING_UNIT'
      AND content_id IN ('${contentId}', '${collisionContentId}');
    DELETE FROM course_lessons WHERE id = '${lessonId}';
    DELETE FROM contents WHERE id IN ('${contentId}', '${collisionContentId}');
    INSERT INTO contents
      (id, slug, canonical_key, title, summary, body, body_format,
       learning_objectives_json, core_concepts_json, practical_examples_json,
       diagrams_json, media_json, version, status, created_by)
    VALUES
      ('${contentId}', 'repair-revision-integrity-a', 'repair.revision.integrity.a',
       'Repair revision A', 'Summary A', 'Revision A body', 'MARKDOWN',
       '[]', '[]', '[]', '[]', '[]', 'v1', 'PUBLISHED', 'user-admin'),
      ('${collisionContentId}', 'repair-revision-integrity-collision',
       'repair.revision.integrity.collision', 'Collision content', '',
       'Collision body', 'MARKDOWN', '[]', '[]', '[]', '[]', '[]',
       'v1', 'PUBLISHED', 'user-admin');
    INSERT INTO course_lessons
      (id, course_id, content_id, display_title, sort_order,
       estimated_minutes, is_required, completion_rule, status)
    VALUES ('${lessonId}', '${courseId}', '${contentId}', 'Repair revision lesson',
      99999, 10, 1, 'MANUAL', 'PUBLISHED');
    INSERT INTO user_course_lesson_progress
      (id, user_id, course_id, course_lesson_id, content_id, content_version,
       status, progress_percent, completed_at, last_viewed_at,
       time_spent_seconds, last_studied_at)
    VALUES ('${legacyProgressId}', '${userId}', '${courseId}', '${lessonId}',
      NULL, NULL, 'COMPLETED', 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1,
      CURRENT_TIMESTAMP);
  `);
});

after(async () => {
  await runLocalSql(`
    DELETE FROM learning_activities WHERE target_id = '${lessonId}';
    DELETE FROM user_course_lesson_progress WHERE course_lesson_id = '${lessonId}';
    DELETE FROM content_revisions WHERE content_type = 'LEARNING_UNIT'
      AND content_id IN ('${contentId}', '${collisionContentId}')
      AND version = 'v4';
    DELETE FROM content_revisions WHERE content_type = 'LEARNING_UNIT'
      AND content_id IN ('${contentId}', '${collisionContentId}')
      AND version = 'v3';
    DELETE FROM content_revisions WHERE content_type = 'LEARNING_UNIT'
      AND content_id IN ('${contentId}', '${collisionContentId}')
      AND version = 'v2';
    DELETE FROM content_revisions WHERE content_type = 'LEARNING_UNIT'
      AND content_id IN ('${contentId}', '${collisionContentId}');
    DELETE FROM course_lessons WHERE id = '${lessonId}';
    DELETE FROM contents WHERE id IN ('${contentId}', '${collisionContentId}');
  `);
  await server?.stop();
});

test("D1 authoring and learning records preserve immutable theory revisions", async () => {
  const first = await saveProgress({
    courseLessonId: lessonId,
    contentId,
    contentVersion: "v1",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 10,
  });
  assert.equal(first.response.status, 200, JSON.stringify(first.payload));

  const createdSnapshot = await saveContent(contentInput({}));
  assert.equal(createdSnapshot.response.status, 200, JSON.stringify(createdSnapshot.payload));
  const initialRevision = await queryRows(`
    SELECT version, revision_status AS revisionStatus, is_latest AS isLatest,
      semantic_hash AS semanticHash, snapshot_json AS snapshotJson
    FROM content_revisions
    WHERE content_type = 'LEARNING_UNIT' AND content_id = '${contentId}'
    ORDER BY version;
  `);
  assert.equal(initialRevision.length, 1);
  assert.equal(initialRevision[0].version, "v1");
  assert.equal(initialRevision[0].revisionStatus, "published");
  assert.equal(Number(initialRevision[0].isLatest), 1);
  assert.match(initialRevision[0].semanticHash, /^[0-9a-f]{64}$/);
  assert.equal(JSON.parse(initialRevision[0].snapshotJson).payload.body, "Revision A body");

  const sameRevisionMutation = await saveContent(contentInput({ body: "Changed A body" }));
  assert.equal(sameRevisionMutation.response.status, 409, JSON.stringify(sameRevisionMutation.payload));
  assert.equal(sameRevisionMutation.payload.code, "SHARED_CONTENT_REVISION_CONFLICT");
  assert.deepEqual(await queryRows(`
    SELECT body, version FROM contents WHERE id = '${contentId}';
  `), [{ body: "Revision A body", version: "v1" }]);

  const metadataOnly = await saveContent(contentInput({
    slug: "repair-revision-integrity-a-renamed",
    canonicalKey: "repair.revision.integrity.a.renamed",
  }));
  assert.equal(metadataOnly.response.status, 200, JSON.stringify(metadataOnly.payload));
  assert.deepEqual(await queryRows(`
    SELECT slug, canonical_key AS canonicalKey, body
    FROM contents WHERE id = '${contentId}';
  `), [{
    slug: "repair-revision-integrity-a-renamed",
    canonicalKey: "repair.revision.integrity.a.renamed",
    body: "Revision A body",
  }]);

  const newRevision = await saveContent(contentInput({
    version: "v2",
    body: "Revision B body",
  }));
  assert.equal(newRevision.response.status, 200, JSON.stringify(newRevision.payload));
  assert.deepEqual(
    (await queryRows(`
      SELECT version, revision_status AS revisionStatus, is_latest AS isLatest,
        previous_version_id AS previousVersionId, snapshot_json AS snapshotJson
      FROM content_revisions
      WHERE content_type = 'LEARNING_UNIT' AND content_id = '${contentId}'
      ORDER BY version;
    `)).map((row) => ({
      version: row.version,
      revisionStatus: row.revisionStatus,
      isLatest: Number(row.isLatest),
      hasPrevious: Boolean(row.previousVersionId),
      body: JSON.parse(row.snapshotJson).payload.body,
    })),
    [
      { version: "v1", revisionStatus: "superseded", isLatest: 0, hasPrevious: false, body: "Revision A body" },
      { version: "v2", revisionStatus: "published", isLatest: 1, hasPrevious: true, body: "Revision B body" },
    ],
  );

  const second = await saveProgress({
    courseLessonId: lessonId,
    contentId,
    contentVersion: "v2",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 11,
  });
  assert.equal(second.response.status, 200, JSON.stringify(second.payload));
  const replay = await saveProgress({
    courseLessonId: lessonId,
    contentId,
    contentVersion: "v2",
    action: "COMPLETE",
    progressPercent: 100,
    timeSpentSeconds: 11,
  });
  assert.equal(replay.response.status, 200, JSON.stringify(replay.payload));
  assert.equal(replay.payload.result.idempotentReplay, true);

  const staleScreen = await saveProgress({
    courseLessonId: lessonId,
    contentId,
    contentVersion: "v1",
    action: "COMPLETE",
    progressPercent: 100,
  });
  assert.equal(staleScreen.response.status, 409);
  assert.equal(staleScreen.payload.code, "COURSE_LESSON_REVISION_MISMATCH");

  const currentMutation = await saveContent(contentInput({
    version: "v2",
    body: "Changed B body",
  }));
  assert.equal(currentMutation.response.status, 409);
  assert.equal(currentMutation.payload.code, "SHARED_CONTENT_REVISION_CONFLICT");
  assert.deepEqual(await queryRows(`
    SELECT content_version AS contentVersion, status
    FROM user_course_lesson_progress
    WHERE course_lesson_id = '${lessonId}'
      AND content_id IS NOT NULL
    ORDER BY content_version;
  `), [
    { contentVersion: "v1", status: "COMPLETED" },
    { contentVersion: "v2", status: "COMPLETED" },
  ]);
  assert.equal(Number((await queryRows(`
    SELECT count(*) AS count FROM learning_activities
    WHERE target_id = '${lessonId}' AND activity_type = 'COURSE_LESSON_COMPLETED';
  `))[0].count), 2);
  assert.equal(Number((await queryRows(`
    SELECT count(*) AS count FROM user_course_lesson_progress
    WHERE course_lesson_id = '${lessonId}' AND content_id IS NULL AND content_version IS NULL;
  `))[0].count), 1);

  const concurrentRevisionSaves = await Promise.all([
    saveContent(contentInput({ version: "v3", body: "Concurrent C body" })),
    saveContent(contentInput({ version: "v3", body: "Concurrent D body" })),
  ]);
  assert.equal(concurrentRevisionSaves.filter((result) => result.response.status === 200).length, 1);
  assert.equal(concurrentRevisionSaves.filter((result) => result.response.status >= 400).length, 1);
  assert.equal(Number((await queryRows(`
    SELECT count(*) AS count FROM content_revisions
    WHERE content_type = 'LEARNING_UNIT' AND content_id = '${contentId}' AND version = 'v3';
  `))[0].count), 1);

  await runLocalSql(`
    UPDATE contents SET slug = 'repair-revision-integrity-collision' WHERE id = '${collisionContentId}';
  `);
  const failedBatch = await saveContent(contentInput({
    version: "v4",
    body: "Revision D body",
    slug: "repair-revision-integrity-collision",
    canonicalKey: "repair.revision.integrity.c",
  }));
  assert.ok(failedBatch.response.status >= 400, JSON.stringify(failedBatch.payload));
  const currentAfterConcurrent = await queryRows(`
    SELECT body, version FROM contents WHERE id = '${contentId}';
  `);
  assert.equal(currentAfterConcurrent.length, 1);
  assert.ok(["Concurrent C body", "Concurrent D body"].includes(currentAfterConcurrent[0].body));
  assert.equal(currentAfterConcurrent[0].version, "v3");
  assert.deepEqual(await queryRows(`
    SELECT version FROM content_revisions
    WHERE content_type = 'LEARNING_UNIT' AND content_id = '${contentId}'
    ORDER BY version;
  `), [{ version: "v1" }, { version: "v2" }, { version: "v3" }]);

  await assert.rejects(
    runLocalSql(`DELETE FROM contents WHERE id = '${contentId}';`),
    /FOREIGN KEY constraint failed/,
  );
  await runLocalSql(`
    UPDATE contents SET deleted_at = CURRENT_TIMESTAMP WHERE id = '${contentId}';
  `);
  assert.equal(Number((await queryRows(`
    SELECT count(*) AS count FROM content_revisions
    WHERE content_type = 'LEARNING_UNIT' AND content_id = '${contentId}';
  `))[0].count), 3);
  await runLocalSql(`UPDATE contents SET deleted_at = NULL WHERE id = '${contentId}';`);
});

function contentInput(overrides = {}) {
  return {
    id: contentId,
    slug: "repair-revision-integrity-a-renamed",
    canonicalKey: "repair.revision.integrity.a.renamed",
    title: "Repair revision A",
    summary: "Summary A",
    body: "Revision A body",
    bodyFormat: "MARKDOWN",
    learningObjectivesJson: "[]",
    coreConceptsJson: "[]",
    practicalExamplesJson: "[]",
    diagramsJson: "[]",
    mediaJson: "[]",
    version: "v1",
    status: "PUBLISHED",
    ...overrides,
  };
}

async function saveContent(content) {
  const response = await fetch(`${baseUrl}/api/admin/shared-content`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ operation: "saveContent", content }),
  });
  return { response, payload: await response.json() };
}

async function saveProgress(body) {
  const response = await fetch(`${baseUrl}/api/course-lessons/progress`, {
    method: "POST",
    headers: userHeaders,
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
    "scripts/run-wrangler.mjs", "d1", "execute", "DB", "--local",
    "--config", "wrangler.local.jsonc", "--command", command,
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
        try { resolve(JSON.parse(stdout)); }
        catch (error) { reject(new Error(`Local SQL returned invalid JSON: ${error.message}\n${stdout}`)); }
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
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}
