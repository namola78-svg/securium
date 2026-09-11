import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDraft } from "../scripts/validate-securium-isrm-s03-u01-draft.mjs";

test("S03-U01 draft validates as review-only content", async () => {
  const result = await validateDraft();
  assert.deepEqual(result, {
    status: "DRAFT_UNPUBLISHED_REVIEW_REQUIRED",
    learningUnitId: "isrm-2025-2027-s03-u01",
    objectiveCount: 2,
    theoryCount: 1,
    questionCount: 4,
    claimCount: 5,
    sourceExpressionReuse: 0,
    officialQuestionReconstruction: 0,
    canonicalApproval: "NOT_REQUESTED",
    publication: "NOT_AUTHORIZED",
    runtimeImport: "NONE",
    currentness: "PARTIAL",
    rights: "UNKNOWN_BLOCKED",
  });
});

test("S03-U01 draft keeps canonical and runtime boundaries closed", async () => {
  const readme = await readFile("content-drafts/securium-isrm-s03-u01-authoring/README.md", "utf8");
  const manifest = JSON.parse(await readFile("content-drafts/securium-isrm-s03-u01-authoring/manifest.json", "utf8"));
  assert.match(readme, /not canonical content/i);
  assert.match(readme, /not .*runtime registration/i);
  assert.equal(manifest.governance.canonicalApproval, "NOT_REQUESTED");
  assert.equal(manifest.governance.revisionBinding, "NOT_ISSUED");
  assert.equal(manifest.governance.publication, "NOT_AUTHORIZED");
  assert.equal(manifest.governance.runtimeImport, "NONE");
  assert.equal(manifest.governance.runtimeRegistration, 0);
  assert.equal(manifest.governance.runtimeDbIo, 0);
});
