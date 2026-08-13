import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  courseLessonExtensionSchema,
  courseLessonSchema,
  sharedContentSchema,
} from "../lib/validation.ts";
import {
  ISMS_P_THEORY_BATCH1_HOLD_CODES,
  ISMS_P_THEORY_BATCH1_READY_CODES,
  getApprovedIsmsPTheoryBatch1Records,
} from "../lib/data/isms-p-theory-batch1.mjs";

const expectedReadyCodes = [
  "2.2.6",
  "1.1.1",
  "1.3.3",
  "2.2.2",
  "2.4.1",
  "2.4.2",
  "2.4.3",
  "2.5.1",
  "2.5.2",
  "2.6.1",
  "2.8.3",
  "2.9.2",
];
const expectedHoldCodes = ["2.8.1", "2.10.1", "2.12.2"];
const integrationManifest = JSON.parse(
  readFileSync(
    "reports/content-audit/batch1-integration-manifest.json",
    "utf8",
  ),
);

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

test("ISMS-P Batch 1 registry discovers exactly the approved 12 and excludes all holds", () => {
  const records = getApprovedIsmsPTheoryBatch1Records();
  const codes = records.map((record) => record.metadata.officialCode);

  assert.deepEqual(ISMS_P_THEORY_BATCH1_READY_CODES, expectedReadyCodes);
  assert.deepEqual(ISMS_P_THEORY_BATCH1_HOLD_CODES, expectedHoldCodes);
  assert.deepEqual(codes, expectedReadyCodes);
  assert.equal(records.length, 12);
  assert.equal(new Set(codes).size, 12);
  assert.equal(
    codes.some((code) => expectedHoldCodes.includes(code)),
    false,
  );
});

test("ISMS-P Batch 1 records satisfy current Content V3 and course contracts", () => {
  const records = getApprovedIsmsPTheoryBatch1Records();

  for (const record of records) {
    assert.equal(sharedContentSchema.safeParse(record.content).success, true);
    assert.equal(courseLessonSchema.safeParse(record.courseLesson).success, true);
    assert.equal(
      courseLessonExtensionSchema.safeParse(record.extension).success,
      true,
    );
    assert.equal(record.content.status, "PUBLISHED");
    assert.equal(record.courseLesson.courseId, "course-isms-p");
    assert.equal(record.courseLesson.curriculumNodeId, "");
    assert.equal(record.metadata.curriculum.mapping, "EXACT");
    assert.equal(record.metadata.curriculum.runtimeLinkStatus, "DB_LINK_PENDING");
  }
});

test("ISMS-P Batch 1 integration preserves approved bodies, summaries, examples, and exam points", () => {
  const records = getApprovedIsmsPTheoryBatch1Records();

  for (const record of records) {
    const expected = integrationManifest.records.find(
      (entry: { code: string }) => entry.code === record.metadata.officialCode,
    );

    assert.ok(expected, `missing manifest record for ${record.metadata.officialCode}`);
    assert.equal(sha256(record.content.body), expected.body_sha256);
    assert.equal(sha256(record.content.summary), expected.summary_sha256);
    assert.equal(
      sha256(record.content.practicalExamplesJson),
      expected.example_sha256,
    );
    assert.equal(
      sha256(record.extension.examPointsJson),
      expected.exam_point_sha256,
    );
    assert.equal(
      sha256(record.content.body),
      record.metadata.provenance.approvedPreviewBodySha256,
    );
    assert.equal(
      sha256(record.content.summary),
      record.metadata.provenance.approvedPreviewSummarySha256,
    );
  }
});

test("ISMS-P Batch 1 keeps approval, currentness, source, and pending semantic metadata", () => {
  const records = getApprovedIsmsPTheoryBatch1Records();

  for (const record of records) {
    assert.deepEqual(record.metadata.approval, {
      humanSource: "APPROVE",
      sme: "APPROVE",
      example: "KEEP",
      examPoint: "KEEP",
    });
    assert.equal(
      record.metadata.currentness,
      record.metadata.officialCode === "2.2.6" ? "CURRENT" : "UNKNOWN",
    );
    assert.equal(record.metadata.source.official, true);
    assert.equal(record.metadata.source.tier, "TIER_1");
    assert.equal(record.metadata.source.version, "2023.11.23");
    assert.equal(record.metadata.source.pages.start > 0, true);
    assert.equal(
      record.metadata.source.pages.end >= record.metadata.source.pages.start,
      true,
    );
    assert.deepEqual(record.metadata.ontology, {
      status: "MULTIPLE_MATCH",
      decision: "PENDING",
    });
    assert.deepEqual(record.metadata.skos, {
      status: "UNRESOLVED",
      formalMapping: "PENDING",
    });
  }
});

test("ISMS-P Batch 1 production identifiers are unique and collision-free", () => {
  const records = getApprovedIsmsPTheoryBatch1Records();
  const contentIds = records.map((record) => record.content.id);
  const slugs = records.map((record) => record.content.slug);
  const canonicalKeys = records.map((record) => record.content.canonicalKey);
  const courseLessonIds = records.map((record) => record.courseLesson.id);

  assert.equal(new Set(contentIds).size, 12);
  assert.equal(new Set(slugs).size, 12);
  assert.equal(new Set(canonicalKeys).size, 12);
  assert.equal(new Set(courseLessonIds).size, 12);

  const existingSources = [
    "lib/data/security-certification-course-lessons.mjs",
    "scripts/apply-shared-content-seed.mjs",
    "db/seed.sql",
  ].map((path) => readFileSync(path, "utf8"));
  for (const id of [...contentIds, ...courseLessonIds]) {
    assert.equal(
      existingSources.some((source) => source.includes(id)),
      false,
      `${id} collides with existing repository content`,
    );
  }
});

test("ISMS-P Batch 1 product registry contains no local absolute paths or audit runtime links", () => {
  const source = readFileSync("lib/data/isms-p-theory-batch1.mjs", "utf8");

  assert.doesNotMatch(source, /[A-Z]:\\Users\\/i);
  assert.doesNotMatch(source, /Documents[\\/]Codex/i);
  assert.doesNotMatch(source, /file:\/\//i);
  assert.doesNotMatch(source, /reports[\\/]content-audit/i);
});
