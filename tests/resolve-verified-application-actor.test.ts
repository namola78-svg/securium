import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolveVerifiedApplicationActorFromRows } from "../lib/services/resolve-verified-application-actor.ts";
import type { VerifiedApplicationActorRow } from "../db/user-auth-identity-binding-repository.ts";

const row: VerifiedApplicationActorRow = {
  bindingId: "binding-1",
  bindingStatus: "ACTIVE",
  applicationUserId: "user-1",
  applicationUserStatus: "ACTIVE",
};

test("resolver returns only the unique ACTIVE binding to an ACTIVE application user", () => {
  assert.deepEqual(resolveVerifiedApplicationActorFromRows([row]), { userId: "user-1" });
});

test("resolver fails closed for pending, revoked, superseded, or inactive users", () => {
  for (const bindingStatus of ["PENDING", "REVOKED", "SUPERSEDED"]) {
    assert.equal(resolveVerifiedApplicationActorFromRows([{ ...row, bindingStatus }]), null);
  }
  assert.equal(resolveVerifiedApplicationActorFromRows([{ ...row, applicationUserStatus: "DISABLED" }]), null);
});

test("resolver fails closed for missing and ambiguous matches", () => {
  assert.equal(resolveVerifiedApplicationActorFromRows([]), null);
  assert.equal(resolveVerifiedApplicationActorFromRows([row, row]), null);
});

test("database lookup matches all six dimensions and has no email or write fallback", () => {
  const source = readFileSync("db/user-auth-identity-binding-repository.ts", "utf8");
  for (const dimension of ["authSystem", "authProvider", "authIssuer", "authProjectRef", "environmentClass", "authSubject"]) {
    assert.match(source, new RegExp(`eq\\(userAuthIdentityBindings\\.${dimension}, tuple\\.${dimension}\\)`));
  }
  assert.match(source, /\.limit\(2\)/);
  assert.doesNotMatch(source, /email|\.insert\(|\.update\(|\.delete\(/i);
});
