import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicCourseOutlineAdapter,
  MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS,
  MAX_PUBLIC_COURSE_OUTLINE_TOPICS,
} from "../lib/services/public-course-outline-adapter.ts";

test("returns the public course and deterministically ordered subject/topic outline", async () => {
  const { adapter, calls } = createFixtureAdapter({
    curriculum: [
      subject("subject-b", 1, [topic("topic-b", "subject-b", 1)]),
      subject("subject-a", 1, [
        topic("topic-z", "subject-a", 1),
        topic("topic-a", "subject-a", 1),
      ]),
    ],
  });

  const result = await adapter({ courseSlug: "public-course" });

  assert.equal(result.status, "OK");
  assert.deepEqual(calls, ["course:public-course", "curriculum:course-1"]);
  assert.deepEqual(result.subjects.map((item) => item.id), ["subject-a", "subject-b"]);
  assert.deepEqual(result.subjects[0].topics.map((item) => item.id), ["topic-a", "topic-z"]);
});

test("rejects a subject or topic relationship that does not belong to the public course", async () => {
  const { adapter: subjectAdapter } = createFixtureAdapter({
    curriculum: [subject("other-subject", 1, [], { courseId: "other-course" })],
  });
  const { adapter: topicAdapter } = createFixtureAdapter({
    curriculum: [
      subject("subject-a", 1, [topic("topic-a", "other-subject", 1)]),
    ],
  });

  assert.deepEqual(await subjectAdapter({ courseSlug: "public-course" }), {
    status: "UNAVAILABLE",
    reason: "PUBLIC_RELATION_MISMATCH",
  });
  assert.deepEqual(await topicAdapter({ courseSlug: "public-course" }), {
    status: "UNAVAILABLE",
    reason: "PUBLIC_RELATION_MISMATCH",
  });
});

test("omits inactive, deleted, and unpublished subjects and topics", async () => {
  const { adapter } = createFixtureAdapter({
    curriculum: [
      subject("hidden-subject", 1, [], { active: false }),
      subject("draft-subject", 2, [], { published: false }),
      subject("subject-a", 3, [
        topic("hidden-topic", "subject-a", 1, { active: false }),
        topic("deleted-topic", "subject-a", 2, { deletedAt: "2026-09-12" }),
        topic("draft-topic", "subject-a", 3, { published: false }),
        topic("topic-a", "subject-a", 4),
      ]),
    ],
  });

  const result = await adapter({ courseSlug: "public-course" });

  assert.equal(result.status, "OK");
  assert.deepEqual(result.subjects.map((item) => item.id), ["subject-a"]);
  assert.deepEqual(result.subjects[0].topics.map((item) => item.id), ["topic-a"]);
});

test("projects an allowlist without body, answer, personal, operational, or source fields", async () => {
  const { adapter } = createFixtureAdapter({
    course: {
      ...course(),
      updatedAt: "2026-09-12T00:00:00Z",
      thumbnailUrl: "https://example.invalid/private-thumbnail",
      userId: "learner-1",
      source: "official",
      revision: "latest",
    },
    curriculum: [
      subject("subject-a", 1, [
        topic("topic-a", "subject-a", 1, {
          body: "private lesson body",
          answer: "private answer",
          explanation: "private explanation",
          userId: "learner-1",
          updatedAt: "2026-09-12T00:00:00Z",
        }),
      ], {
        body: "private subject body",
        evidence: { id: "private-evidence" },
      }),
    ],
  });

  const result = await adapter({ courseSlug: "public-course" });

  assert.equal(result.status, "OK");
  assert.deepEqual(Object.keys(result.course).sort(), [
    "code",
    "description",
    "difficulty",
    "groupName",
    "id",
    "name",
    "shortName",
    "slug",
  ]);
  assert.equal("updatedAt" in result.course, false);
  assert.equal("source" in result.course, false);
  assert.equal("revision" in result.course, false);
  assert.equal("body" in result.subjects[0], false);
  assert.equal("body" in result.subjects[0].topics[0], false);
  assert.equal("answer" in result.subjects[0].topics[0], false);
  assert.equal("explanation" in result.subjects[0].topics[0], false);
  assert.equal(JSON.stringify(result).includes("learner-1"), false);
  assert.equal(JSON.stringify(result).includes("private-evidence"), false);
});

test("accepts the repository's filtered course projection without deletedAt", async () => {
  const courseValue = { ...course() };
  delete courseValue.deletedAt;
  const { adapter } = createFixtureAdapter({ course: courseValue });

  const result = await adapter({ courseSlug: "public-course" });

  assert.equal(result.status, "OK");
  assert.deepEqual(result.course, publicCourseProjection());
});

test("rejects invalid identifiers and maps missing or non-public courses to NOT_FOUND", async () => {
  const { adapter } = createFixtureAdapter({
    course: null,
  });
  assert.deepEqual(await adapter({ courseSlug: "" }), { status: "INVALID_INPUT" });
  assert.deepEqual(await adapter({ courseSlug: "a".repeat(129) }), { status: "INVALID_INPUT" });
  assert.deepEqual(await adapter({ courseSlug: "public/course" }), { status: "INVALID_INPUT" });
  assert.deepEqual(await adapter({ courseSlug: "missing-course" }), { status: "NOT_FOUND" });

  const { adapter: privateAdapter } = createFixtureAdapter({
    course: { ...course(), active: false },
  });
  assert.deepEqual(await privateAdapter({ courseSlug: "public-course" }), {
    status: "NOT_FOUND",
  });

  const { adapter: draftAdapter } = createFixtureAdapter({
    course: { ...course(), published: false },
  });
  assert.deepEqual(await draftAdapter({ courseSlug: "public-course" }), {
    status: "NOT_FOUND",
  });

  const { adapter: deletedAdapter } = createFixtureAdapter({
    course: { ...course(), deletedAt: "2026-09-12" },
  });
  assert.deepEqual(await deletedAdapter({ courseSlug: "public-course" }), {
    status: "NOT_FOUND",
  });
});

test("rejects malformed public projections and repository failures without exposing details", async () => {
  const { adapter: malformedCourseAdapter } = createFixtureAdapter({
    course: { ...course(), published: undefined },
  });
  assert.deepEqual(
    await malformedCourseAdapter({ courseSlug: "public-course" }),
    { status: "UNAVAILABLE", reason: "INVALID_PUBLIC_PROJECTION" },
  );

  const { adapter: malformedCurriculumAdapter } = createFixtureAdapter({
    curriculum: [subject("subject-a", 1.5, [])],
  });
  assert.deepEqual(
    await malformedCurriculumAdapter({ courseSlug: "public-course" }),
    { status: "UNAVAILABLE", reason: "INVALID_PUBLIC_PROJECTION" },
  );

  const { adapter: nullSortAdapter } = createFixtureAdapter({
    curriculum: [subject("subject-a", null, [])],
  });
  assert.deepEqual(await nullSortAdapter({ courseSlug: "public-course" }), {
    status: "UNAVAILABLE",
    reason: "INVALID_PUBLIC_PROJECTION",
  });

  const { adapter: courseErrorAdapter } = createFixtureAdapter({
    courseError: new Error("private course lookup details"),
  });
  assert.deepEqual(await courseErrorAdapter({ courseSlug: "public-course" }), {
    status: "UNAVAILABLE",
    reason: "PUBLIC_REPOSITORY_ERROR",
  });

  const { adapter: curriculumErrorAdapter } = createFixtureAdapter({
    curriculumError: new Error("private curriculum lookup details"),
  });
  assert.deepEqual(
    await curriculumErrorAdapter({ courseSlug: "public-course" }),
    { status: "UNAVAILABLE", reason: "PUBLIC_REPOSITORY_ERROR" },
  );
});

test("returns an empty outline without inventing descendants", async () => {
  const { adapter } = createFixtureAdapter({ curriculum: [] });
  assert.deepEqual(await adapter({ courseSlug: "public-course" }), {
    status: "OK",
    course: publicCourseProjection(),
    subjects: [],
  });
});

test("does not silently truncate an outline over the response limit", async () => {
  const curriculum = Array.from({ length: MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS + 1 }, (_, index) =>
    subject(`subject-${index}`, index, []),
  );
  const { adapter } = createFixtureAdapter({ curriculum });
  assert.deepEqual(await adapter({ courseSlug: "public-course" }), {
    status: "UNAVAILABLE",
    reason: "OUTLINE_LIMIT_EXCEEDED",
  });

  const topics = [
    ...Array.from({ length: 100 }, (_, index) =>
      topic(`topic-a-${index}`, "subject-a", index),
    ),
    ...Array.from({ length: 101 }, (_, index) =>
      topic(`topic-b-${index}`, "subject-b", index),
    ),
  ];
  const { adapter: topicAdapter } = createFixtureAdapter({
    curriculum: [
      subject("subject-a", 1, topics.slice(0, 100)),
      subject("subject-b", 2, topics.slice(100)),
    ],
  });
  assert.deepEqual(await topicAdapter({ courseSlug: "public-course" }), {
    status: "UNAVAILABLE",
    reason: "OUTLINE_LIMIT_EXCEEDED",
  });
});

test("accepts the exact subject/topic limits and counts topics across the course", async () => {
  const curriculum = Array.from(
    { length: MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS },
    (_, subjectIndex) =>
      subject(
        `subject-${subjectIndex}`,
        subjectIndex,
        Array.from({ length: 4 }, (_, topicIndex) =>
          topic(
            `topic-${subjectIndex}-${topicIndex}`,
            `subject-${subjectIndex}`,
            topicIndex,
          ),
        ),
      ),
  );
  const { adapter } = createFixtureAdapter({ curriculum });

  const result = await adapter({ courseSlug: "public-course" });

  assert.equal(result.status, "OK");
  assert.equal(result.subjects.length, MAX_PUBLIC_COURSE_OUTLINE_SUBJECTS);
  assert.equal(
    result.subjects.reduce((count, item) => count + item.topics.length, 0),
    MAX_PUBLIC_COURSE_OUTLINE_TOPICS,
  );
});

test("does not mutate the injected fixture or use caller identity", async () => {
  const fixture = {
    course: course(),
    curriculum: [subject("subject-a", 1, [topic("topic-a", "subject-a", 1)])],
  };
  const before = structuredClone(fixture);
  const { adapter } = createFixtureAdapter(fixture);

  const result = await adapter({ courseSlug: "public-course", userId: "caller-should-be-ignored" });

  assert.equal(result.status, "OK");
  assert.deepEqual(fixture, before);
});

function createFixtureAdapter({
  course: courseValue = course(),
  curriculum = [],
  courseError = null,
  curriculumError = null,
}) {
  const calls = [];
  return {
    calls,
    adapter: createPublicCourseOutlineAdapter({
      getPublicCourseBySlug: async (slug) => {
        calls.push(`course:${slug}`);
        if (courseError) throw courseError;
        return courseValue;
      },
      listCurriculum: async (courseId) => {
        calls.push(`curriculum:${courseId}`);
        if (curriculumError) throw curriculumError;
        return curriculum;
      },
    }),
  };
}

function course() {
  return {
    id: "course-1",
    slug: "public-course",
    code: "PUB-1",
    name: "Public Course",
    shortName: "Public",
    groupName: "Public Group",
    description: "Securium description",
    difficulty: "FOUNDATION",
    active: true,
    published: true,
    deletedAt: null,
  };
}

function publicCourseProjection() {
  return {
    id: "course-1",
    slug: "public-course",
    code: "PUB-1",
    name: "Public Course",
    shortName: "Public",
    groupName: "Public Group",
    description: "Securium description",
    difficulty: "FOUNDATION",
  };
}

function subject(id, displayOrder, topics, overrides = {}) {
  return {
    id,
    courseId: "course-1",
    code: id.toUpperCase(),
    name: id,
    description: `${id} description`,
    displayOrder,
    isSample: false,
    active: true,
    published: true,
    deletedAt: null,
    topics,
    ...overrides,
  };
}

function topic(id, subjectId, displayOrder, overrides = {}) {
  return {
    id,
    subjectId,
    courseId: "course-1",
    code: id.toUpperCase(),
    name: id,
    description: `${id} description`,
    displayOrder,
    isSample: false,
    active: true,
    published: true,
    deletedAt: null,
    ...overrides,
  };
}
