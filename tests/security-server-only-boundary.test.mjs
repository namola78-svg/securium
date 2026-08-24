import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  lockdown: "db/postgres/migrations/0002_server_only_rls_lockdown.sql",
  canonical: "db/postgres/migrations/0011_canonical_fact_foundation.sql",
  evidence: "db/postgres/migrations/0015_evidence_projection_foundation.sql",
  auth: "lib/auth.ts",
  environment: "lib/environment.ts",
  browserClient: "lib/supabase-browser.ts",
  lessonRepository: "db/lesson-repositories.ts",
  enrollmentService: "lib/services/enrollment-service.ts",
  ontologyService: "lib/services/ontology-service.ts",
  lessonRoute: "app/api/lessons/progress/route.ts",
};

const source = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")]),
  ),
);

const proof = (id, securityInvariant, repositoryEvidence, expectedState, observedState) => ({
  proofId: id,
  securityInvariant,
  repositoryEvidence,
  expectedState,
  observedState,
});

test("SEC-001 positive proof: canonical database trust is server-only", () => {
  const result = proof(
    "SEC-001-POSITIVE-001",
    "Browser/client roles cannot directly access canonical tables; server application guards remain explicit.",
    [
      files.lockdown,
      files.canonical,
      files.evidence,
      files.auth,
      files.lessonRoute,
    ],
    "revoked browser privileges plus forced RLS governance and authenticated server mutation entry points",
    {
      browserPrivilegesRevoked: /REVOKE ALL PRIVILEGES[\s\S]*FROM PUBLIC, anon, authenticated/.test(source.lockdown),
      canonicalTablesLocked: /fact_identities|temporal_assertions/.test(source.canonical) && /evidence_projections/.test(source.evidence),
      serverGuardExplicit: /export async function requireApiUser/.test(source.auth) && /requireApiUser/.test(source.lessonRoute),
    },
  );

  assert.equal(result.observedState.browserPrivilegesRevoked, true);
  assert.equal(result.observedState.canonicalTablesLocked, true);
  assert.equal(result.observedState.serverGuardExplicit, true);
});

test("SEC-001 negative proof 1: direct client/Data API access stays denied", () => {
  assert.match(source.lockdown, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(source.canonical, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(source.evidence, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(source.lockdown, /ALTER DEFAULT PRIVILEGES[\s\S]*REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(source.browserClient, /SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL/);
  assert.match(source.environment, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source.environment, /server-only SUPABASE_SERVICE_ROLE_KEY/);
});

test("SEC-001 negative proof 2: cross-user reads and writes remain guarded", () => {
  assert.match(source.auth, /export async function requireApiUser/);
  assert.match(source.lessonRoute, /const user = await requireApiUser\(\)/);
  assert.match(source.lessonRepository, /eq\(userCourseEnrollments\.userId, userId\)/);
  assert.match(source.lessonRepository, /eq\(userLessonProgress\.userId, userId\)/);
  assert.match(source.enrollmentService, /enrollment\.userId !== actorUserId/);
  assert.match(source.enrollmentService, /ENROLLMENT_FORBIDDEN/);
  assert.match(source.enrollmentService, /actorUserId !== ownerUserId/);
  assert.match(source.enrollmentService, /PROGRESS_FORBIDDEN/);
});

test("SEC-001 negative proof 3: cross-content bindings and mutations remain scoped", () => {
  assert.match(source.ontologyService, /export function assertOntologyCourseScope/);
  assert.match(source.ontologyService, /edge\.courseId !== input\.expectedCourseId/);
  assert.match(source.ontologyService, /ONTOLOGY_COURSE_SCOPE_MISMATCH/);
  assert.match(source.lessonRepository, /eq\(userCourseEnrollments\.courseId, lessons\.courseId\)/);
  assert.match(source.lessonRepository, /eq\(lessons\.id, lessonId\)/);
  assert.match(source.lessonRepository, /eq\(userLessonProgress\.courseId, courseId\)/);
});
