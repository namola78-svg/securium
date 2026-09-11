import assert from "node:assert/strict";
import test from "node:test";
import {
  computeIsmsPSourceLessonsJsonSha256,
  verifyIsmsPSourceLessonsJsonHash,
} from "../lib/data/isms-p-theory-batch1-materializer.mjs";
import {
  compareCanonicalIsmsPSourceLessonHash,
  dryRunIsmsPRuntimeMaterialization,
  getApprovedIsmsPAuthoringAuthority,
  validateIsmsPMaterializationPlan,
} from "../lib/materialization/isms-p-runtime-materialization.ts";

const fixtureSourceLessonsJson = JSON.stringify({
  lessons: [{ id: "lesson-fixture", title: "Fixture only" }],
});
const fixtureMultiLessonJson =
  '{"lessons":[{"id":"lesson-fixture","title":"Fixture only"},{"id":"lesson-other","title":"Other"}]}';
const fixtureMultiLessonJsonSha256 =
  "a97e9511a0ae457d6d5fbbef2f551cb76b59549677a71131e718f763630d0e75";

test("source hash helper verifies a matching fixture without granting authority", () => {
  const expectedLessonsJsonSha256 = computeIsmsPSourceLessonsJsonSha256(
    fixtureSourceLessonsJson,
  );
  const result = verifyIsmsPSourceLessonsJsonHash({
    sourceLessonId: "lesson-fixture",
    expectedLessonsJsonSha256,
    sourceLessonsJson: fixtureSourceLessonsJson,
  });

  assert.equal(result.status, "VERIFIED");
  assert.equal(result.actualLessonsJsonSha256, expectedLessonsJsonSha256);
  assert.equal(result.reason, "SOURCE_LESSONS_JSON_HASH_MATCHES_EXPECTATION");
});

test("lessonsJsonSha256 covers the full source document, not one lesson serialization", () => {
  for (const sourceLessonId of ["lesson-fixture", "lesson-other"]) {
    const result = verifyIsmsPSourceLessonsJsonHash({
      sourceLessonId,
      expectedLessonsJsonSha256: fixtureMultiLessonJsonSha256,
      sourceLessonsJson: fixtureMultiLessonJson,
    });

    assert.equal(result.status, "VERIFIED");
    assert.equal(result.actualLessonsJsonSha256, fixtureMultiLessonJsonSha256);
  }

  assert.notEqual(
    computeIsmsPSourceLessonsJsonSha256(
      '{"id":"lesson-fixture","title":"Fixture only"}',
    ),
    fixtureMultiLessonJsonSha256,
  );
});

test("source mutation is rejected while preserving the requested identity", () => {
  const expectedLessonsJsonSha256 = computeIsmsPSourceLessonsJsonSha256(
    fixtureSourceLessonsJson,
  );
  const tampered = fixtureSourceLessonsJson.replace("Fixture only", "Tampered");
  const result = verifyIsmsPSourceLessonsJsonHash({
    sourceLessonId: "lesson-fixture",
    expectedLessonsJsonSha256,
    sourceLessonsJson: tampered,
  });

  assert.equal(result.status, "MISMATCH");
  assert.notEqual(result.actualLessonsJsonSha256, expectedLessonsJsonSha256);
});

test("missing, malformed, and foreign source identities fail closed", () => {
  const expectedLessonsJsonSha256 = computeIsmsPSourceLessonsJsonSha256(
    fixtureSourceLessonsJson,
  );
  assert.equal(
    verifyIsmsPSourceLessonsJsonHash({
      sourceLessonId: "lesson-fixture",
      expectedLessonsJsonSha256,
      sourceLessonsJson: null,
    }).status,
    "MISSING",
  );
  assert.equal(
    verifyIsmsPSourceLessonsJsonHash({
      sourceLessonId: "lesson-fixture",
      expectedLessonsJsonSha256,
      sourceLessonsJson: JSON.stringify({ lessons: [{ id: "other-lesson" }] }),
    }).status,
    "IDENTITY_MISMATCH",
  );
  assert.equal(
    verifyIsmsPSourceLessonsJsonHash({
      sourceLessonId: "lesson-fixture",
      expectedLessonsJsonSha256,
      sourceLessonsJson: "not-json",
    }).status,
    "IDENTITY_MISMATCH",
  );
  assert.equal(
    verifyIsmsPSourceLessonsJsonHash({
      sourceLessonId: "lesson-fixture",
      expectedLessonsJsonSha256,
      sourceLessonsJson: new Uint8Array([0xff, 0xfe]),
    }).reason,
    "SOURCE_LESSONS_JSON_IS_NOT_VALID_UTF8",
  );
  assert.equal(
    verifyIsmsPSourceLessonsJsonHash({
      sourceLessonId: "lesson-fixture",
      expectedLessonsJsonSha256,
      sourceLessonsJson: JSON.stringify({
        lessons: [{ id: "lesson-fixture" }, { id: "lesson-fixture" }],
      }),
    }).reason,
    "SOURCE_LESSON_ID_NOT_UNIQUE_IN_SOURCE_DOCUMENT",
  );
});

test("canonical comparison owns the expected hash and ignores caller hash claims", () => {
  const missing = compareCanonicalIsmsPSourceLessonHash({
    officialCode: "2.2.6",
    sourceLessonsJson: null,
  });
  assert.equal(missing.status, "MISSING");
  assert.equal(
    missing.expectedLessonsJsonSha256,
    "ad5daa59e575c0cd5096a4c2dfe369f3c4c329be01a59fba4433a1001a941a27",
  );

  const forgedPayload = JSON.stringify({
    lessons: [{ id: missing.sourceLessonId, title: "Caller payload" }],
  });
  const forged = compareCanonicalIsmsPSourceLessonHash({
    officialCode: "2.2.6",
    sourceLessonsJson: forgedPayload,
    // Deliberately ignored at runtime: the public comparison has no caller
    // authority parameter for replacing the registry expectation.
    expectedLessonsJsonSha256: computeIsmsPSourceLessonsJsonSha256(forgedPayload),
  } as unknown as { officialCode: string; sourceLessonsJson: string | null });
  assert.equal(forged.status, "MISMATCH");
  assert.equal(
    forged.expectedLessonsJsonSha256,
    missing.expectedLessonsJsonSha256,
  );
});

test("source verification remains separate from preview hashes", () => {
  const verification = compareCanonicalIsmsPSourceLessonHash({
    officialCode: "2.2.6",
    sourceLessonsJson: null,
  });
  const plan = dryRunIsmsPRuntimeMaterialization();
  const previewHash = plan.canonicalSnapshot.registryRecords[0] as {
    metadata: { provenance: { approvedPreviewBodySha256: string } };
  };

  assert.match(previewHash.metadata.provenance.approvedPreviewBodySha256, /^[a-f0-9]{64}$/);
  assert.equal(verification.status, "MISSING");
  assert.equal(plan.rows[0].sourceLessonHashVerification.status, "UNRESOLVED");
  assert.equal(plan.rows[0].sourceLessonHashVerification.actualLessonsJsonSha256, null);
});

test("changing a source verification result invalidates the existing plan", () => {
  const plan = structuredClone(dryRunIsmsPRuntimeMaterialization()) as unknown as {
    canonicalSnapshot: {
      authoringSubjects: Array<{
        provenanceIdentity: { sourceLessonHashVerification: { status: string } };
      }>;
    };
  };
  plan.canonicalSnapshot.authoringSubjects[0].provenanceIdentity.sourceLessonHashVerification.status = "MISSING";

  const validation = validateIsmsPMaterializationPlan(plan);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(({ code }) => code === "PLAN_TAMPERED"));
});

test("dry-run binds unresolved source verification into the canonical plan snapshot", () => {
  const authority = getApprovedIsmsPAuthoringAuthority();
  const plan = dryRunIsmsPRuntimeMaterialization();
  const subjectVerifications = authority.subjects.map(
    (subject) => subject.provenanceIdentity.sourceLessonHashVerification,
  );
  const rowVerifications = plan.rows.map((row) => row.sourceLessonHashVerification);

  assert.equal(subjectVerifications.length, 12);
  assert.equal(rowVerifications.length, 12);
  assert.equal(subjectVerifications.every(({ status }) => status === "UNRESOLVED"), true);
  assert.equal(rowVerifications.every(({ status }) => status === "UNRESOLVED"), true);
  assert.equal(rowVerifications.every(({ actualLessonsJsonSha256 }) => actualLessonsJsonSha256 === null), true);
  assert.deepEqual(authority.provenance.sourceLessonHashVerification, {
    status: "UNRESOLVED",
    counts: {
      VERIFIED: 0,
      MISSING: 0,
      MISMATCH: 0,
      IDENTITY_MISMATCH: 0,
      UNRESOLVED: 12,
    },
  });
});
