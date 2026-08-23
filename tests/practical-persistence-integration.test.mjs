import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { Miniflare } from "miniflare";
import { PracticalRepository } from "../db/practical-repositories.ts";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { PracticalAttemptService } from "../lib/services/practical-attempt-service.ts";

let miniflare;
let database;
let provider;
let repository;
let service;
let clockTick = 0;

const practicalId = "practical:secure-development:diagnose-sql-injection";
const rubricId = "rubric:secure-development:diagnosis";
const rubricVersionId = `rubric-version:${rubricId}:v1`;
const practicalVersionId = `practical-version:${practicalId}:v1`;
const responseSpec = [
  { key: "reasoning", type: "FREE_TEXT", required: true },
];

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "sw-p1a-integration" },
  });
  database = await miniflare.getD1Database("DB");
  const migrations = await migrationFiles(false);
  for (const migration of migrations) await applyMigration(migration.sql);
  await seedReferences();
  provider = new D1DatabaseProvider(database);
  repository = new PracticalRepository(provider);
  service = new PracticalAttemptService(repository, () => {
    clockTick += 1;
    return new Date(Date.UTC(2026, 7, 20, 0, 0, clockTick));
  }, {
    authorize({ actorUserId }) {
      if (actorUserId === "reviewer") {
        return { actorUserId, actorRole: "CONTENT_REVIEWER" };
      }
      if (actorUserId === "system-evaluator") {
        return { actorUserId, actorRole: "SYSTEM" };
      }
      return null;
    },
  });
});

after(async () => {
  await miniflare?.dispose();
});

test("SW-P1A I01 fresh D1 migration creates exactly four P1A tables with foreign keys active", async () => {
  const beforeTables = await scalar(
    "SELECT count(*) AS value FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'",
  );
  assert.equal(beforeTables, 78);
  await applyMigration(await readMigration("drizzle/0022_peaceful_boom_boom.sql"));
  const p1aTables = await rows(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'practical_%' ORDER BY name",
  );
  assert.deepEqual(
    p1aTables.map((row) => row.name),
    [
      "practical_attempts",
      "practical_definition_versions",
      "practical_evaluations",
      "practical_rubric_versions",
    ],
  );
  assert.equal(await scalar("PRAGMA foreign_keys", "foreign_keys"), 1);
  assert.equal(await scalar("SELECT count(*) AS value FROM users"), 4);
  const migrationNames = await (await import("node:fs/promises")).readdir("drizzle");
  for (const slot of ["0023", "0024", "0025", "0026", "0027"]) {
    const migration = migrationNames.find((candidate) => candidate.startsWith(`${slot}_`) && candidate.endsWith(".sql"));
    assert.ok(migration, `migration ${slot} must exist`);
    await applyMigration(await readMigration(`drizzle/${migration}`));
  }
});

test("SW-P1A I02 rubric and definition versions enforce immutable compatible identities", async () => {
  const rubric = await service.storeRubricVersion({
    id: rubricVersionId,
    rubricId,
    version: 1,
    snapshot: { dimensions: [{ key: "core:detection" }] },
  });
  const definition = await service.storeDefinitionVersion({
    id: practicalVersionId,
    practicalId,
    version: 1,
    rubricVersionId,
    snapshot: {
      primaryObjectiveId: "assessment-objective:secure-development:diagnose-injection",
      supportingObjectiveIds: [],
      responseSpec,
    },
  });
  assert.match(rubric.snapshotDigest, /^[0-9a-f]{64}$/);
  assert.match(definition.snapshotDigest, /^[0-9a-f]{64}$/);
  await assert.rejects(
    service.storeRubricVersion({
      id: `${rubricVersionId}-duplicate`,
      rubricId,
      version: 1,
      snapshot: { dimensions: [] },
    }),
  );
  assert.equal(
    await scalar("SELECT count(*) AS value FROM practical_rubric_versions"),
    1,
  );
  await assert.rejects(rawAttemptInsert("fk-user", "missing-user", practicalVersionId, rubricVersionId));
  await assert.rejects(rawAttemptInsert("fk-definition", "user-a", "missing-definition", rubricVersionId));
  await assert.rejects(rawAttemptInsert("fk-rubric", "user-a", practicalVersionId, "missing-rubric"));
  await assert.rejects(rawEvaluationInsert("missing-attempt"));
  assert.equal(await scalar("SELECT count(*) AS value FROM practical_attempts"), 0);
  assert.equal(await scalar("SELECT count(*) AS value FROM practical_evaluations"), 0);
});

test("SW-P1A I03 attempt creation and audit are atomic and idempotent", async () => {
  const first = await createAttempt("i03", "user-a");
  const replay = await createAttempt("i03", "user-a");
  assert.equal(first.attempt.state, "IN_PROGRESS");
  assert.equal(replay.attempt.id, first.attempt.id);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(await countAttempts("i03"), 1);
  assert.equal(await auditCount("PRACTICAL_ATTEMPT_CREATED", first.attempt.id), 1);
});

test("SW-P1A I04 cross-user learner access denies reads and mutations", async () => {
  const created = await createAttempt("i04", "user-a");
  assert.equal(await service.getAttemptForUser(created.attempt.id, "user-b"), null);
  await assert.rejects(
    service.submitAttempt({
      attemptId: created.attempt.id,
      userId: "user-b",
      responses: response("intrusion"),
      submissionIdempotencyKey: "submit-i04-user-b",
    }),
    hasCode("ATTEMPT_NOT_FOUND"),
  );
  assert.equal((await service.getAttemptForUser(created.attempt.id, "user-a")).state, "IN_PROGRESS");

  const expired = await createAttempt("i04-expired", "user-a");
  assert.equal((await service.expireAttempt({ attemptId: expired.attempt.id, userId: "user-a" })).state, "EXPIRED");
  await assert.rejects(service.submitAttempt({
    attemptId: expired.attempt.id,
    userId: "user-a",
    responses: response("too late"),
    submissionIdempotencyKey: "submit-i04-expired",
  }));
  const voided = await createAttempt("i04-voided", "user-a");
  assert.equal((await service.voidAttempt({ attemptId: voided.attempt.id, userId: "user-a", reasonCode: "ADMIN_VOID" })).state, "VOIDED");
  const submitted = await createAndSubmit("i04-submitted-void", "user-a");
  await assert.rejects(service.createFirstEvaluation({
    ...evaluationInput(submitted, "i04-unauthorized-evaluator"),
    evaluatorAuthorization: {
      actorUserId: "user-b",
      actorRoles: ["USER"],
    },
  }), hasCode("EVALUATOR_AUTHORITY_REQUIRED"));
  assert.equal(await evaluationCount(submitted.id), 0);
  assert.equal((await service.voidAttempt({ attemptId: submitted.id, userId: "user-a", reasonCode: "REVIEW_VOID" })).state, "VOIDED");
  await assert.rejects(service.expireAttempt({ attemptId: submitted.id, userId: "user-a" }));
  assert.equal(await auditCount("PRACTICAL_ATTEMPT_EXPIRED", expired.attempt.id), 1);
  assert.equal(await auditCount("PRACTICAL_ATTEMPT_VOIDED", voided.attempt.id), 1);
  assert.equal(await auditCount("PRACTICAL_ATTEMPT_VOIDED", submitted.id), 1);
});

test("SW-P1A I05 submission atomically freezes one snapshot and replays idempotently", async () => {
  const created = await createAttempt("i05", "user-a");
  const input = {
    attemptId: created.attempt.id,
    userId: "user-a",
    responses: response("frozen"),
    artifactManifest: [{ artifactId: "a1", kind: "TEXT", digest: "d".repeat(64) }],
    submissionIdempotencyKey: "submit-i05",
  };
  const submitted = await service.submitAttempt(input);
  const replay = await service.submitAttempt(input);
  assert.equal(submitted.attempt.state, "SUBMITTED");
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.attempt.submissionDigest, submitted.attempt.submissionDigest);
  assert.equal(await auditCount("PRACTICAL_ATTEMPT_SUBMITTED", created.attempt.id), 1);
});

test("SW-P1A I06 concurrent double submit has one winner and one frozen snapshot", async () => {
  const created = await createAttempt("i06", "user-a");
  const submissions = await Promise.allSettled([
    service.submitAttempt({
      attemptId: created.attempt.id,
      userId: "user-a",
      responses: response("winner-a"),
      submissionIdempotencyKey: "submit-i06-a",
    }),
    service.submitAttempt({
      attemptId: created.attempt.id,
      userId: "user-a",
      responses: response("winner-b"),
      submissionIdempotencyKey: "submit-i06-b",
    }),
  ]);
  assert.equal(submissions.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(submissions.filter((item) => item.status === "rejected").length, 1);
  const final = await service.getAttemptForUser(created.attempt.id, "user-a");
  assert.equal(final.state, "SUBMITTED");
  assert.equal(await auditCount("PRACTICAL_ATTEMPT_SUBMITTED", created.attempt.id), 1);
});

test("SW-P1A I07 evaluation before submission has zero canonical mutation", async () => {
  const created = await createAttempt("i07", "user-a");
  await assert.rejects(
    service.createFirstEvaluation(evaluationInput(created.attempt, "i07")),
    hasCode("EVALUATION_BEFORE_SUBMISSION"),
  );
  assert.equal(await evaluationCount(created.attempt.id), 0);
  assert.equal((await service.getAttemptForUser(created.attempt.id, "user-a")).state, "IN_PROGRESS");
  assert.equal(await auditCount("PRACTICAL_EVALUATION_CREATED", `evaluation-i07`), 0);
  await service.recordEvaluatorFailure({
    evaluatorAuthorization: {
      actorUserId: "system-evaluator",
      actorRoles: ["SYSTEM"],
    },
    attemptId: created.attempt.id,
    reasonCode: "EXECUTION_UNAVAILABLE",
    evaluatorJobId: "job-i07-unavailable",
  });
  assert.equal(await evaluationCount(created.attempt.id), 0);
  assert.equal(
    await scalar("SELECT count(*) AS value FROM admin_audit_logs WHERE action = 'PRACTICAL_EVALUATOR_FAILED' AND result = 'FAILURE'"),
    1,
  );
});

test("SW-P1A I08 first evaluation, EVALUATED transition, audit, and rollback are atomic", async () => {
  const created = await createAndSubmit("i08", "user-a");
  const result = await service.createFirstEvaluation(evaluationInput(created, "i08"));
  assert.equal(result.evaluation.sequence, 1);
  assert.equal(result.evaluation.previousEvaluationId, null);
  assert.equal((await service.getAttemptForUser(created.id, "user-a")).state, "EVALUATED");
  assert.equal(await auditCount("PRACTICAL_EVALUATION_CREATED", "evaluation-i08"), 1);

  const rollbackAttempt = await createAndSubmit("i08-rollback", "user-a");
  await assert.rejects(
    service.createFirstEvaluation({
      ...evaluationInput(rollbackAttempt, "i08-rollback"),
      evaluatorAuthorization: {
        actorUserId: "missing-audit-actor",
        actorRoles: ["CONTENT_REVIEWER"],
      },
    }),
  );
  assert.equal(await evaluationCount(rollbackAttempt.id), 0);
  assert.equal((await service.getAttemptForUser(rollbackAttempt.id, "user-a")).state, "SUBMITTED");
});

test("SW-P1A I09 rubric mismatch is denied with zero mutation", async () => {
  const created = await createAndSubmit("i09", "user-a");
  await assert.rejects(
    service.createFirstEvaluation({
      ...evaluationInput(created, "i09"),
      rubricVersionId: `rubric-version:${rubricId}:v2`,
    }),
    hasCode("RUBRIC_VERSION_MISMATCH"),
  );
  assert.equal(await evaluationCount(created.id), 0);
  assert.equal((await service.getAttemptForUser(created.id, "user-a")).state, "SUBMITTED");

  await assert.rejects(
    service.createFirstEvaluation({
      ...evaluationInput(created, "i09-ai"),
      qualification: "QUALIFIED",
      provenance: { method: "AI_ASSISTED" },
    }),
  );
  await assert.rejects(
    service.createFirstEvaluation({
      ...evaluationInput(created, "i09-nonfinite"),
      provenance: { method: "RUBRIC", metadata: { nested: { value: Infinity } } },
    }),
  );
  await assert.rejects(
    service.createFirstEvaluation({
      ...evaluationInput(created, "i09-coercion"),
      dimensionResults: [{
        ...evaluationInput(created, "unused").dimensionResults[0],
        deterministicChecks: [{
          checkKey: "check-1",
          kind: "EXACT_OPTION",
          outcome: { toString: () => "PASS" },
        }],
      }],
    }),
  );
  assert.equal(await evaluationCount(created.id), 0);
  assert.equal((await service.getAttemptForUser(created.id, "user-a")).state, "SUBMITTED");
});

test("SW-P1A I10 duplicate evaluator callback creates one evaluation and one audit", async () => {
  const created = await createAndSubmit("i10", "user-a");
  const input = {
    ...evaluationInput(created, "i10"),
    evaluatorJobId: "job-i10",
    evaluatorResultId: "result-i10",
  };
  const first = await service.createFirstEvaluation(input);
  const replay = await service.createFirstEvaluation({
    ...input,
    evaluationId: "evaluation-i10-callback-replay",
    idempotencyKey: "evaluation-operation-i10-callback-replay",
  });
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.evaluation.id, first.evaluation.id);
  assert.equal(await evaluationCount(created.id), 1);
  assert.equal(await auditCount("PRACTICAL_EVALUATION_CREATED", "evaluation-i10"), 1);
});

test("SW-P1A I11 revisions append linearly and concurrent reviewers cannot branch", async () => {
  const created = await createAndSubmit("i11", "user-a");
  const first = await service.createFirstEvaluation(evaluationInput(created, "i11"));
  const base = {
    ...evaluationInput(created, "i11-revision-a"),
    previousEvaluationId: first.evaluation.id,
    qualification: "QUALIFIED",
    provenance: { method: "HUMAN_REVIEWED" },
    reviewerId: "reviewer",
    reviewStatus: "COMPLETED",
    reviewReason: "confirmed",
  };
  const revisions = await Promise.allSettled([
    service.appendEvaluationRevision(base),
    service.appendEvaluationRevision({
      ...base,
      evaluationId: "evaluation-i11-revision-b",
      idempotencyKey: "evaluation-operation-i11-revision-b",
    }),
  ]);
  assert.equal(revisions.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(revisions.filter((item) => item.status === "rejected").length, 1);
  const history = await service.listEvaluationHistoryForOwner(created.id, "user-a");
  assert.deepEqual(history.map((item) => item.sequence), [1, 2]);
  assert.equal(history[0].previousEvaluationId, null);
  assert.equal(history[1].previousEvaluationId, history[0].id);
  assert.equal(
    (await service.getEvaluationForOwner(history[0].id, "user-a")).id,
    history[0].id,
  );
  assert.equal(
    (await service.getLatestEvaluationForOwner(created.id, "user-a")).id,
    history[1].id,
  );
});

test("SW-P1A I12 D1 and PostgreSQL migrations preserve the frozen semantic inventory", async () => {
  const d1 = await readMigration("drizzle/0022_peaceful_boom_boom.sql");
  const postgres = await readFile(
    "db/postgres/migrations/0010_practical_attempt_evaluation_foundation.sql",
    "utf8",
  );
  for (const table of [
    "practical_rubric_versions",
    "practical_definition_versions",
    "practical_attempts",
    "practical_evaluations",
  ]) {
    assert.match(d1, new RegExp(`CREATE TABLE .${table}.`));
    assert.match(postgres, new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`));
    assert.match(postgres, new RegExp(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY`));
  }
  for (const fragment of [
    "practical_attempts_creation_idempotency_unique",
    "practical_attempts_submission_idempotency_unique",
    "practical_evaluations_sequence_unique",
    "practical_evaluations_predecessor_unique",
    "ON DELETE RESTRICT",
  ]) {
    assert.match(d1.toUpperCase(), new RegExp(fragment.toUpperCase().replaceAll("_", "_")));
    assert.match(postgres.toUpperCase(), new RegExp(fragment.toUpperCase().replaceAll("_", "_")));
  }
  assert.doesNotMatch(postgres, /^\s*(?:UPDATE|DELETE\s+FROM)\b/im);
  assert.equal(await scalar("SELECT count(*) AS value FROM practical_attempts WHERE id = 'not-present'"), 0);
});

test("SW-P1A I13 evaluation reads separate owner scope from explicit elevated access", async () => {
  const attempt = await createAndSubmit("i13", "user-a");
  const created = await service.createFirstEvaluation(evaluationInput(attempt, "i13"));
  const evaluationId = created.evaluation.id;
  const beforeCount = await evaluationCount(attempt.id);

  assert.equal(await service.getEvaluationForOwner(evaluationId, "user-b"), null);
  assert.equal(await service.getLatestEvaluationForOwner(attempt.id, "user-b"), null);
  assert.deepEqual(await service.listEvaluationHistoryForOwner(attempt.id, "user-b"), []);

  assert.equal(
    (await service.getEvaluationForOwner(evaluationId, "user-a")).id,
    evaluationId,
  );
  assert.equal(
    (await service.getLatestEvaluationForOwner(attempt.id, "user-a")).id,
    evaluationId,
  );
  assert.deepEqual(
    (await service.listEvaluationHistoryForOwner(attempt.id, "user-a")).map(
      (item) => item.id,
    ),
    [evaluationId],
  );

  const reviewer = {
    actorUserId: "reviewer",
    actorRoles: ["CONTENT_REVIEWER"],
  };
  assert.equal(
    (await service.getEvaluationForReviewer(evaluationId, reviewer)).id,
    evaluationId,
  );
  assert.equal(
    (await service.getLatestEvaluationForReviewer(attempt.id, reviewer)).id,
    evaluationId,
  );
  assert.deepEqual(
    (await service.listEvaluationHistoryForReviewer(attempt.id, reviewer)).map(
      (item) => item.id,
    ),
    [evaluationId],
  );
  assert.equal(await evaluationCount(attempt.id), beforeCount);
});

test("SW-P1A I14 owner authority and legacy scalar role spoofing cannot create evaluations", async () => {
  const ownerAttempt = await createAndSubmit("i14-owner", "user-a");
  await assert.rejects(
    service.createFirstEvaluation({
      ...evaluationInput(ownerAttempt, "i14-owner"),
      evaluatorAuthorization: {
        actorUserId: "user-a",
        actorRoles: ["USER"],
      },
    }),
    hasCode("EVALUATOR_AUTHORITY_REQUIRED"),
  );
  assert.equal(await evaluationCount(ownerAttempt.id), 0);
  await assert.rejects(
    service.recordEvaluatorFailure({
      evaluatorAuthorization: {
        actorUserId: "user-a",
        actorRoles: ["SYSTEM"],
      },
      attemptId: ownerAttempt.id,
      reasonCode: "EVALUATOR_ERROR",
    }),
    hasCode("EVALUATOR_AUTHORITY_REQUIRED"),
  );
  assert.equal(
    await scalar(
      "SELECT count(*) AS value FROM admin_audit_logs WHERE action = 'PRACTICAL_EVALUATOR_FAILED' AND actor_user_id = 'user-a'",
    ),
    0,
  );
  assert.equal(
    (await service.getAttemptForUser(ownerAttempt.id, "user-a")).state,
    "SUBMITTED",
  );
  assert.equal(
    await auditCount("PRACTICAL_EVALUATION_CREATED", "evaluation-i14-owner"),
    0,
  );
  await assert.rejects(
    service.createFirstEvaluation({
      ...evaluationInput(ownerAttempt, "i14-owner-system-spoof"),
      evaluatorAuthorization: {
        actorUserId: "user-a",
        actorRoles: ["SYSTEM"],
      },
    }),
    hasCode("EVALUATOR_AUTHORITY_REQUIRED"),
  );
  assert.equal(await evaluationCount(ownerAttempt.id), 0);

  const spoofAttempt = await createAndSubmit("i14-spoof", "user-a");
  await assert.rejects(
    service.createFirstEvaluation({
      ...evaluationInput(spoofAttempt, "i14-spoof"),
      evaluatorAuthorization: undefined,
      actorUserId: "user-a",
      actorRole: "CONTENT_REVIEWER",
    }),
    hasCode("EVALUATOR_AUTHORITY_REQUIRED"),
  );
  assert.equal(await evaluationCount(spoofAttempt.id), 0);
  assert.equal(
    (await service.getAttemptForUser(spoofAttempt.id, "user-a")).state,
    "SUBMITTED",
  );
});

test("SW-P1A I15 reviewer, deterministic system, and AI actor provenance remain truthful", async () => {
  const reviewerAttempt = await createAndSubmit("i15-reviewer", "user-a");
  await service.createFirstEvaluation(evaluationInput(reviewerAttempt, "i15-reviewer"));
  const reviewerAudit = await auditRow(
    "PRACTICAL_EVALUATION_CREATED",
    "evaluation-i15-reviewer",
  );
  assert.equal(reviewerAudit.actor_role, "CONTENT_REVIEWER");
  const reviewerEvaluation = await service.getEvaluationForReviewer(
    "evaluation-i15-reviewer",
    { actorUserId: "reviewer", actorRoles: ["CONTENT_REVIEWER"] },
  );
  assert.equal(JSON.parse(reviewerEvaluation.provenanceJson).evaluatorReference, "reviewer");

  const systemAttempt = await createAndSubmit("i15-system", "user-a");
  await service.createFirstEvaluation({
    ...evaluationInput(systemAttempt, "i15-system"),
    evaluatorAuthorization: {
      actorUserId: "system-evaluator",
      actorRoles: ["SYSTEM"],
    },
    provenance: { method: "DETERMINISTIC" },
  });
  const systemAudit = await auditRow(
    "PRACTICAL_EVALUATION_CREATED",
    "evaluation-i15-system",
  );
  assert.equal(systemAudit.actor_role, "SYSTEM");

  const aiAttempt = await createAndSubmit("i15-ai", "user-a");
  await service.createFirstEvaluation({
    ...evaluationInput(aiAttempt, "i15-ai"),
    evaluatorAuthorization: {
      actorUserId: "system-evaluator",
      actorRoles: ["SYSTEM"],
    },
    provenance: {
      method: "AI_ASSISTED",
      aiModel: { provider: "test-provider", model: "test-model" },
    },
  });
  const aiAudit = await auditRow(
    "PRACTICAL_EVALUATION_CREATED",
    "evaluation-i15-ai",
  );
  assert.equal(aiAudit.actor_role, "SYSTEM");
  assert.equal(JSON.parse(aiAudit.metadata_json).method, "AI_ASSISTED");

  const impersonationAttempt = await createAndSubmit("i15-ai-reviewer", "user-a");
  await assert.rejects(
    service.createFirstEvaluation({
      ...evaluationInput(impersonationAttempt, "i15-ai-reviewer"),
      provenance: {
        method: "AI_ASSISTED",
        aiModel: { provider: "test-provider", model: "test-model" },
      },
    }),
    hasCode("AI_EVALUATOR_ROLE_MISMATCH"),
  );
  assert.equal(await evaluationCount(impersonationAttempt.id), 0);
});

test("SW-P1A I16 defaults to deny when evaluator authorization policy is omitted", async () => {
  const noPolicyService = new PracticalAttemptService(repository, () =>
    new Date(Date.UTC(2026, 7, 20, 1, 0, 0))
  );
  const writeAttempt = await createAndSubmit("i16-write", "user-a");
  const evaluationId = "evaluation-i16-default-deny";
  const evaluationsBefore = await evaluationCount(writeAttempt.id);
  const successfulAuditsBefore = await auditCount(
    "PRACTICAL_EVALUATION_CREATED",
    evaluationId,
  );

  await assert.rejects(
    noPolicyService.createFirstEvaluation({
      ...evaluationInput(writeAttempt, "i16-default-deny"),
      evaluationId,
      evaluatorAuthorization: {
        actorUserId: "user-a",
        actorRoles: ["CONTENT_REVIEWER", "SYSTEM"],
      },
    }),
    hasCode("EVALUATOR_AUTHORITY_REQUIRED"),
  );
  assert.equal(await evaluationCount(writeAttempt.id), evaluationsBefore);
  assert.equal(
    (await service.getAttemptForUser(writeAttempt.id, "user-a")).state,
    "SUBMITTED",
  );
  assert.equal(
    await auditCount("PRACTICAL_EVALUATION_CREATED", evaluationId),
    successfulAuditsBefore,
  );

  const readAttempt = await createAndSubmit("i16-read", "user-a");
  const created = await service.createFirstEvaluation(
    evaluationInput(readAttempt, "i16-read"),
  );
  const elevatedAuthorization = {
    actorUserId: "reviewer",
    actorRoles: ["CONTENT_REVIEWER"],
  };
  assert.throws(
    () => noPolicyService.getEvaluationForReviewer(
      created.evaluation.id,
      elevatedAuthorization,
    ),
    hasCode("EVALUATOR_AUTHORITY_REQUIRED"),
  );
  assert.throws(
    () => noPolicyService.getLatestEvaluationForReviewer(
      readAttempt.id,
      elevatedAuthorization,
    ),
    hasCode("EVALUATOR_AUTHORITY_REQUIRED"),
  );
  assert.throws(
    () => noPolicyService.listEvaluationHistoryForReviewer(
      readAttempt.id,
      elevatedAuthorization,
    ),
    hasCode("EVALUATOR_AUTHORITY_REQUIRED"),
  );
  assert.equal(
    (await noPolicyService.getEvaluationForOwner(
      created.evaluation.id,
      "user-a",
    )).id,
    created.evaluation.id,
  );
  assert.equal(
    (await noPolicyService.getLatestEvaluationForOwner(
      readAttempt.id,
      "user-a",
    )).id,
    created.evaluation.id,
  );
  assert.deepEqual(
    (await noPolicyService.listEvaluationHistoryForOwner(
      readAttempt.id,
      "user-a",
    )).map((evaluation) => evaluation.id),
    [created.evaluation.id],
  );
});

async function createAttempt(suffix, userId) {
  return service.createAttempt({
    userId,
    practicalDefinitionVersionId: practicalVersionId,
    rubricVersionId,
    courseId: "course-sw-vuln",
    curriculumTreeId: "tree-sw-v1",
    curriculumTreeVersionReference: "v1",
    curriculumNodeId: "node-sw-practical",
    objectivePlacementId: `objective-placement-${suffix}`,
    practicalPlacementId: `practical-placement-${suffix}`,
    responseSpec,
    responses: response("draft"),
    artifactManifest: [],
    creationIdempotencyKey: `create-${suffix}`,
  });
}

async function createAndSubmit(suffix, userId) {
  const created = await createAttempt(suffix, userId);
  const submitted = await service.submitAttempt({
    attemptId: created.attempt.id,
    userId,
    responses: response(`submitted-${suffix}`),
    artifactManifest: [],
    submissionIdempotencyKey: `submit-${suffix}`,
  });
  return submitted.attempt;
}

function evaluationInput(attempt, suffix) {
  return {
    evaluationId: `evaluation-${suffix}`,
    attemptId: attempt.id,
    ownerUserId: attempt.userId,
    evaluatorAuthorization: {
      actorUserId: "reviewer",
      actorRoles: ["CONTENT_REVIEWER"],
    },
    practicalDefinitionVersionId: attempt.practicalDefinitionVersionId,
    rubricVersionId: attempt.rubricVersionId,
    dimensionResults: [
      {
        dimensionKey: "core:detection",
        outcome: "PASS",
        points: 1,
        maximumPoints: 1,
        deterministicChecks: [
          { checkKey: "check-1", kind: "EXACT_OPTION", outcome: "PASS" },
        ],
      },
    ],
    rawScore: 1,
    maximumScore: 1,
    qualification: "PENDING_REVIEW",
    provenance: { method: "RUBRIC" },
    reviewStatus: "PENDING",
    idempotencyKey: `evaluation-operation-${suffix}`,
  };
}

function response(value) {
  return [{ key: "reasoning", type: "FREE_TEXT", value }];
}

async function migrationFiles(includeP1a) {
  const names = Array.from({ length: includeP1a ? 23 : 22 }, (_, index) =>
    String(index).padStart(4, "0"),
  );
  const directory = await import("node:fs/promises").then((fs) => fs.readdir("drizzle"));
  const selected = directory
    .filter((name) => name.endsWith(".sql") && names.includes(name.slice(0, 4)))
    .sort();
  return Promise.all(selected.map(async (name) => ({ name, sql: await readMigration(`drizzle/${name}`) })));
}

async function readMigration(path) {
  return readFile(path, "utf8");
}

async function applyMigration(sql) {
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => database.prepare(statement));
  for (let index = 0; index < statements.length; index += 50) {
    await database.batch(statements.slice(index, index + 50));
  }
}

async function seedReferences() {
  const sql = `
    PRAGMA foreign_keys = ON;
    INSERT INTO users (id, email, display_name) VALUES
      ('user-a', 'p1a-user-a@example.invalid', 'P1A User A'),
      ('user-b', 'p1a-user-b@example.invalid', 'P1A User B'),
      ('reviewer', 'p1a-reviewer@example.invalid', 'P1A Reviewer'),
      ('system-evaluator', 'p1a-system@example.invalid', 'P1A System Evaluator');
    INSERT INTO course_groups (id, code, name) VALUES ('group-security', 'SECURITY', 'Security');
    INSERT INTO courses (id, course_group_id, code, slug, name, short_name)
      VALUES ('course-sw-vuln', 'group-security', 'SW', 'sw-vuln', 'SW Security', 'SW');
    INSERT INTO curriculum_trees (id, course_id, title, version)
      VALUES ('tree-sw-v1', 'course-sw-vuln', 'SW Tree', 'v1');
    INSERT INTO curriculum_nodes (id, curriculum_tree_id, node_type, title)
      VALUES ('node-sw-practical', 'tree-sw-v1', 'PRACTICAL', 'SW Practical');
  `;
  await database.batch(
    sql.split(";").map((statement) => statement.trim()).filter(Boolean)
      .map((statement) => database.prepare(statement)),
  );
}

async function rows(sql) {
  const result = await database.prepare(sql).all();
  return result.results ?? [];
}

async function scalar(sql, key = "value") {
  const row = await database.prepare(sql).first();
  return Number(row?.[key] ?? 0);
}

function countAttempts(suffix) {
  return scalar(`SELECT count(*) AS value FROM practical_attempts WHERE creation_idempotency_key = 'create-${suffix}'`);
}

function evaluationCount(attemptId) {
  return database.prepare("SELECT count(*) AS value FROM practical_evaluations WHERE attempt_id = ?")
    .bind(attemptId).first().then((row) => Number(row?.value ?? 0));
}

function rawAttemptInsert(id, userId, definitionVersionId, boundRubricVersionId) {
  return database.prepare(`INSERT INTO practical_attempts
    (id, user_id, practical_id, practical_definition_version_id, rubric_version_id,
     course_id, curriculum_tree_id, curriculum_tree_version_reference,
     curriculum_node_id, objective_placement_id, practical_placement_id,
     creation_idempotency_key)
    VALUES (?, ?, ?, ?, ?, 'course-sw-vuln', 'tree-sw-v1', 'v1',
      'node-sw-practical', 'objective-placement-fk', 'practical-placement-fk', ?)`)
    .bind(id, userId, practicalId, definitionVersionId, boundRubricVersionId, `create-${id}`)
    .run();
}

function rawEvaluationInsert(attemptId) {
  return database.prepare(`INSERT INTO practical_evaluations
    (id, attempt_id, sequence, practical_definition_version_id, rubric_version_id,
     method, dimension_results_json, qualification, provenance_json,
     evaluation_payload_digest, idempotency_key, evaluated_at)
    VALUES ('evaluation-fk', ?, 1, ?, ?, 'RUBRIC', '[]', 'PENDING_REVIEW', '{}', ?,
      'evaluation-operation-fk', '2026-08-20T00:00:00.000Z')`)
    .bind(attemptId, practicalVersionId, rubricVersionId, "e".repeat(64))
    .run();
}

function auditCount(action, resourceId) {
  return database.prepare("SELECT count(*) AS value FROM admin_audit_logs WHERE action = ? AND resource_id = ? AND result = 'SUCCESS'")
    .bind(action, resourceId).first().then((row) => Number(row?.value ?? 0));
}

function auditRow(action, resourceId) {
  return database.prepare(
    "SELECT actor_role, metadata_json FROM admin_audit_logs WHERE action = ? AND resource_id = ? AND result = 'SUCCESS' LIMIT 1",
  ).bind(action, resourceId).first();
}

function hasCode(code) {
  return (error) => error?.code === code;
}
