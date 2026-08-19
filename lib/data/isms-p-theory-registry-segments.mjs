import { getApprovedIsmsPTheoryBatch1Records } from "./isms-p-theory-batch1.mjs";

const BATCH_ID_PATTERN = /^[A-Z0-9_]+$/;

export const ISMS_P_THEORY_BATCH1_SEGMENT = Object.freeze({
  batchId: "ISMS_P_THEORY_BATCH_1",
  records: getApprovedIsmsPTheoryBatch1Records(),
});

export function flattenIsmsPTheoryRegistrySegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw registrySegmentError(
      "ISMS_P_REGISTRY_SEGMENTS_REQUIRED",
      "At least one registry segment is required.",
    );
  }
  const batchIds = new Set();
  const codes = new Set();
  const contentIds = new Set();
  const courseLessonIds = new Set();
  const extensionIds = new Set();
  const records = [];
  for (const segment of segments) {
    if (
      !segment ||
      typeof segment !== "object" ||
      typeof segment.batchId !== "string" ||
      !BATCH_ID_PATTERN.test(segment.batchId) ||
      !Array.isArray(segment.records) ||
      batchIds.has(segment.batchId)
    ) {
      throw registrySegmentError(
        "ISMS_P_REGISTRY_SEGMENT_INVALID",
        "Registry segments require unique uppercase batch IDs and record arrays.",
      );
    }
    batchIds.add(segment.batchId);
    for (const record of segment.records) {
      const code = record?.metadata?.officialCode;
      const contentId = record?.content?.id;
      const courseLessonId = record?.courseLesson?.id;
      const extensionId = record?.extension?.courseLessonId;
      const approval = record?.metadata?.approval;
      const provenance = record?.metadata?.provenance;
      if (
        typeof code !== "string" ||
        typeof contentId !== "string" ||
        typeof courseLessonId !== "string" ||
        typeof extensionId !== "string" ||
        record?.content?.status !== "PUBLISHED" ||
        approval?.humanSource !== "APPROVE" ||
        approval?.sme !== "APPROVE" ||
        approval?.example !== "KEEP" ||
        approval?.examPoint !== "KEEP" ||
        typeof provenance?.approvedPreviewBodySha256 !== "string" ||
        typeof provenance?.approvedPreviewSummarySha256 !== "string"
      ) {
        throw registrySegmentError(
          "ISMS_P_REGISTRY_RECORD_INVALID",
          "Registry records require approved published content, provenance, and unique identities.",
        );
      }
      if (
        codes.has(code) ||
        contentIds.has(contentId) ||
        courseLessonIds.has(courseLessonId) ||
        extensionIds.has(extensionId)
      ) {
        throw registrySegmentError(
          "ISMS_P_REGISTRY_RECORD_DUPLICATE",
          "Registry records require unique criterion, content, CourseLesson, and extension identities.",
        );
      }
      codes.add(code);
      contentIds.add(contentId);
      courseLessonIds.add(courseLessonId);
      extensionIds.add(extensionId);
      records.push(record);
    }
  }
  return records;
}

export function getIsmsPTheoryRegistrySegments(additionalSegments = []) {
  if (!Array.isArray(additionalSegments)) {
    throw registrySegmentError(
      "ISMS_P_REGISTRY_SEGMENTS_INVALID",
      "Additional registry segments must be an array.",
    );
  }
  return [ISMS_P_THEORY_BATCH1_SEGMENT, ...additionalSegments];
}

export function getIsmsPTheoryRegistryRecords(additionalSegments = []) {
  return flattenIsmsPTheoryRegistrySegments(
    getIsmsPTheoryRegistrySegments(additionalSegments),
  );
}

function registrySegmentError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
