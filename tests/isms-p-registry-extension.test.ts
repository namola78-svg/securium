import assert from "node:assert/strict";
import test from "node:test";
import { getApprovedIsmsPTheoryBatch1Records } from "../lib/data/isms-p-theory-batch1.mjs";
import {
  buildIsmsPBatchAwareMaterializationManifest,
} from "../lib/data/isms-p-theory-batch1-materializer.mjs";
import {
  flattenIsmsPTheoryRegistrySegments,
  getIsmsPTheoryRegistryRecords,
  ISMS_P_THEORY_BATCH1_SEGMENT,
} from "../lib/data/isms-p-theory-registry-segments.mjs";

function fixtureSegment(batchId = "ISMS_P_THEORY_BATCH_1A") {
  const source = getApprovedIsmsPTheoryBatch1Records()[0];
  return {
    batchId,
    records: ["9.1.1", "9.1.2", "9.1.3", "9.1.4"].map((code, index) => {
      const record = structuredClone(source);
      record.metadata.batch = batchId;
      record.metadata.officialCode = code;
      record.metadata.sourceLessonId = `lesson-${code.replaceAll(".", "-")}`;
      record.content.id = `fixture-content-${index + 1}`;
      record.content.slug = `fixture-content-${index + 1}`;
      record.content.canonicalKey = `fixture.content.${index + 1}`;
      record.courseLesson.id = `fixture-course-lesson-${index + 1}`;
      record.courseLesson.lessonId = `fixture-lesson-${index + 1}`;
      record.extension.courseLessonId = record.courseLesson.id;
      return record;
    }),
  };
}

test("Batch 1 remains an immutable registry segment", () => {
  const records = getIsmsPTheoryRegistryRecords();
  assert.equal(records.length, 12);
  assert.deepEqual(
    records.map((record) => record.metadata.officialCode),
    getApprovedIsmsPTheoryBatch1Records().map((record) => record.metadata.officialCode),
  );
  assert.equal(ISMS_P_THEORY_BATCH1_SEGMENT.batchId, "ISMS_P_THEORY_BATCH_1");
});

test("append-only segments derive aggregate records and three semantic operations per record", () => {
  const segment = fixtureSegment();
  const records = getIsmsPTheoryRegistryRecords([segment]);
  const manifest = buildIsmsPBatchAwareMaterializationManifest([segment]);
  assert.equal(records.length, 16);
  assert.equal(manifest.length, 16);
  assert.equal(manifest.length * 3, 48);
  assert.deepEqual(
    manifest.slice(-4).map((entry: { code: string }) => entry.code),
    ["9.1.1", "9.1.2", "9.1.3", "9.1.4"],
  );
});

test("segment and record identities are independent of input ordering", () => {
  const segment = fixtureSegment();
  const reversed = { ...segment, records: [...segment.records].reverse() };
  const first = getIsmsPTheoryRegistryRecords([segment]);
  const second = getIsmsPTheoryRegistryRecords([reversed]);
  assert.deepEqual(
    new Set(first.map((record) => record.metadata.officialCode)),
    new Set(second.map((record) => record.metadata.officialCode)),
  );
  assert.deepEqual(
    new Set(first.map((record) => record.content.id)),
    new Set(second.map((record) => record.content.id)),
  );
});

test("duplicate batch and record identities fail closed", () => {
  const segment = fixtureSegment();
  assert.throws(
    () => flattenIsmsPTheoryRegistrySegments([ISMS_P_THEORY_BATCH1_SEGMENT, ISMS_P_THEORY_BATCH1_SEGMENT]),
    (error: { code?: string }) => error.code === "ISMS_P_REGISTRY_SEGMENT_INVALID",
  );
  assert.throws(
    () => getIsmsPTheoryRegistryRecords([{ ...segment, records: [...segment.records, segment.records[0]] }]),
    (error: { code?: string }) => error.code === "ISMS_P_REGISTRY_RECORD_DUPLICATE",
  );
  const unapproved = structuredClone(segment.records[0]);
  unapproved.content.status = "DRAFT";
  assert.throws(
    () => getIsmsPTheoryRegistryRecords([{ ...segment, records: [unapproved] }]),
    (error: { code?: string }) => error.code === "ISMS_P_REGISTRY_RECORD_INVALID",
  );
});

test("criterion 1.1.1 collision is rejected rather than silently replacing Batch 1", () => {
  const segment = fixtureSegment();
  const duplicate = structuredClone(segment.records[0]);
  duplicate.metadata.officialCode = "1.1.1";
  assert.throws(
    () => getIsmsPTheoryRegistryRecords([{ ...segment, records: [duplicate] }]),
    (error: { code?: string }) => error.code === "ISMS_P_REGISTRY_RECORD_DUPLICATE",
  );
});

test("empty extension preserves the historical Batch 1 manifest", () => {
  const manifest = buildIsmsPBatchAwareMaterializationManifest([]);
  assert.equal(manifest.length, 12);
  assert.equal(manifest.length * 3, 36);
});

test("multiple append-only segments remain independently addressable", () => {
  const first = fixtureSegment("ISMS_P_THEORY_BATCH_1B");
  const second = fixtureSegment("ISMS_P_THEORY_BATCH_1C");
  second.records = second.records.map((record, index) => {
    record.metadata.officialCode = `9.2.${index + 1}`;
    record.content.id = `fixture-content-c-${index + 1}`;
    record.content.slug = `fixture-content-c-${index + 1}`;
    record.content.canonicalKey = `fixture.content.c.${index + 1}`;
    record.courseLesson.id = `fixture-course-lesson-c-${index + 1}`;
    record.extension.courseLessonId = record.courseLesson.id;
    return record;
  });
  assert.equal(getIsmsPTheoryRegistryRecords([first, second]).length, 20);
});
