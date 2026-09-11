import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateDraft } from "../scripts/validate-securium-isrm-s01-u01-draft.mjs";

test("S01-U01 draft validates as review-only content", async () => {
  const result = await validateDraft();
  assert.deepEqual(result, {
    status: "DRAFT_UNPUBLISHED_REVIEW_REQUIRED",
    learningUnitId: "isrm-2025-2027-s01-u01",
    objectiveCount: 2,
    theoryCount: 1,
    questionCount: 3,
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

test("draft package does not modify canonical authority or expose runtime imports", async () => {
  const readme = await readFile("content-drafts/securium-isrm-s01-u01-authoring/README.md", "utf8");
  const manifest = await readFile("content-drafts/securium-isrm-s01-u01-authoring/manifest.json", "utf8");
  assert.match(readme, /not canonical content/i);
  assert.match(readme, /not referenced by any runtime adapter/i);
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.governance.canonicalApproval, "NOT_REQUESTED");
  assert.equal(parsed.governance.revisionBinding, "NOT_ISSUED");
  assert.equal(parsed.governance.publication, "NOT_AUTHORIZED");
  assert.equal(parsed.governance.runtimeImport, "NONE");
});
