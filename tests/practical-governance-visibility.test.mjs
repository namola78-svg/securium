import assert from "node:assert/strict";
import { test } from "node:test";
import { assertReviewerOnlyVisibility } from "../lib/practical/practical-governance-validation.ts";

test("learner/public visibility is denied by the reviewer-only contract", () => {
  assert.throws(() => assertReviewerOnlyVisibility("LEARNER"), /REVIEWER_MATERIAL_VISIBILITY_DENIED/);
  assert.throws(() => assertReviewerOnlyVisibility("PUBLIC"), /REVIEWER_MATERIAL_VISIBILITY_DENIED/);
});
test("reviewer-only visibility is accepted only for server reviewer paths", () => {
  assert.doesNotThrow(() => assertReviewerOnlyVisibility("REVIEWER_ONLY"));
});
