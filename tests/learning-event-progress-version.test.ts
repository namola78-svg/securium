import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyProgressEvidenceEligibility,
  resolveInlineContentVersion,
  resolveProgressContentRevision,
} from "../lib/services/content-revision-resolution.ts";

test("inline lesson/content versions bind supporting activity without upgrading legacy rows", () => {
  assert.deepEqual(resolveInlineContentVersion(3), { contentVersion: 3, eligibility: "VERSION_BOUND_SUPPORTING_ACTIVITY" });
  assert.equal(resolveInlineContentVersion(null), null);
  assert.equal(classifyProgressEvidenceEligibility(null), "LEGACY_CONTENT_VERSION_UNKNOWN_SUPPORTING_ACTIVITY_ONLY");
});

test("published audio/lecture revision identity must match its canonical parent", () => {
  assert.deepEqual(
    resolveProgressContentRevision(
      { contentType: "LECTURE", contentId: "lecture-1" },
      { id: "revision-1", contentType: "LECTURE", contentId: "lecture-1", version: "2", revisionStatus: "published", isLatest: true },
    ),
    { contentRevisionId: "revision-1", eligibility: "VERSION_BOUND_SUPPORTING_ACTIVITY" },
  );
  assert.throws(
    () => resolveProgressContentRevision(
      { contentType: "LECTURE", contentId: "lecture-1" },
      { id: "revision-2", contentType: "AUDIO_CONTENT", contentId: "audio-1", version: "2", revisionStatus: "published", isLatest: true },
    ),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "CONTENT_REVISION_MISMATCH",
  );
});
