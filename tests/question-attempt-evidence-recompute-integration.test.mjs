import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startVinextTestServer } from "./support/vinext-test-server.mjs";

let server;
let baseUrl;
let d1PersistPath;
const runId = `${process.pid}-${Date.now()}`;
const governedQuestionId = "course-isms-p-question-01";
const governedQuestionVersionId = `${governedQuestionId}-version-01`;

before(async () => {
  d1PersistPath = await mkdtemp(join(tmpdir(), "securium-evidence-once-producer-d1-"));
  process.env.D1_TEST_MODE = "1";
  process.env.D1_TEST_PERSIST_PATH = d1PersistPath;
  const migration = await runCommand([
    "scripts/run-wrangler.mjs",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
  ]);
  assert.equal(migration.code, 0, migration.output);
  const seed = await runCommand([
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
    "--file",
    "db/seed.sql",
  ]);
  assert.equal(seed.code, 0, seed.output);
  server = await startVinextTestServer({
    label: "Question attempt evidence recompute integration",
    env: {
      APP_BUILD_TARGET: "cloudflare",
      APP_ENV: "test",
      AUTH_PROVIDER: "sites",
      DB_PROVIDER: "d1",
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
    },
  });
  baseUrl = server.baseUrl;
  await prepareGovernedQuestionFixture();
});

after(async () => {
  await server?.stop();
  delete process.env.D1_TEST_MODE;
  delete process.env.D1_TEST_PERSIST_PATH;
  await rm(d1PersistPath, { recursive: true, force: true }).catch(() => {});
});

test("governed question submission atomically queues one event-scoped recompute request", async () => {
  const first = await submitQuestion({
    email: "dev-user-1@example.invalid",
    idempotencyKey: `question-evidence-${runId}-first`,
    questionVersionId: governedQuestionVersionId,
  });
  assert.equal(
    first.response.status,
    201,
    `${JSON.stringify(first.payload)}\n${server?.diagnostics?.outputTail ?? ""}`,
  );
  assert.equal(first.payload.result.idempotentReplay, false);

  const canonical = await queryOne(
    `SELECT id, user_id, question_id, question_version_id,
      concept_mapping_set_hash, course_id
     FROM question_attempts WHERE id = '${first.payload.result.attemptId}'`,
  );
  assert.equal(canonical.id, first.payload.result.attemptId);
  assert.equal(canonical.user_id, "user-learner-1");
  assert.equal(canonical.question_id, governedQuestionId);
  assert.equal(canonical.question_version_id, governedQuestionVersionId);
  assert.equal(canonical.course_id, "course-isms-p");
  assert.match(canonical.concept_mapping_set_hash, /^[0-9a-f]{64}$/);

  const request = await queryOne(
    `SELECT request_type, scope_type, source_type, source_event_id,
      source_revision_identity, user_id, projection_version, status
     FROM evidence_recompute_requests
     WHERE source_event_id = '${first.payload.result.attemptId}'`,
  );
  assert.deepEqual(request, {
    request_type: "EVIDENCE_RECOMPUTE_REQUIRED",
    scope_type: "EVENT",
    source_type: "QUESTION_ATTEMPT",
    source_event_id: first.payload.result.attemptId,
    source_revision_identity: first.payload.result.attemptId,
    user_id: "user-learner-1",
    projection_version: "EVIDENCE_V1",
    status: "PENDING",
  });
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM evidence_projections
       WHERE source_event_id = '${first.payload.result.attemptId}'`,
    ),
    0,
    "request creation must not be reported as Evidence calculation completion",
  );

  const replay = await submitQuestion({
    email: "dev-user-1@example.invalid",
    idempotencyKey: `question-evidence-${runId}-first`,
    questionVersionId: governedQuestionVersionId,
  });
  assert.equal(replay.response.status, 201, JSON.stringify(replay.payload));
  assert.equal(replay.payload.result.idempotentReplay, true);
  assert.equal(replay.payload.result.attemptId, first.payload.result.attemptId);
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM question_attempts
       WHERE user_id = 'user-learner-1'
         AND idempotency_key = 'question-evidence-${runId}-first'`,
    ),
    1,
  );
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM evidence_recompute_requests
       WHERE source_event_id = '${first.payload.result.attemptId}'`,
    ),
    1,
  );

  const retake = await submitQuestion({
    email: "dev-user-1@example.invalid",
    idempotencyKey: `question-evidence-${runId}-retake`,
    questionVersionId: governedQuestionVersionId,
  });
  assert.equal(retake.response.status, 201, JSON.stringify(retake.payload));
  assert.equal(retake.payload.result.idempotentReplay, false);
  assert.notEqual(retake.payload.result.attemptId, first.payload.result.attemptId);
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM evidence_recompute_requests
       WHERE source_type = 'QUESTION_ATTEMPT'
         AND source_event_id IN ('${first.payload.result.attemptId}', '${retake.payload.result.attemptId}')`,
    ),
    2,
  );

  const governedWithoutVersion = await submitQuestion({
    email: "dev-user-1@example.invalid",
    idempotencyKey: `question-evidence-${runId}-missing-version`,
  });
  assert.equal(governedWithoutVersion.response.status, 409);
  assert.equal(governedWithoutVersion.payload.code, "QUESTION_VERSION_MISMATCH");
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM question_attempts
       WHERE user_id = 'user-learner-1'
         AND idempotency_key = 'question-evidence-${runId}-missing-version'`,
    ),
    0,
  );
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM evidence_recompute_requests
       WHERE user_id = 'user-learner-1'
         AND reason_code = 'QUESTION_ATTEMPT_CREATED'
         AND source_event_id IS NULL`,
    ),
    0,
  );

  const forgedUser = await submitQuestion({
    email: "dev-user-2@example.invalid",
    idempotencyKey: `question-evidence-${runId}-forged-user`,
    questionVersionId: governedQuestionVersionId,
    claimedUserId: "user-learner-1",
  });
  assert.equal(forgedUser.response.status, 403);
  assert.equal(forgedUser.payload.code, "ENROLLMENT_REQUIRED");
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM question_attempts
       WHERE idempotency_key = 'question-evidence-${runId}-forged-user'`,
    ),
    0,
  );
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM evidence_recompute_requests
       WHERE reason_code = 'QUESTION_ATTEMPT_CREATED'
         AND user_id = 'user-learner-2'`,
    ),
    0,
  );

  const failedIdempotencyKey = `question-evidence-${runId}-request-failure`;
  const requestCountBeforeFailure = await scalar(
    `SELECT count(*) AS count FROM evidence_recompute_requests
     WHERE user_id = 'user-learner-1'
       AND source_type = 'QUESTION_ATTEMPT'
       AND reason_code = 'QUESTION_ATTEMPT_CREATED'`,
  );
  await executeCommand(
    "CREATE TRIGGER evidence_test_recompute_request_abort BEFORE INSERT ON evidence_recompute_requests BEGIN SELECT RAISE(ABORT, 'test recompute request failure'); END",
  );
  try {
    const failed = await submitQuestion({
      email: "dev-user-1@example.invalid",
      idempotencyKey: failedIdempotencyKey,
      questionVersionId: governedQuestionVersionId,
    });
    assert.equal(failed.response.status, 500, JSON.stringify(failed.payload));
    assert.equal(
      await scalar(
        `SELECT count(*) AS count FROM question_attempts
         WHERE user_id = 'user-learner-1'
           AND idempotency_key = '${failedIdempotencyKey}'`,
      ),
      0,
      "a request insert failure must roll back the canonical attempt",
    );
    assert.equal(
      await scalar(
        `SELECT count(*) AS count FROM evidence_recompute_requests
         WHERE user_id = 'user-learner-1'
           AND source_type = 'QUESTION_ATTEMPT'
           AND reason_code = 'QUESTION_ATTEMPT_CREATED'`,
      ),
      requestCountBeforeFailure,
      "a request insert failure must not leave a recompute request",
    );
  } finally {
    await executeCommand("DROP TRIGGER evidence_test_recompute_request_abort");
  }

  const recovered = await submitQuestion({
    email: "dev-user-1@example.invalid",
    idempotencyKey: failedIdempotencyKey,
    questionVersionId: governedQuestionVersionId,
  });
  assert.equal(recovered.response.status, 201, JSON.stringify(recovered.payload));
  assert.equal(recovered.payload.result.idempotentReplay, false);
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM question_attempts
       WHERE user_id = 'user-learner-1'
         AND idempotency_key = '${failedIdempotencyKey}'`,
    ),
    1,
  );
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM evidence_recompute_requests
       WHERE source_event_id = '${recovered.payload.result.attemptId}'`,
    ),
    1,
  );
});

test("legacy question submission remains canonical-only and does not enqueue Evidence work", async () => {
  const result = await submitQuestion({
    email: "dev-user-1@example.invalid",
    idempotencyKey: `question-evidence-${runId}-legacy`,
    questionId: "course-isms-p-question-02",
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  assert.equal(result.payload.result.idempotentReplay, false);
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM evidence_recompute_requests
       WHERE source_event_id = '${result.payload.result.attemptId}'`,
    ),
    0,
  );
});

test("manual once subprocess processes the request created by the HTTP producer", async () => {
  const result = await submitQuestion({
    email: "dev-user-1@example.invalid",
    idempotencyKey: `question-evidence-${runId}-worker-once`,
    questionVersionId: governedQuestionVersionId,
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.payload));
  const attemptId = result.payload.result.attemptId;
  const pending = await queryOne(
    `SELECT id, status FROM evidence_recompute_requests WHERE source_event_id = '${attemptId}'`,
  );
  assert.equal(pending.status, "PENDING");

  await server.stop();
  let processedRequestId = null;
  for (let invocation = 0; invocation < 8 && processedRequestId !== pending.id; invocation += 1) {
    const runner = await runCommand([
      "node_modules/tsx/dist/cli.mjs",
      "scripts/run-question-attempt-evidence-once.mjs",
      "--local-disposable",
      "--provider=d1",
      `--d1-persist-to=${d1PersistPath}`,
      "--d1-database=00000000-0000-4000-8000-000000000000",
    ]);
    assert.equal(runner.code, 0, runner.output);
    const output = runner.output.trim().split(/\r?\n/).reverse().find((line) => line.trim().startsWith("{"));
    assert.ok(output, runner.output);
    const onceResult = JSON.parse(output);
    assert.equal(onceResult.status, "COMPLETED");
    assert.ok(onceResult.requestId);
    processedRequestId = onceResult.requestId;
  }
  assert.equal(processedRequestId, pending.id);

  const completed = await queryOne(
    `SELECT status FROM evidence_recompute_requests WHERE source_event_id = '${attemptId}'`,
  );
  assert.equal(completed.status, "COMPLETED");
  assert.equal(
    await scalar(
      `SELECT count(*) AS count FROM evidence_projections WHERE source_event_id = '${attemptId}' AND lifecycle = 'ACTIVE'`,
    ),
    1,
  );
});

async function prepareGovernedQuestionFixture() {
  const semanticHash = "a".repeat(64);
  const humanReviewHash = "b".repeat(64);
  const command = [
    `INSERT OR IGNORE INTO ontology_concepts
      (id, concept_key, namespace, label, normalized_label, category, description, weight, status, metadata_json)
      VALUES ('question-attempt-evidence-test-concept', 'securium.question-attempt-evidence-test', 'securium', 'Question attempt evidence test', 'question attempt evidence test', 'test', '', 1, 'ACTIVE', '{}')`,
    `UPDATE question_versions SET
      semantic_hash = '${semanticHash}',
      human_review_hash = '${humanReviewHash}',
      human_reviewed_by = 'user-admin',
      human_reviewed_at = '2026-09-11T00:00:00.000Z'
      WHERE id = '${governedQuestionVersionId}'`,
    `INSERT OR IGNORE INTO question_concepts
      (id, question_version_id, concept_id, created_by, relation_type,
       qualification_json, provenance_json, mapping_status, mapping_version,
       reviewed_by, reviewed_at)
      VALUES ('question-attempt-evidence-test-mapping', '${governedQuestionVersionId}',
        'question-attempt-evidence-test-concept', 'user-admin', 'MAPS_TO', '{}', '{}',
        'APPROVED', 1, 'user-admin', '2026-09-11T00:00:00.000Z')`,
  ].join("; ");
  const result = await runCommand([
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
    "--command",
    command,
  ]);
  assert.equal(result.code, 0, result.output);
}

async function submitQuestion({
  email,
  idempotencyKey,
  questionId = governedQuestionId,
  questionVersionId,
  claimedUserId,
}) {
  const response = await fetch(`${baseUrl}/api/question-attempts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "oai-authenticated-user-email": email,
    },
    body: JSON.stringify({
      questionId,
      ...(questionVersionId ? { questionVersionId } : {}),
      courseId: "course-isms-p",
      answer: `${questionId}-choice-01`,
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
    assert.fail(`Expected JSON response (${response.status}): ${text.slice(0, 1200)}`);
  }
  return { response, payload };
}

async function scalar(command) {
  const row = await queryOne(command);
  return Number(row?.count ?? 0);
}

async function queryOne(command) {
  const result = await runCommand([
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
    "--command",
    command,
    "--json",
  ]);
  assert.equal(result.code, 0, result.output);
  const document = parseWranglerJson(result.output);
  const rows = document.flatMap((entry) => entry.results ?? []);
  return rows[0] ?? null;
}

async function executeCommand(command) {
  const result = await runCommand([
    "scripts/run-wrangler.mjs",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    "wrangler.local.jsonc",
    "--command",
    command,
  ]);
  assert.equal(result.code, 0, result.output);
}

function parseWranglerJson(output) {
  const candidates = [output.trim()];
  const arrayStart = output.indexOf("[");
  if (arrayStart >= 0) candidates.push(output.slice(arrayStart).trim());
  const objectStart = output.indexOf("{");
  if (objectStart >= 0) candidates.push(output.slice(objectStart).trim());
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
    } catch {
      // Wrangler can prefix JSON with diagnostic lines.
    }
  }
  assert.fail(`Could not parse Wrangler JSON output: ${output.slice(0, 2000)}`);
}

function runCommand(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", (error) => resolve({ code: 1, output: error.message }));
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}
