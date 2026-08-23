import { z } from "zod";
import { AppError } from "./errors.ts";
import {
  FACT_CURRENTNESS_STATES,
  FACT_NORMATIVE_STRENGTHS,
  createFactProvenanceManifest,
  createFactProvenanceSource,
} from "./facts/fact-domain.ts";
import { FACT_SOURCE_ROLES } from "./provenance/fact-source-binding.ts";

const code = z
  .string()
  .trim()
  .min(2, "코드는 2자 이상이어야 합니다.")
  .max(50)
  .regex(/^[A-Z0-9_]+$/, "코드는 영문 대문자, 숫자, 밑줄만 사용할 수 있습니다.");

const id = z.string().trim().min(1).max(100);
const text = z.string().trim().max(2000);
const activeBoolean = z.preprocess(
  (value) => value === true || value === "true" || value === "on" || value === "1",
  z.boolean(),
);

const safeInternalPath = z
  .string()
  .trim()
  .max(300)
  .refine(isSafeInternalPath, "안전한 내부 경로만 사용할 수 있습니다.");

export const conceptMappingQualificationSchema = z
  .object({
    track: z.string().trim().min(1).max(200).optional(),
    scope: z.union([
      z.string().trim().min(1).max(300),
      z.array(z.string().trim().min(1).max(300)).min(1).max(20),
    ]).optional(),
    jurisdiction: z.string().trim().min(1).max(200).optional(),
    version: z.string().trim().min(1).max(100).optional(),
    context: z.string().trim().min(1).max(300).optional(),
    effective_from: z.string().trim().min(1).max(40).optional(),
    effective_to: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const conceptMappingProvenanceSchema = z
  .object({
    source: z.string().trim().min(1).max(300),
    locator: z.string().trim().min(1).max(1000).optional(),
    basis: z.string().trim().min(1).max(500),
    package_id: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const conceptMappingBasisSchema = z.enum([
  "HUMAN_AUTHORED",
  "RULE_BASED",
  "AI_SUGGESTED",
  "CANONICAL_PACKAGE",
  "IMPORT",
]);

export const enrollmentSchema = z.object({
  courseId: id,
  returnTo: z.string().trim().startsWith("/").max(300).default("/dashboard"),
});

export const enrollmentStatusSchema = z.object({
  enrollmentId: id,
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]),
  returnTo: z.string().trim().startsWith("/").max(300).default("/my-courses"),
});

export const courseGroupSchema = z.object({
  id: id.optional(),
  code,
  name: z.string().trim().min(2).max(100),
  description: text,
  displayOrder: z.coerce.number().int().min(0).max(10000),
  active: activeBoolean.default(false),
  returnTo: z.string().trim().startsWith("/").max(300).default("/admin/course-groups"),
});

export const courseSchema = z.object({
  id: id.optional(),
  courseGroupId: id,
  code,
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug 형식이 올바르지 않습니다."),
  name: z.string().trim().min(2).max(120),
  shortName: z.string().trim().min(1).max(50),
  description: text,
  thumbnailUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !value || /^https:\/\//.test(value), "HTTPS URL만 허용됩니다."),
  totalLevels: z.coerce.number().int().min(1).max(1000),
  passingScore: z.coerce.number().int().min(0).max(100),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  active: activeBoolean.default(false),
  published: activeBoolean.default(false),
  displayOrder: z.coerce.number().int().min(0).max(10000),
  returnTo: z.string().trim().startsWith("/").max(300).default("/admin/courses"),
});

export const subjectSchema = z.object({
  id: id.optional(),
  courseId: id,
  code,
  name: z.string().trim().min(2).max(120),
  description: text,
  displayOrder: z.coerce.number().int().min(0).max(10000),
  active: activeBoolean.default(false),
  returnTo: z.string().trim().startsWith("/").max(300),
});

export const topicSchema = z.object({
  id: id.optional(),
  subjectId: id,
  parentTopicId: z.string().trim().max(100).optional(),
  code,
  name: z.string().trim().min(2).max(120),
  description: text,
  displayOrder: z.coerce.number().int().min(0).max(10000),
  active: activeBoolean.default(false),
  returnTo: z.string().trim().startsWith("/").max(300),
});

export const curriculumTreeSchema = z.object({
  id: id.optional(),
  courseId: id,
  title: z.string().trim().min(2).max(200),
  version: z.string().trim().min(1).max(60),
  sourceType: z.string().trim().max(80).optional().default(""),
  sourceDocument: z.string().trim().max(500).optional().default(""),
  effectiveFrom: z.string().trim().max(30).optional().default(""),
  effectiveTo: z.string().trim().max(30).optional().default(""),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  returnTo: z.string().trim().startsWith("/").max(300).default("/admin/courses"),
});

export const curriculumNodeTypes = [
  "TRACK",
  "SUBJECT",
  "DOMAIN",
  "MAJOR_ITEM",
  "SUB_ITEM",
  "STANDARD",
  "LIFECYCLE",
  "PRACTICAL",
  "MODULE",
  "CHAPTER",
  "CUSTOM",
] as const;

export const curriculumNodeSchema = z.object({
  id: id.optional(),
  curriculumTreeId: id,
  parentId: z.string().trim().max(100).optional().default(""),
  nodeType: z.enum(curriculumNodeTypes),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional().default(""),
  officialCode: z.string().trim().max(100).optional().default(""),
  officialTitle: z.string().trim().max(200).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(100000),
  isRequired: activeBoolean.default(false),
  isPractical: activeBoolean.default(false),
  difficulty: z.string().trim().max(40).optional().default(""),
  importance: z
    .preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce.number().int().min(0).max(100).optional(),
    )
    .optional(),
  metadata: z
    .string()
    .trim()
    .max(20000)
    .optional()
    .default("")
    .refine((value) => {
      if (!value) return true;
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    }, "metadata는 올바른 JSON이어야 합니다."),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
  returnTo: z.string().trim().startsWith("/").max(300).default("/admin/courses"),
});

export const curriculumNodeArchiveSchema = z.object({
  id,
  returnTo: z.string().trim().startsWith("/").max(300).default("/admin/courses"),
});

const jsonArrayText = z
  .string()
  .trim()
  .max(50000)
  .optional()
  .default("[]")
  .refine((value) => {
    try {
      return Array.isArray(JSON.parse(value));
    } catch {
      return false;
    }
  }, "JSON array 형식이어야 합니다.");

export const contentStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

export const sharedContentSchema = z.object({
  id: id.optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  canonicalKey: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/),
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(2000).default(""),
  body: z.string().trim().min(2).max(200000),
  bodyFormat: z.enum(["MARKDOWN", "STRUCTURED_JSON", "PLAIN_TEXT"]),
  learningObjectivesJson: jsonArrayText,
  coreConceptsJson: jsonArrayText,
  practicalExamplesJson: jsonArrayText,
  diagramsJson: jsonArrayText,
  mediaJson: jsonArrayText,
  version: z.string().trim().min(1).max(60),
  status: contentStatusSchema,
});

export const courseLessonSchema = z.object({
  id: id.optional(),
  courseId: id,
  curriculumNodeId: z.string().trim().max(100).optional().default(""),
  lessonId: z.string().trim().max(100).optional().default(""),
  contentId: id,
  displayTitle: z.string().trim().min(2).max(200),
  sortOrder: z.coerce.number().int().min(0).max(100000),
  difficulty: z.string().trim().max(40).optional().default(""),
  importance: z
    .preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce.number().int().min(0).max(100).optional(),
    )
    .optional(),
  estimatedMinutes: z.coerce.number().int().min(1).max(1440),
  isRequired: activeBoolean.default(false),
  unlockCondition: z.string().trim().max(20000).optional().default(""),
  completionRule: z.enum(["MANUAL", "SCROLL_END", "MINIMUM_REQUIREMENTS"]),
  status: contentStatusSchema,
});

export const courseLessonExtensionSchema = z.object({
  id: id.optional(),
  courseLessonId: id,
  learningObjectivesOverrideJson: z
    .string()
    .trim()
    .max(50000)
    .optional()
    .default("")
    .refine((value) => {
      if (!value) return true;
      try {
        return Array.isArray(JSON.parse(value));
      } catch {
        return false;
      }
    }, "JSON array 형식이어야 합니다."),
  additionalBody: z.string().trim().max(100000).optional().default(""),
  examPointsJson: jsonArrayText,
  practicalNotes: z.string().trim().max(20000).optional().default(""),
  legalNotes: z.string().trim().max(20000).optional().default(""),
  standardNotes: z.string().trim().max(20000).optional().default(""),
  evidenceNotes: z.string().trim().max(20000).optional().default(""),
  commonMistakes: z.string().trim().max(20000).optional().default(""),
  instructorNotes: z.string().trim().max(20000).optional().default(""),
  version: z.string().trim().min(1).max(60),
  status: contentStatusSchema,
});

export const sharedContentAdminSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("saveContent"),
    content: sharedContentSchema,
  }),
  z.object({
    operation: z.literal("saveCourseLesson"),
    courseLesson: courseLessonSchema,
  }),
  z.object({
    operation: z.literal("saveCourseLessonExtension"),
    extension: courseLessonExtensionSchema,
  }),
]);

export const learningUnitSchema = z.object({
  id: id.optional(),
  courseId: id,
  subjectId: id,
  topicId: z.string().trim().max(100).optional().default(""),
  code,
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).default(""),
  displayOrder: z.coerce.number().int().min(0).max(10000),
  active: activeBoolean.default(false),
  published: activeBoolean.default(false),
  completionPolicy: z.enum([
    "MANUAL",
    "SCROLL_END",
    "MINIMUM_REQUIREMENTS",
  ]),
  minimumProgressPercent: z.coerce.number().int().min(0).max(100),
  minimumStudySeconds: z.coerce.number().int().min(0).max(86400),
});

export const lessonSchema = z.object({
  id: id.optional(),
  learningUnitId: id,
  topicId: id,
  code,
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(2000).default(""),
  content: z.string().trim().min(2).max(100000),
  contentFormat: z.enum(["PLAIN_TEXT", "MARKDOWN"]),
  estimatedMinutes: z.coerce.number().int().min(1).max(1440),
  displayOrder: z.coerce.number().int().min(0).max(10000),
  active: activeBoolean.default(false),
  published: activeBoolean.default(false),
});

export const lessonProgressSchema = z.object({
  lessonId: id,
  action: z.enum(["START", "UPDATE", "COMPLETE"]),
  lastPosition: z.coerce.number().int().min(0).max(10000).default(0),
});

export const courseLessonProgressSchema = z.object({
  courseLessonId: id,
  action: z.enum(["START", "UPDATE", "COMPLETE"]),
  progressPercent: z.coerce.number().int().min(0).max(100).default(0),
  timeSpentSeconds: z.coerce.number().int().min(0).max(86400).default(0),
});

export const audioProgressSchema = z.object({
  audioContentId: id,
  currentPositionSeconds: z.coerce
    .number()
    .int()
    .min(0)
    .max(86400),
  complete: z.boolean().default(false),
});

export const lectureProgressSchema = z.object({
  lectureId: id,
  currentPositionSeconds: z.coerce.number().int().min(0).max(86400),
  complete: z.boolean().default(false),
});

export const lectureBookmarkSchema = z.object({
  lectureId: id,
});

export const lectureNoteSchema = z.object({
  lectureId: id,
  content: z.string().max(4000),
});

export const contentArchiveSchema = z.object({ id });

export const questionTypes = [
  "TRUE_FALSE",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "ESSAY",
  "ORDERING",
  "FILL_BLANK",
  "CASE_ANALYSIS",
  "CODE_ANALYSIS",
  "LOG_ANALYSIS",
  "CALCULATION",
] as const;

export const questionStatuses = [
  "DRAFT",
  "REVIEW_REQUESTED",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "ARCHIVED",
] as const;

export const questionChoiceSchema = z.object({
  id: id.optional(),
  content: z.string().trim().min(1).max(2000),
  displayOrder: z.coerce.number().int().min(0).max(100),
  isCorrect: activeBoolean.default(false),
  explanation: text.default(""),
});

export const questionSchema = z
  .object({
    id: id.optional(),
    title: z.string().trim().min(2).max(200),
    content: z.string().trim().min(2).max(10000),
    type: z.enum(questionTypes),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    explanation: z.string().trim().max(10000),
    wrongAnswerExplanation: z.string().trim().max(10000),
    source: z.string().trim().max(300).optional().default(""),
    sourceDate: z.string().trim().max(30).optional().default(""),
    answerConfigJson: z
      .string()
      .trim()
      .max(10000)
      .default("{}")
      .refine((value) => {
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      }, "답안 설정은 올바른 JSON이어야 합니다."),
    choices: z.array(questionChoiceSchema).max(20),
    courseIds: z.array(id).min(1),
    subjectIds: z.array(id).default([]),
    topicIds: z.array(id).default([]),
  })
  .superRefine((value, context) => {
    const correctCount = value.choices.filter((choice) => choice.isCorrect).length;
    if (
      ["TRUE_FALSE", "SINGLE_CHOICE"].includes(value.type) &&
      correctCount !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "OX와 단일선택형은 정답이 정확히 하나여야 합니다.",
      });
    }
    if (value.type === "TRUE_FALSE" && value.choices.length !== 2) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "OX 문제는 선택지가 정확히 두 개여야 합니다.",
      });
    }
    if (value.type === "MULTIPLE_CHOICE" && correctCount < 2) {
      context.addIssue({
        code: "custom",
        path: ["choices"],
        message: "복수선택형은 정답이 두 개 이상이어야 합니다.",
      });
    }
    if (value.type === "SHORT_ANSWER") {
      try {
        const config = JSON.parse(value.answerConfigJson) as {
          acceptedAnswers?: unknown[];
        };
        if (!config.acceptedAnswers?.length) {
          context.addIssue({
            code: "custom",
            path: ["answerConfigJson"],
            message: "단답형에는 하나 이상의 acceptedAnswers가 필요합니다.",
          });
        }
      } catch {
        // The base JSON validator reports malformed JSON.
      }
    }
  });

export const questionConceptGovernanceSchema = z.object({
  conceptId: id,
  qualificationJson: z.string().max(20000).nullable().optional(),
  provenanceJson: z.string().max(20000).nullable().optional(),
  mappingStatus: z.enum(["SUGGESTED", "APPROVED"]).default("SUGGESTED"),
  reviewedBy: id.nullable().optional(),
  reviewedAt: z.string().datetime().nullable().optional(),
});

export const questionGovernanceSchema = z.object({
  blueprintId: z.string().trim().min(1).max(200),
  qualificationJson: z.string().max(20000),
  provenanceJson: z.string().max(50000),
  governanceJson: z.string().max(50000),
  humanReviewHash: z.string().length(64).nullable().optional(),
  humanReviewedBy: id.nullable().optional(),
  humanReviewedAt: z.string().datetime().nullable().optional(),
});

export const governedQuestionSchema = questionSchema.extend({
  governance: questionGovernanceSchema,
  conceptMappings: z.array(questionConceptGovernanceSchema).min(1),
});

export const questionAttemptSchema = z.object({
  questionId: id,
  questionVersionId: id.nullable().optional(),
  courseId: id,
  answer: z.union([z.string().max(10000), z.array(z.string().max(500)).max(20)]),
  responseTime: z.coerce.number().int().min(0).max(86_400_000).default(0),
  idempotencyKey: z.string().trim().min(8).max(100),
});

export const aiQuestionExplanationSchema = z.object({
  questionId: id,
  courseId: id,
});

export const specializedAIRequestSchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("WRITTEN_ANSWER"),
    courseId: id,
    questionId: id,
    answer: z.string().trim().min(1).max(12000),
  }),
  z.object({
    targetType: z.literal("RISK_SCENARIO"),
    courseId: id,
    scenarioId: id,
  }),
  z.object({
    targetType: z.literal("PRIVACY_ASSESSMENT"),
    courseId: id,
    answerId: id,
  }),
  z.object({
    targetType: z.literal("SECURE_CODE"),
    courseId: id,
    attemptId: id,
  }),
]);

export const specializedAIReviewSchema = z.object({
  generationId: id,
  action: z.enum([
    "REVIEWED",
    "APPROVED_WITH_EDITS",
    "REJECTED",
    "DELETED",
    "COPIED",
  ]),
  reviewNote: z.string().trim().max(4000).default(""),
  editedResult: z.record(z.string(), z.unknown()).default({}),
  reviewedContentTitle: z.string().trim().max(300).default(""),
});

export const aiExplainabilityFeedbackSchema = z.object({
  traceId: id,
  traceSource: z.enum(["QUESTION_EXPLANATION", "SPECIALIZED_REVIEW"]),
  rating: z.enum(["HELPFUL", "NOT_HELPFUL", "NEEDS_REVIEW"]),
  issueType: z.enum([
    "NONE",
    "LOW_QUALITY_CONTEXT",
    "MISSING_CITATION",
    "WRONG_CONCEPT",
    "PROMPT_ISSUE",
    "SENSITIVE_CONTENT_RISK",
    "OTHER",
  ]),
  note: z.string().trim().max(2000).default(""),
});

export const bookmarkSchema = z.object({
  targetType: z.enum(["QUESTION", "TOPIC", "SUBJECT"]),
  targetId: id,
  courseId: id,
});

export const wrongNoteUpdateSchema = z.object({
  id,
  userMemo: z.string().trim().max(2000).default(""),
  mastered: activeBoolean.default(false),
});

export const workflowSchema = z.object({
  questionId: id,
  action: z.enum([
    "REQUEST_REVIEW",
    "START_REVIEW",
    "APPROVE",
    "REJECT",
    "PUBLISH",
    "ARCHIVE",
  ]),
  comment: z.string().trim().max(2000).default(""),
});

export const questionReportSchema = z.object({
  questionId: id,
  reason: z.enum([
    "WRONG_ANSWER",
    "WRONG_EXPLANATION",
    "TYPO",
    "OUTDATED_STANDARD",
    "DUPLICATE",
    "OTHER",
  ]),
  content: z.string().trim().max(3000).default(""),
});

export const levelActionSchema = z.object({
  levelId: id,
  action: z.enum(["START", "COMPLETE"]),
});

export const examStartSchema = z.object({
  mockExamId: id,
});

export const examAnswerSchema = z.object({
  attemptId: id,
  questionId: id,
  answer: z.union([z.string().max(10000), z.array(z.string().max(500)).max(20)]),
});

export const examSubmitSchema = z.object({
  attemptId: id,
});

export const learningSettingsSchema = z.object({
  dailyQuestionGoal: z.coerce.number().int().min(1).max(500),
  dailyStudyMinutes: z.coerce.number().int().min(1).max(1440),
});

export const levelSchema = z.object({
  id: id.optional(),
  courseId: id,
  code,
  number: z.coerce.number().int().min(1).max(1000),
  title: z.string().trim().min(2).max(200),
  description: text,
  passingScore: z.coerce.number().int().min(0).max(100),
  requiredLevelId: z.string().trim().max(100).optional().default(""),
  displayOrder: z.coerce.number().int().min(0).max(10000),
  active: activeBoolean.default(false),
  published: activeBoolean.default(false),
});

export const levelContentSchema = z.object({
  levelId: id,
  contentType: z.enum(["QUESTION", "SUBJECT", "TOPIC", "CONTENT"]),
  contentId: id,
  displayOrder: z.coerce.number().int().min(0).max(10000),
  required: activeBoolean.default(false),
});

export const mockExamSchema = z.object({
  id: id.optional(),
  courseId: id,
  title: z.string().trim().min(2).max(200),
  description: text,
  examType: z.enum([
    "QUICK",
    "SUBJECT",
    "REALISTIC",
    "WRONG_ANSWER",
    "WEAK_AREA",
    "MANAGED",
  ]),
  questionCount: z.coerce.number().int().min(1).max(500),
  timeLimitMinutes: z.coerce.number().int().min(1).max(1440),
  passingScore: z.coerce.number().int().min(0).max(100),
  startAt: z.string().trim().max(40).optional().default(""),
  endAt: z.string().trim().max(40).optional().default(""),
  resultOpenAt: z.string().trim().max(40).optional().default(""),
  maxAttempts: z.coerce.number().int().min(1).max(100),
  randomizeQuestions: activeBoolean.default(false),
  randomizeChoices: activeBoolean.default(false),
  status: z.enum(["DRAFT", "READY", "OPEN", "CLOSED", "ARCHIVED"]),
  published: activeBoolean.default(false),
});

export const mockExamSectionSchema = z.object({
  id: id.optional(),
  mockExamId: id,
  subjectId: z.string().trim().max(100).optional().default(""),
  title: z.string().trim().min(2).max(200),
  questionCount: z.coerce.number().int().min(1).max(500),
  scoreWeight: z.coerce.number().int().min(1).max(10000),
  displayOrder: z.coerce.number().int().min(0).max(10000),
});

export const mockExamQuestionSchema = z.object({
  mockExamId: id,
  questionId: id,
  sectionId: z.string().trim().max(100).optional().default(""),
  score: z.coerce.number().int().min(1).max(1000),
  displayOrder: z.coerce.number().int().min(0).max(10000),
});

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "날짜는 YYYY-MM-DD 형식이어야 합니다.");

export const writtenGradeSchema = z.object({
  questionId: id,
  answer: z.string().trim().min(1).max(20000),
});

export const riskCalculationSchema = z.object({
  methodId: id,
  likelihood: z.coerce.number().min(0).max(1000),
  impact: z.coerce.number().min(0).max(1000),
});

export const riskRegisterSchema = z.object({
  id: id.optional(),
  scenarioId: id,
  asset: z.string().trim().min(1).max(300),
  threat: z.string().trim().min(1).max(300),
  vulnerability: z.string().trim().min(1).max(500),
  likelihood: z.coerce.number().min(0).max(1000),
  impact: z.coerce.number().min(0).max(1000),
  treatment: z.string().trim().min(1).max(2000),
  owner: z.string().trim().min(1).max(200),
  dueDate: z.union([isoDate, z.literal("")]).optional().default(""),
  status: z.enum(["OPEN", "TREATING", "ACCEPTED", "CLOSED"]),
});

export const contentBookmarkSchema = z.object({
  courseId: id,
  contentType: z.enum([
    "ISMS_STANDARD",
    "ISMS_DEFECT_CASE",
    "LEGAL_ARTICLE",
    "RISK_SCENARIO",
  ]),
  contentId: id,
});

const practicalLanguage = z.enum([
  "Java",
  "C",
  "C++",
  "Python",
  "JavaScript",
]);

export const codeAnalysisSubmissionSchema = z.object({
  courseId: id,
  sampleId: id,
  selectedLines: z.array(z.coerce.number().int().min(1).max(10000)).max(500),
  weaknessId: id,
  selectedCweCode: z.string().trim().min(1).max(30),
  truePositive: z.boolean(),
  userExplanation: z.string().trim().max(10000),
  remediationCode: z.string().max(50000),
  responseTime: z.coerce.number().int().min(0).max(86400000).default(0),
  idempotencyKey: z.string().trim().min(8).max(100),
});

export const privacyAssessmentAnswerSchema = z.object({
  scenarioId: id,
  targetDecision: z.enum(["REQUIRED", "NOT_REQUIRED", "REVIEW_NEEDED"]),
  selectedAssessmentItems: z.array(id).max(200),
  identifiedRisks: z.string().trim().max(20000),
  improvementPlan: z.string().trim().max(30000),
});

export const practicalSpecializedAdminSchema = z.discriminatedUnion("entity", [
  z.object({
    entity: z.literal("SECURE_WEAKNESS"),
    id: id.optional(),
    code,
    name: z.string().trim().min(2).max(200),
    category: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10000),
    language: z.union([practicalLanguage, z.literal("COMMON")]),
    cweCode: z.string().trim().min(1).max(30),
    risk: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    detectionGuide: z.string().trim().max(10000),
    remediationGuide: z.string().trim().max(10000),
    reference: z.string().trim().max(1000),
    version: z.string().trim().min(1).max(50),
    active: activeBoolean,
  }),
  z.object({
    entity: z.literal("SECURE_CODE_SAMPLE"),
    id: id.optional(),
    courseId: id,
    weaknessId: id,
    questionId: z.union([id, z.literal("")]).default(""),
    language: practicalLanguage,
    title: z.string().trim().min(2).max(300),
    vulnerableCode: z.string().min(1).max(50000),
    secureCode: z.string().min(1).max(50000),
    vulnerableLines: z.array(z.coerce.number().int().min(1).max(10000)).max(500),
    explanation: z.string().trim().max(10000),
    falsePositivePossible: activeBoolean,
    expectedTruePositive: activeBoolean,
    callRelation: z.string().trim().max(10000),
    executionFlow: z.string().trim().max(10000),
    remediationKeywords: z.array(z.string().trim().min(1).max(100)).max(100),
    sourceDate: isoDate,
    active: activeBoolean,
  }),
  z.object({
    entity: z.literal("SECURE_CODE_RULE"),
    id: id.optional(),
    sampleId: id,
    lineScore: z.coerce.number().int().min(0).max(1000),
    weaknessScore: z.coerce.number().int().min(0).max(1000),
    cweScore: z.coerce.number().int().min(0).max(1000),
    judgmentScore: z.coerce.number().int().min(0).max(1000),
    keywordScore: z.coerce.number().int().min(0).max(1000),
    remediationCodeScore: z.coerce.number().int().min(0).max(1000),
    maximumScore: z.coerce.number().int().min(1).max(1000),
  }),
  z.object({
    entity: z.literal("PRIVACY_ITEM"),
    id: id.optional(),
    code,
    category: z.string().trim().min(1).max(200),
    title: z.string().trim().min(2).max(300),
    description: z.string().trim().max(10000),
    checkPoints: z.string().trim().max(10000),
    evidenceExamples: z.string().trim().max(10000),
    riskExamples: z.string().trim().max(10000),
    improvementExamples: z.string().trim().max(10000),
    version: z.string().trim().min(1).max(50),
    effectiveDate: isoDate,
    active: activeBoolean,
  }),
  z.object({
    entity: z.literal("PRIVACY_SCENARIO"),
    id: id.optional(),
    courseId: id,
    title: z.string().trim().min(2).max(300),
    description: z.string().trim().max(20000),
    organizationType: z.string().trim().min(1).max(300),
    systemType: z.string().trim().min(1).max(300),
    processedData: z.string().trim().min(1).max(5000),
    dataSubjects: z.string().trim().min(1).max(2000),
    processingPurpose: z.string().trim().min(1).max(5000),
    track: z.enum(["EXAM_PREP", "PRACTICE"]),
    correctTargetDecision: z.enum([
      "REQUIRED",
      "NOT_REQUIRED",
      "REVIEW_NEEDED",
    ]),
    expectedAssessmentItems: z.array(id).max(200),
    modelImprovementPlan: z.string().trim().max(30000),
    riskKeywords: z.array(z.string().trim().min(1).max(100)).max(100),
    improvementKeywords: z.array(z.string().trim().min(1).max(100)).max(100),
    active: activeBoolean,
  }),
  z.object({
    entity: z.literal("PRIVACY_NODE"),
    id: id.optional(),
    scenarioId: id,
    nodeType: z.enum([
      "DATA_SUBJECT",
      "COLLECTION",
      "PROCESSING",
      "STORAGE",
      "TRANSFER",
      "DESTRUCTION",
      "EXTERNAL",
    ]),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000),
    systemName: z.string().trim().max(300),
    organizationName: z.string().trim().max(300),
    displayX: z.coerce.number().int().min(0).max(5000),
    displayY: z.coerce.number().int().min(0).max(5000),
    displayOrder: z.coerce.number().int().min(0).max(10000),
  }),
  z.object({
    entity: z.literal("PRIVACY_EDGE"),
    id: id.optional(),
    scenarioId: id,
    sourceNodeId: id,
    targetNodeId: id,
    dataTypes: z.string().trim().min(1).max(2000),
    transferMethod: z.string().trim().min(1).max(1000),
    purpose: z.string().trim().max(5000),
    protectionMeasures: z.string().trim().max(5000),
  }).refine((value) => value.sourceNodeId !== value.targetNodeId, {
    path: ["targetNodeId"],
    message: "출발 노드와 도착 노드는 달라야 합니다.",
  }),
]);

export const specializedAdminSchema = z.discriminatedUnion("entity", [
  z.object({
    entity: z.literal("ISMS_STANDARD"),
    id: id.optional(),
    code,
    title: z.string().trim().min(2).max(300),
    majorCategory: z.string().trim().min(1).max(200),
    middleCategory: z.string().trim().min(1).max(200),
    description: text,
    keyPoints: text,
    evidenceExamples: text,
    defectExamples: text,
    auditPoints: text,
    version: z.string().trim().min(1).max(50),
    effectiveDate: isoDate,
    sourceUrl: z.union([z.string().url(), z.literal("")]).default(""),
    active: activeBoolean,
  }),
  z.object({
    entity: z.literal("ISMS_DEFECT_CASE"),
    id: id.optional(),
    title: z.string().trim().min(2).max(300),
    situation: text,
    defectDescription: text,
    relatedStandardId: id,
    evidence: text,
    correctiveAction: text,
    source: z.string().trim().min(1).max(300),
    sourceDate: isoDate,
  }),
  z.object({
    entity: z.literal("LEGAL_ARTICLE"),
    id: id.optional(),
    lawName: z.string().trim().min(1).max(200),
    articleNumber: z.string().trim().min(1).max(50),
    articleTitle: z.string().trim().min(1).max(300),
    content: text,
    effectiveDate: isoDate,
    revisionDate: isoDate,
    sourceUrl: z.union([z.string().url(), z.literal("")]).default(""),
    version: z.string().trim().min(1).max(50),
    active: activeBoolean,
  }),
  z.object({
    entity: z.literal("WRITTEN_RULE"),
    questionId: id,
    modelAnswer: text,
    requiredKeywords: z.array(z.string().trim().min(1).max(100)).max(50),
    optionalKeywords: z.array(z.string().trim().min(1).max(100)).max(50),
    maximumScore: z.coerce.number().int().min(1).max(1000),
    partialScoreRules: z.array(
      z.object({
        keywords: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
        score: z.coerce.number().int().min(0).max(1000),
        mode: z.enum(["ANY", "ALL"]).default("ANY"),
      }),
    ).max(50),
    guidance: text,
    referenceDate: isoDate,
  }),
  z.object({
    entity: z.literal("RISK_METHOD"),
    id: id.optional(),
    name: z.string().trim().min(2).max(200),
    description: text,
    formulaType: z.enum(["MULTIPLY", "ADD", "WEIGHTED", "MATRIX"]),
    configuration: z.record(z.string(), z.unknown()),
    active: activeBoolean,
  }),
  z.object({
    entity: z.literal("RISK_GRADE"),
    id: id.optional(),
    calculationMethodId: id,
    code,
    label: z.string().trim().min(1).max(100),
    minValue: z.coerce.number().int().min(0).max(1000000),
    maxValue: z.coerce.number().int().min(0).max(1000000),
    treatmentGuidance: text,
    displayOrder: z.coerce.number().int().min(0).max(10000),
  }).refine((value) => value.minValue <= value.maxValue, {
    path: ["maxValue"],
    message: "최댓값은 최솟값 이상이어야 합니다.",
  }),
  z.object({
    entity: z.literal("RISK_SCENARIO"),
    id: id.optional(),
    courseId: id,
    calculationMethodId: id,
    title: z.string().trim().min(2).max(300),
    asset: z.string().trim().min(1).max(300),
    threat: z.string().trim().min(1).max(300),
    vulnerability: z.string().trim().min(1).max(500),
    existingControls: text,
    likelihood: z.coerce.number().min(0).max(1000),
    impact: z.coerce.number().min(0).max(1000),
    treatmentOption: z.string().trim().min(1).max(300),
    residualRisk: z.coerce.number().min(0).max(1000000),
    description: text,
    referenceDate: isoDate,
  }),
  z.object({
    entity: z.literal("CONTENT_LINK"),
    contentType: z.enum([
      "ISMS_STANDARD",
      "ISMS_DEFECT_CASE",
      "LEGAL_ARTICLE",
      "RISK_SCENARIO",
    ]),
    contentId: id,
    courseId: id,
    questionId: id.optional(),
    relationType: z.string().trim().min(1).max(50).default("RELATED"),
    displayOrder: z.coerce.number().int().min(0).max(10000).default(0),
  }),
]);

const revisionContentType = z.enum([
  "LEGAL_ARTICLE",
  "ISMS_STANDARD",
  "PRIVACY_IMPACT_ITEM",
  "SUBJECT",
  "SECURE_CODING_WEAKNESS",
  "LEARNING_UNIT",
  "LESSON",
  "QUESTION_EXPLANATION",
  "AUDIO_CONTENT",
  "LECTURE",
]);

export const contentRevisionAdminSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("SAVE_GOVERNED_THEORY"),
    canonicalKey: z.string().trim().min(3).max(200),
    contentId: id,
    version: z.string().trim().min(1).max(50),
    title: z.string().trim().min(1).max(500),
    body: z.string().min(1).max(200000),
    bodyFormat: z.enum(["MARKDOWN", "STRUCTURED_JSON", "PLAIN_TEXT"]),
    learningObjectives: z.array(z.string().max(5000)).min(1).max(50),
    examples: z.array(z.unknown()).max(100),
    selfChecks: z.array(z.string().max(5000)).min(1).max(20),
    conceptMappings: z.array(z.object({
      conceptId: id.nullable().optional(),
      conceptKey: z.string().trim().min(3).max(200),
      qualificationJson: z.string().max(20000),
      provenanceJson: z.string().max(50000),
      mappingStatus: z.enum(["SUGGESTED", "APPROVED"]).default("SUGGESTED"),
      mappingVersion: z.number().int().min(1).optional(),
      reviewedBy: id.nullable().optional(),
      reviewedAt: z.string().datetime().nullable().optional(),
    })).min(1),
    governance: z.object({
      blueprintId: z.string().trim().min(1).max(200),
      humanReviewHash: z.string().length(64),
      humanReviewedBy: id,
      humanReviewedAt: z.string().datetime(),
      rightsStatus: z.literal("PASS_ORIGINAL"),
      authoringOrigin: z.literal("SECURIUM_ORIGINAL"),
      copyrightStatus: z.literal("PASS_ORIGINAL"),
      restrictedPdfGenerationInput: z.literal(false),
      qualificationJson: z.string().max(20000),
      provenanceJson: z.string().max(50000),
      lifecycle: z.literal("CANONICAL_UNPUBLISHED"),
    }),
    returnTo: z.string().optional(),
  }),
  z.object({
    operation: z.literal("CREATE_DRAFT"),
    contentType: revisionContentType,
    contentId: id,
    contentDate: isoDate,
    version: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[0-9A-Za-z가-힣._-]+$/, "버전 형식을 확인해 주세요."),
    changeSummary: z.string().trim().min(1).max(2000),
    snapshotJson: z.string().trim().min(2).max(100000).optional(),
    returnTo: z.string().optional(),
  }),
  z.object({
    operation: z.literal("PUBLISH"),
    revisionId: id,
    returnTo: z.string().optional(),
  }),
  z.object({
    operation: z.literal("ARCHIVE"),
    revisionId: id,
    returnTo: z.string().optional(),
  }),
]);

export const auditLogFilterSchema = z.object({
  fromDate: isoDate.optional(),
  toDate: isoDate.optional(),
  action: z.string().trim().max(100).optional(),
  actorUserId: id.optional(),
  resourceType: z.string().trim().max(100).optional(),
  resourceId: z.string().trim().max(100).optional(),
  result: z.enum(["SUCCESS", "FAILURE", "DENIED"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(30),
});

const ontologyEvidenceList = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}, z.array(z.string().trim().min(1).max(500)).max(20));

export const ontologyReviewStatusSchema = z.object({
  targetType: z.enum(["CONCEPT", "EDGE"]),
  targetId: id,
  nextStatus: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  evidence: ontologyEvidenceList,
  changeSummary: z.string().trim().max(1000).optional(),
  returnTo: safeInternalPath.optional(),
});

const canonicalFactIdSchema = z.string().refine(
  (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ||
    /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(value),
  "Stable UUID or ULID required",
);

const canonicalFactTimestampSchema = z.string().refine(
  (value) => /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value)),
  "ISO timestamp required",
);

export const factIdentityFoundationSchema = z.object({
  id: canonicalFactIdSchema,
  canonicalKey: z.string().min(3).max(200).regex(/^[a-z0-9][a-z0-9._:/-]+$/),
  domain: z.string().trim().min(3).max(300),
  canonicalLabel: z.string().trim().min(3).max(300),
  normalizedSemanticIdentity: z.string().min(3).max(300).refine(
    (value) => value === value.toLowerCase(),
    "Normalized semantic identity must be lowercase",
  ),
  scopeDiscriminator: z.string().trim().min(3).max(300),
  createdBy: canonicalFactIdSchema,
  createdAt: canonicalFactTimestampSchema,
});

export const temporalAssertionFoundationSchema = z.object({
  id: canonicalFactIdSchema,
  factIdentityId: canonicalFactIdSchema,
  normalizedProposition: z.string().trim().min(3).max(20_000),
  effectiveFrom: canonicalFactTimestampSchema,
  effectiveTo: canonicalFactTimestampSchema.nullable().optional(),
  currentnessState: z.enum(FACT_CURRENTNESS_STATES),
  qualification: z.string().max(2_000).optional(),
  normativeStrength: z.enum(FACT_NORMATIVE_STRENGTHS),
  provenance: z.custom((value) => {
    try {
      createFactProvenanceManifest(value);
      return true;
    } catch {
      return false;
    }
  }, "Validated Fact provenance manifest required"),
  createdBy: canonicalFactIdSchema,
  createdAt: canonicalFactTimestampSchema,
}).strict().refine(
  (value) =>
    value.effectiveTo == null ||
    Date.parse(value.effectiveTo) > Date.parse(value.effectiveFrom),
  { message: "Effective interval must be half-open with end after start" },
);

export const sourceIdentityFoundationSchema = z.object({
  id: canonicalFactIdSchema,
  logicalSourceDocumentId: z.string().trim().min(3).max(300),
  sourceKind: z.string().trim().min(3).max(300),
  officialTitle: z.string().trim().min(3).max(300),
  normalizedIdentity: z.string().min(3).max(300).refine(
    (value) => value === value.toLowerCase(),
    "Normalized source identity must be lowercase",
  ),
  issuer: z.string().trim().max(300).optional(),
  jurisdiction: z.string().trim().max(300).optional(),
  createdBy: canonicalFactIdSchema,
  createdAt: canonicalFactTimestampSchema,
}).strict();

export const assertionSourceBindingFoundationSchema = z.object({
  id: canonicalFactIdSchema,
  temporalAssertionId: canonicalFactIdSchema,
  sourceIdentityId: canonicalFactIdSchema,
  sourceRole: z.enum(FACT_SOURCE_ROLES),
  sourceVersion: z.string().trim().max(300).optional(),
  sourceHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  locator: z.string().trim().min(3).max(2_000),
  verification: z.custom((value) => {
    try {
      createFactProvenanceSource({
        sourceIdentityId: "00000000-0000-4000-8000-000000000000",
        sourceRole: "CONTEXT_SOURCE",
        sourceVersion: "",
        sourceHash: "",
        locator: "validation-locator",
        verification: value,
      });
      return true;
    } catch {
      return false;
    }
  }, "Validated source verification metadata required"),
  createdBy: canonicalFactIdSchema,
  createdAt: canonicalFactTimestampSchema,
}).strict();

export type CourseGroupInput = z.infer<typeof courseGroupSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type TopicInput = z.infer<typeof topicSchema>;
export type LearningUnitInput = z.infer<typeof learningUnitSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type QuestionGovernanceInput = z.infer<typeof questionGovernanceSchema>;
export type QuestionConceptGovernanceInput = z.infer<
  typeof questionConceptGovernanceSchema
>;
export type GovernedQuestionInput = z.infer<typeof governedQuestionSchema>;
export type FactIdentityFoundationInput = z.infer<typeof factIdentityFoundationSchema>;
export type TemporalAssertionFoundationInput = z.infer<typeof temporalAssertionFoundationSchema>;
export type SourceIdentityFoundationInput = z.infer<typeof sourceIdentityFoundationSchema>;
export type AssertionSourceBindingFoundationInput =
  z.infer<typeof assertionSourceBindingFoundationSchema>;

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const message = result.error.issues[0]?.message ?? "입력값을 확인해 주세요.";
  throw new AppError(message, 400, "VALIDATION_ERROR");
}

function isSafeInternalPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  try {
    const url = new URL(value, "https://securium.local");
    return url.origin === "https://securium.local";
  } catch {
    return false;
  }
}
