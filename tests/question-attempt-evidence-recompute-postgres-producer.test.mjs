import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { createRecomputeRequest } from "../db/evidence-projection-repository.ts";
import { startVinextTestServer } from "./support/vinext-test-server.mjs";

const execFile = promisify(execFileCallback);
const runId = randomUUID();
const password = "question-attempt-evidence-postgres-test-password";
const groupId = `pg-qae-group-${runId}`;
const courseId = `pg-qae-course-${runId}`;
const subjectId = `pg-qae-subject-${runId}`;
const topicId = `pg-qae-topic-${runId}`;
const questionId = `pg-qae-question-${runId}`;
const questionVersionId = `${questionId}-version-01`;
const conceptId = `pg-qae-concept-${runId}`;
const userId = `pg-qae-user-1-${runId}`;
const secondUserId = `pg-qae-user-2-${runId}`;
const adminId = `pg-qae-admin-${runId}`;
const wrongChoiceId = `${questionId}-choice-02`;
const correctChoiceId = `${questionId}-choice-01`;
const semanticHash = "a".repeat(64);
const humanReviewHash = "b".repeat(64);

let container;
let client;
let server;

before(async () => {
  container = `securium-qae-producer-${runId}`;
  await execFile("docker", [
    "run",
    "--detach",
    "--rm",
    "--name",
    container,
    "--env",
    `POSTGRES_PASSWORD=${password}`,
    "--publish",
    "127.0.0.1::5432",
    "postgres:17.6",
  ]);
  const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  assert.ok(port, "Docker did not publish a disposable PostgreSQL port");
  const postgres = (await import("postgres")).default;
  client = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, {
    max: 1,
    prepare: false,
    ssl: false,
    onnotice: false,
  });
  await waitForConnection();
  await applyPostgresFixture();

  server = await startVinextTestServer({
    label: "Question attempt evidence recompute PostgreSQL producer",
    readinessPath: "/api/question-attempts",
    env: {
      APP_ENV: "test",
      AUTH_PROVIDER: "sites",
      SECURIUM_POSTGRES_TEST_MODE: "1",
      DB_PROVIDER: "supabase",
      DATABASE_URL: `postgres://postgres:${password}@127.0.0.1:${port}/postgres`,
      POSTGRES_SSL_MODE: "disable",
      POSTGRES_MAX_CONNECTIONS: "1",
      POSTGRES_CONNECT_TIMEOUT_SECONDS: "5",
      POSTGRES_QUERY_TIMEOUT_MS: "10000",
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
    },
  });
});

after(async () => {
  await server?.stop();
  await client?.end({ timeout: 5 }).catch(() => {});
  if (container) await execFile("docker", ["rm", "--force", container]).catch(() => {});
});

test("HTTP question producer uses PostgreSQL atomic attempt and recompute request contract", async () => {
  const normalKey = `normal-${runId}`;
  const normal = await submitQuestion({
    email: "pg-qae-user-1@example.invalid",
    idempotencyKey: normalKey,
    answer: wrongChoiceId,
  });
  assert.equal(normal.response.status, 201, responseDiagnostic(normal));
  assert.equal(normal.payload.result.idempotentReplay, false);

  const attempt = await one(
    "SELECT id, user_id, question_id, question_version_id, concept_mapping_set_hash, course_id, selected_answer FROM question_attempts WHERE idempotency_key = $1",
    [normalKey],
  );
  assert.ok(attempt);
  assert.equal(attempt.id, normal.payload.result.attemptId);
  assert.deepEqual(
    {
      user_id: attempt.user_id,
      question_id: attempt.question_id,
      question_version_id: attempt.question_version_id,
      course_id: attempt.course_id,
      selected_answer: attempt.selected_answer,
    },
    {
      user_id: userId,
      question_id: questionId,
      question_version_id: questionVersionId,
      course_id: courseId,
      selected_answer: JSON.stringify(wrongChoiceId),
    },
  );
  assert.match(attempt.concept_mapping_set_hash, /^[0-9a-f]{64}$/);

  assert.equal(await scalar("SELECT count(*) FROM learning_activities WHERE target_id = $1", [questionId]), 1);
  assert.equal(await scalar("SELECT count(*) FROM user_progress WHERE user_id = $1 AND course_id = $2", [userId, courseId]), 1);
  assert.equal(await scalar("SELECT count(*) FROM wrong_notes WHERE user_id = $1 AND question_id = $2", [userId, questionId]), 1);

  const request = await one(
    "SELECT request_type, scope_type, source_type, source_event_id, source_revision_identity, user_id, projection_version, status, input_semantic_hash FROM evidence_recompute_requests WHERE source_event_id = $1",
    [attempt.id],
  );
  assert.deepEqual(
    { ...request, input_semantic_hash: undefined },
    {
      request_type: "EVIDENCE_RECOMPUTE_REQUIRED",
      scope_type: "EVENT",
      source_type: "QUESTION_ATTEMPT",
      source_event_id: attempt.id,
      source_revision_identity: attempt.id,
      user_id: userId,
      projection_version: "EVIDENCE_V1",
      status: "PENDING",
      input_semantic_hash: undefined,
    },
  );
  assert.match(request.input_semantic_hash, /^[0-9a-f]{64}$/);
  const expectedRequest = await createRecomputeRequest({
    requestType: "EVIDENCE_RECOMPUTE_REQUIRED",
    scopeType: "EVENT",
    sourceType: "QUESTION_ATTEMPT",
    sourceEventId: attempt.id,
    sourceRevisionIdentity: attempt.id,
    userId,
    projectionVersion: "EVIDENCE_V1",
    reasonCode: "QUESTION_ATTEMPT_CREATED",
  });
  assert.equal(request.input_semantic_hash, expectedRequest.inputSemanticHash);
  assert.equal(await scalar("SELECT count(*) FROM evidence_projections WHERE source_event_id = $1", [attempt.id]), 0);

  const replay = await submitQuestion({
    email: "pg-qae-user-1@example.invalid",
    idempotencyKey: normalKey,
    answer: wrongChoiceId,
  });
  assert.equal(replay.response.status, 201, responseDiagnostic(replay));
  assert.equal(replay.payload.result.idempotentReplay, true);
  assert.equal(replay.payload.result.attemptId, attempt.id);
  assert.equal(await scalar("SELECT count(*) FROM question_attempts WHERE idempotency_key = $1", [normalKey]), 1);
  assert.equal(await scalar("SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = $1", [attempt.id]), 1);

  const retake = await submitQuestion({
    email: "pg-qae-user-1@example.invalid",
    idempotencyKey: `retake-${runId}`,
    answer: correctChoiceId,
  });
  assert.equal(retake.response.status, 201, responseDiagnostic(retake));
  assert.equal(retake.payload.result.idempotentReplay, false);
  assert.notEqual(retake.payload.result.attemptId, attempt.id);
  assert.equal(await scalar("SELECT count(*) FROM evidence_recompute_requests WHERE source_type = 'QUESTION_ATTEMPT' AND user_id = $1", [userId]), 2);

  const governanceDenied = await submitQuestion({
    email: "pg-qae-user-1@example.invalid",
    idempotencyKey: `governance-deny-${runId}`,
    answer: wrongChoiceId,
    questionVersionId: null,
  });
  assert.equal(governanceDenied.response.status, 409, responseDiagnostic(governanceDenied));
  assert.equal(governanceDenied.payload.code, "QUESTION_VERSION_MISMATCH");
  assert.equal(await scalar("SELECT count(*) FROM question_attempts WHERE idempotency_key = $1", [`governance-deny-${runId}`]), 0);
  assert.equal(await scalar("SELECT count(*) FROM evidence_recompute_requests WHERE user_id = $1 AND source_event_id IS NULL", [userId]), 0);

  const forgedUser = await submitQuestion({
    email: "pg-qae-user-2@example.invalid",
    idempotencyKey: `forged-user-${runId}`,
    answer: wrongChoiceId,
    claimedUserId: userId,
  });
  assert.equal(forgedUser.response.status, 403, responseDiagnostic(forgedUser));
  assert.equal(forgedUser.payload.code, "ENROLLMENT_REQUIRED");
  assert.equal(await scalar("SELECT count(*) FROM question_attempts WHERE idempotency_key = $1", [`forged-user-${runId}`]), 0);
  assert.equal(await scalar("SELECT count(*) FROM evidence_recompute_requests WHERE user_id = $1 AND source_event_id IS NULL", [secondUserId]), 0);

  const failedKey = `request-failure-${runId}`;
  const beforeFailure = await transactionCounts();
  await client.unsafe(`
    CREATE OR REPLACE FUNCTION public.qae_test_abort_request() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test recompute request failure'; END; $$;
    CREATE TRIGGER qae_test_abort_request BEFORE INSERT ON public.evidence_recompute_requests
    FOR EACH ROW EXECUTE FUNCTION public.qae_test_abort_request();
  `);
  try {
    const failed = await submitQuestion({
      email: "pg-qae-user-1@example.invalid",
      idempotencyKey: failedKey,
      answer: wrongChoiceId,
    });
    assert.equal(failed.response.status, 500, responseDiagnostic(failed));
    assert.equal(await scalar("SELECT count(*) FROM question_attempts WHERE idempotency_key = $1", [failedKey]), 0);
    assert.deepEqual(await transactionCounts(), beforeFailure);
  } finally {
    await client.unsafe("DROP TRIGGER qae_test_abort_request ON public.evidence_recompute_requests; DROP FUNCTION public.qae_test_abort_request();");
  }

  const recovered = await submitQuestion({
    email: "pg-qae-user-1@example.invalid",
    idempotencyKey: failedKey,
    answer: wrongChoiceId,
  });
  assert.equal(recovered.response.status, 201, responseDiagnostic(recovered));
  assert.equal(recovered.payload.result.idempotentReplay, false);
  assert.equal(await scalar("SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = $1", [recovered.payload.result.attemptId]), 1);

  const scheduleFailedKey = `schedule-failure-${runId}`;
  await client.unsafe(`
    DELETE FROM review_schedules WHERE user_id = '${userId}' AND course_id = '${courseId}' AND target_id = '${questionId}';
    CREATE OR REPLACE FUNCTION public.qae_test_abort_schedule() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test review schedule failure'; END; $$;
    CREATE TRIGGER qae_test_abort_schedule BEFORE INSERT OR UPDATE ON public.review_schedules
    FOR EACH ROW EXECUTE FUNCTION public.qae_test_abort_schedule();
  `);
  try {
    const scheduleFailed = await submitQuestion({
      email: "pg-qae-user-1@example.invalid",
      idempotencyKey: scheduleFailedKey,
      answer: wrongChoiceId,
    });
    assert.equal(scheduleFailed.response.status, 500, responseDiagnostic(scheduleFailed));
    const scheduleFailedAttempt = await one(
      "SELECT id FROM question_attempts WHERE idempotency_key = $1",
      [scheduleFailedKey],
    );
    assert.ok(scheduleFailedAttempt);
    assert.equal(await scalar("SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = $1", [scheduleFailedAttempt.id]), 1);
    assert.equal(await scalar("SELECT count(*) FROM review_schedules WHERE user_id = $1 AND course_id = $2 AND target_id = $3", [userId, courseId, questionId]), 0);
  } finally {
    await client.unsafe("DROP TRIGGER qae_test_abort_schedule ON public.review_schedules; DROP FUNCTION public.qae_test_abort_schedule();");
  }
  const scheduleReplay = await submitQuestion({
    email: "pg-qae-user-1@example.invalid",
    idempotencyKey: scheduleFailedKey,
    answer: wrongChoiceId,
  });
  assert.equal(scheduleReplay.response.status, 201, responseDiagnostic(scheduleReplay));
  assert.equal(scheduleReplay.payload.result.idempotentReplay, true);
  assert.equal(await scalar("SELECT count(*) FROM review_schedules WHERE user_id = $1 AND course_id = $2 AND target_id = $3", [userId, courseId, questionId]), 0);

  const concurrentKey = `concurrent-${runId}`;
  const concurrent = await Promise.all([
    submitQuestion({ email: "pg-qae-user-1@example.invalid", idempotencyKey: concurrentKey, answer: wrongChoiceId }),
    submitQuestion({ email: "pg-qae-user-1@example.invalid", idempotencyKey: concurrentKey, answer: wrongChoiceId }),
  ]);
  const concurrentSuccesses = concurrent.filter((result) => result.response.status === 201);
  assert.equal(concurrentSuccesses.length, 1, concurrent.map(responseDiagnostic).join("\n"));
  const concurrentLosers = concurrent.filter((result) => result.response.status !== 201);
  assert.equal(concurrentLosers.length, 1, concurrent.map(responseDiagnostic).join("\n"));
  assert.equal(concurrentLosers[0].response.status, 500);
  assert.equal(concurrentLosers[0].payload.code, "DATABASE_UNIQUE_VIOLATION");
  assert.equal(await scalar("SELECT count(*) FROM question_attempts WHERE idempotency_key = $1", [concurrentKey]), 1);
  assert.equal(await scalar("SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = (SELECT id FROM question_attempts WHERE idempotency_key = $1)", [concurrentKey]), 1);
  const concurrentRetry = await submitQuestion({
    email: "pg-qae-user-1@example.invalid",
    idempotencyKey: concurrentKey,
    answer: wrongChoiceId,
  });
  assert.equal(concurrentRetry.response.status, 201, responseDiagnostic(concurrentRetry));
  assert.equal(concurrentRetry.payload.result.idempotentReplay, true);

  const legacyKey = `legacy-replay-${runId}`;
  const legacyAttemptId = `legacy-attempt-${runId}`;
  await client.unsafe(
    `INSERT INTO question_attempts
     (id, idempotency_key, user_id, question_id, course_id, mode, selected_answer,
       is_correct, score, response_time, question_version_id, concept_mapping_set_hash)
     VALUES ($1, $2, $3, $4, $5, 'LEARNING', $6, 0, 0, 300, $7, $8)`,
    [legacyAttemptId, legacyKey, userId, questionId, courseId, JSON.stringify(wrongChoiceId), questionVersionId, attempt.concept_mapping_set_hash],
  );
  const legacyReplay = await submitQuestion({
    email: "pg-qae-user-1@example.invalid",
    idempotencyKey: legacyKey,
    answer: wrongChoiceId,
  });
  assert.equal(legacyReplay.response.status, 201, responseDiagnostic(legacyReplay));
  assert.equal(legacyReplay.payload.result.idempotentReplay, true);
  assert.equal(legacyReplay.payload.result.attemptId, legacyAttemptId);
  assert.equal(await scalar("SELECT count(*) FROM evidence_recompute_requests WHERE source_event_id = $1", [legacyAttemptId]), 0);
});

async function applyPostgresFixture() {
  await client.unsafe("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;");
  const migrations = (await readdir("db/postgres/migrations"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .filter((name) => !["0002_server_only_rls_lockdown.sql", "0009_security_certification_taxonomy_cleanup.sql"].includes(name))
    .sort();
  for (const name of migrations) await client.unsafe(await readFile(`db/postgres/migrations/${name}`, "utf8"));
  await client.unsafe(
    `INSERT INTO users (id, email, display_name) VALUES
      ($1, 'pg-qae-user-1@example.invalid', 'Question Evidence User 1'),
      ($2, 'pg-qae-user-2@example.invalid', 'Question Evidence User 2'),
      ($3, 'pg-qae-admin@example.invalid', 'Question Evidence Admin')`,
    [userId, secondUserId, adminId],
  );
  await client.unsafe(
    `INSERT INTO course_groups (id, code, name, description) VALUES ($1, $2, 'Question Evidence Group', 'Disposable producer fixture')`,
    [groupId, `PG-QAE-${runId}`],
  );
  await client.unsafe(
    `INSERT INTO courses (id, course_group_id, code, slug, name, short_name, description, active, published)
     VALUES ($1, $2, $3, $4, 'Question Evidence Course', 'QAE', 'Disposable producer fixture', 1, 1)`,
    [courseId, groupId, `PG-QAE-${runId}`, `pg-qae-${runId}`],
  );
  await client.unsafe(
    `INSERT INTO subjects (id, course_id, code, name) VALUES ($1, $2, 'QAE-SUBJECT', 'Question Evidence Subject')`,
    [subjectId, courseId],
  );
  await client.unsafe(
    `INSERT INTO topics (id, subject_id, code, name) VALUES ($1, $2, 'QAE-TOPIC', 'Question Evidence Topic')`,
    [topicId, subjectId],
  );
  await client.unsafe(
    `INSERT INTO questions
      (id, title, content, type, difficulty, explanation, wrong_answer_explanation,
       status, source, source_date, version, answer_config_json, created_by,
       reviewed_by, published_at)
     VALUES ($1, 'Disposable governed question', 'Choose the governed answer.',
       'SINGLE_CHOICE', 'EASY', 'Correct explanation', 'Wrong explanation',
       'PUBLISHED', 'disposable-test', '2026-09-11', 1, '{}', $2, $2, CURRENT_TIMESTAMP)`,
    [questionId, adminId],
  );
  await client.unsafe(
    `INSERT INTO question_choices (id, question_id, content, display_order, is_correct, explanation) VALUES
      ($1, $3, 'Correct answer', 1, 1, ''),
      ($2, $3, 'Wrong answer', 2, 0, '')`,
    [correctChoiceId, wrongChoiceId, questionId],
  );
  await client.unsafe("INSERT INTO question_courses (question_id, course_id, weight) VALUES ($1, $2, 100)", [questionId, courseId]);
  await client.unsafe("INSERT INTO question_subjects (question_id, subject_id) VALUES ($1, $2)", [questionId, subjectId]);
  await client.unsafe("INSERT INTO question_topics (question_id, topic_id) VALUES ($1, $2)", [questionId, topicId]);
  await client.unsafe(
    `INSERT INTO question_versions
      (id, question_id, version, snapshot_json, review_comment, created_by,
       semantic_hash, human_review_hash, human_reviewed_by, human_reviewed_at)
     VALUES ($1, $2, 1, '{}', 'Disposable producer fixture', $3, $4, $5, $3, '2026-09-11T00:00:00.000Z')`,
    [questionVersionId, questionId, adminId, semanticHash, humanReviewHash],
  );
  await client.unsafe(
    `INSERT INTO ontology_concepts
      (id, concept_key, namespace, label, normalized_label, category, description, weight, status, metadata_json)
     VALUES ($1, $2, 'securium', 'Question Evidence Concept', 'question evidence concept', 'test', '', 1, 'ACTIVE', '{}')`,
    [conceptId, `securium.qae.${runId}`],
  );
  await client.unsafe(
    `INSERT INTO question_concepts
      (id, question_version_id, concept_id, created_by, relation_type,
       qualification_json, provenance_json, mapping_status, mapping_version,
       reviewed_by, reviewed_at)
     VALUES ($1, $2, $3, $4, 'MAPS_TO', '{}', '{}', 'APPROVED', 1, $4, '2026-09-11T00:00:00.000Z')`,
    [`${questionId}-mapping`, questionVersionId, conceptId, adminId],
  );
  await client.unsafe(
    `INSERT INTO user_course_enrollments (id, user_id, course_id, status)
     VALUES ($1, $2, $3, 'ACTIVE')`,
    [`${courseId}-${userId}-enrollment`, userId, courseId],
  );
}

async function submitQuestion({ email, idempotencyKey, answer, questionVersionId: versionId = questionVersionId, claimedUserId }) {
  const response = await fetch(`${server.baseUrl}/api/question-attempts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: server.baseUrl,
      "oai-authenticated-user-email": email,
    },
    body: JSON.stringify({
      questionId,
      ...(versionId ? { questionVersionId: versionId } : {}),
      courseId,
      answer,
      responseTime: 1200,
      idempotencyKey,
      ...(claimedUserId ? { userId: claimedUserId } : {}),
    }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text.slice(0, 1200) };
  }
  return { response, payload };
}

async function transactionCounts() {
  const rows = await client.unsafe(
    `SELECT
      (SELECT count(*) FROM question_attempts WHERE user_id = $1) AS attempts,
      (SELECT count(*) FROM learning_activities WHERE user_id = $1) AS activities,
      (SELECT count(*) FROM user_progress WHERE user_id = $1) AS progress,
      (SELECT count(*) FROM evidence_recompute_requests WHERE user_id = $1) AS requests,
      (SELECT count(*) FROM wrong_notes WHERE user_id = $1) AS wrong_notes,
      (SELECT count(*) FROM review_schedules WHERE user_id = $1) AS schedules`,
    [userId],
  );
  return Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]));
}

async function scalar(sql, parameters = []) {
  const row = await one(sql, parameters);
  return Number(Object.values(row ?? { count: 0 })[0] ?? 0);
}

async function one(sql, parameters = []) {
  const rows = await client.unsafe(sql, parameters);
  return rows[0] ?? null;
}

function responseDiagnostic(result) {
  return `${result.response.status} ${JSON.stringify(result.payload)}\n${server?.diagnostics?.outputTail ?? ""}`;
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
