import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDraft } from "../scripts/validate-securium-isrm-s01-u02-draft.mjs";

test("S01-U02 draft validates as review-only content", async () => {
  const result = await validateDraft();
  assert.deepEqual(result, {
    status: "DRAFT_UNPUBLISHED_REVIEW_REQUIRED",
    learningUnitId: "isrm-2025-2027-s01-u02",
    objectiveCount: 2,
    theoryCount: 1,
    questionCount: 2,
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

test("S01-U02 draft keeps canonical and runtime boundaries closed", async () => {
  const readme = await readFile("content-drafts/securium-isrm-s01-u02-authoring/README.md", "utf8");
  const manifest = JSON.parse(await readFile("content-drafts/securium-isrm-s01-u02-authoring/manifest.json", "utf8"));
  assert.match(readme, /not canonical content/i);
  assert.match(readme, /not .*runtime registration/i);
  assert.equal(manifest.governance.canonicalApproval, "NOT_REQUESTED");
  assert.equal(manifest.governance.revisionBinding, "NOT_ISSUED");
  assert.equal(manifest.governance.publication, "NOT_AUTHORIZED");
  assert.equal(manifest.governance.runtimeImport, "NONE");
});
