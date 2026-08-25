import {
  createMcpACore,
  type McpACourse,
  type McpALesson,
  type McpAQuestion,
  type McpAReadService,
} from "../lib/mcp/mcpa-core.ts";

export const BENCHMARK_FIXTURE_ID = "MCPA_BENCHMARK_FIXTURE_V1";

const publicCourse: McpACourse = {
  id: "course-benchmark-public",
  slug: "benchmark-public-course",
  code: "BENCH",
  name: "Benchmark Public Course",
  shortName: "Benchmark",
  description: "Published canonical benchmark course.",
  active: true,
  published: true,
  deletedAt: null,
  updatedAt: "2026-08-25T00:00:00Z",
  totalLevels: 1,
  difficulty: "BEGINNER",
};

const publicLesson: McpALesson = {
  id: "lesson-benchmark-1",
  courseId: publicCourse.id,
  contentId: "content-benchmark-1",
  contentKey: "content.benchmark.public.lesson-1",
  title: "Published Benchmark Lesson",
  summary: "Published canonical benchmark lesson.",
  body: "Published lesson body.",
  bodyFormat: "MARKDOWN",
  sortOrder: 1,
  estimatedMinutes: 10,
  status: "PUBLISHED",
  updatedAt: "2026-08-25T00:00:00Z",
  learningObjectives: ["Read published benchmark learning context"],
};

const publicQuestion: McpAQuestion = {
  id: "q-1",
  title: "Published Benchmark Question",
  content: "Which item is part of the published benchmark fixture?",
  type: "SINGLE_CHOICE",
  difficulty: "EASY",
  courseId: publicCourse.id,
  questionVersionId: "qv-benchmark-1",
  createdAt: "2026-08-25T00:00:00Z",
  choices: [
    { id: "choice-1", content: "Published canonical context", displayOrder: 1 },
    { id: "choice-2", content: "Private learner state", displayOrder: 2 },
  ],
};

export const benchmarkFixtureData = Object.freeze({
  courses: Object.freeze([publicCourse]),
  lessons: Object.freeze([publicLesson]),
  questions: Object.freeze([publicQuestion]),
});

export function createBenchmarkMcpACore() {
  const service: McpAReadService = {
    listPublishedCourses: async () => benchmarkFixtureData.courses,
    getPublicCourseByKey: async (key) =>
      benchmarkFixtureData.courses.find((course) => course.slug === key) ?? null,
    listPublishedLessons: async () => benchmarkFixtureData.lessons,
    getPublicLesson: async (courseKey, key) => {
      const expected =
        "lesson:" +
        encodeURIComponent(courseKey) +
        ":" +
        encodeURIComponent(publicLesson.contentKey);
      return courseKey === publicCourse.slug && key === expected ? publicLesson : null;
    },
    listPublishedQuestions: async ({ courseId, questionIds } = {}) =>
      benchmarkFixtureData.questions.filter(
        (question) =>
          (!courseId || question.courseId === courseId) &&
          (!questionIds || questionIds.includes(question.id)),
      ),
  };

  return createMcpACore(service);
}
