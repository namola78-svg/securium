import { z } from "zod";
import { AppError } from "./errors.ts";

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

export const questionAttemptSchema = z.object({
  questionId: id,
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

export type CourseGroupInput = z.infer<typeof courseGroupSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type SubjectInput = z.infer<typeof subjectSchema>;
export type TopicInput = z.infer<typeof topicSchema>;
export type LearningUnitInput = z.infer<typeof learningUnitSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const message = result.error.issues[0]?.message ?? "입력값을 확인해 주세요.";
  throw new AppError(message, 400, "VALIDATION_ERROR");
}
