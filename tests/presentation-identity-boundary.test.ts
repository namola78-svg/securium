import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const layout = read("app/layout.tsx");
const header = read("components/site-header.tsx");
const provider = read("components/presentation-identity-provider.tsx");
const controls = read("components/header-controls.tsx");
const learnerShell = read("components/learner-app-shell.tsx");
const session = read("app/api/auth/session/route.ts");

test("public root owns no server application identity resolution", () => {
  assert.doesNotMatch(layout, /getOptionalCurrentAppUser|getCurrentAppUser|resolveCurrentAppUser/);
  assert.doesNotMatch(header, /getOptionalCurrentAppUser|getCurrentAppUser|resolveCurrentAppUser|findUserWithRoleCodesByEmail/);
  assert.match(layout, /<PresentationIdentityProvider>/);
});

test("one provider owns the presentation session request", () => {
  assert.match(provider, /fetch\("\/api\/auth\/session"/);
  assert.match(provider, /let initialSessionRequest/);
  assert.doesNotMatch(provider, /setInterval|refreshInterval|refetchInterval/);
  assert.doesNotMatch(controls, /fetch\("\/api\/auth\/session"/);
  assert.doesNotMatch(learnerShell, /fetch\("\/api\/auth\/session"/);
});

test("session response is minimal, presentation-only, and never cacheable", () => {
  assert.match(session, /"Cache-Control": "no-store"/);
  assert.match(session, /authenticated: true/);
  assert.match(session, /displayName: user\.displayName/);
  assert.match(session, /roles: user\.roles/);
  assert.doesNotMatch(session, /user\.id|user\.email|token|cookie|secret/i);
});

test("server authorization remains in protected route boundaries", () => {
  for (const path of [
    "app/dashboard/page.tsx",
    "app/learn/[courseSlug]/page.tsx",
    "app/practice/page.tsx",
    "app/admin/layout.tsx",
  ]) {
    assert.match(read(path), /requireCurrentAppUser|requireQuestionAdministrator/);
  }
  assert.match(read("lib/auth.ts"), /requireApiUser/);
});

test("course enrollment shares the provider instead of fetching a second session", () => {
  const enrollment = read("components/course-enroll-action.tsx");
  assert.match(enrollment, /usePresentationIdentity/);
  assert.doesNotMatch(enrollment, /fetch\("\/api\/auth\/session"/);
});
