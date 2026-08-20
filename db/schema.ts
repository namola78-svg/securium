import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    lastSignedInAt: text("last_signed_in_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    index("users_status_idx").on(table.status),
  ],
);

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  ...timestamps,
});

export const courseGroups = sqliteTable(
  "course_groups",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    displayOrder: integer("display_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("course_groups_code_unique").on(table.code),
    index("course_groups_listing_idx").on(
      table.active,
      table.deletedAt,
      table.displayOrder,
    ),
  ],
);

export const courses = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    courseGroupId: text("course_group_id")
      .notNull()
      .references(() => courseGroups.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name").notNull(),
    description: text("description").notNull().default(""),
    thumbnailUrl: text("thumbnail_url"),
    totalLevels: integer("total_levels").notNull().default(1),
    passingScore: integer("passing_score").notNull().default(60),
    difficulty: text("difficulty").notNull().default("BEGINNER"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    displayOrder: integer("display_order").notNull().default(0),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("courses_code_unique").on(table.code),
    uniqueIndex("courses_slug_unique").on(table.slug),
    index("courses_group_idx").on(
      table.courseGroupId,
      table.active,
      table.displayOrder,
    ),
    index("courses_public_listing_idx").on(
      table.active,
      table.published,
      table.deletedAt,
      table.displayOrder,
    ),
    check(
      "courses_passing_score_check",
      sql`${table.passingScore} >= 0 AND ${table.passingScore} <= 100`,
    ),
    check("courses_total_levels_check", sql`${table.totalLevels} > 0`),
  ],
);

export const curriculumTrees = sqliteTable(
  "curriculum_trees",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    version: text("version").notNull(),
    sourceType: text("source_type"),
    sourceDocument: text("source_document"),
    effectiveFrom: text("effective_from"),
    effectiveTo: text("effective_to"),
    status: text("status").notNull().default("DRAFT"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("curriculum_trees_course_version_unique").on(
      table.courseId,
      table.version,
    ),
    uniqueIndex("curriculum_trees_course_active_unique")
      .on(table.courseId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("curriculum_trees_course_status_idx").on(
      table.courseId,
      table.status,
      table.version,
    ),
    check(
      "curriculum_trees_status_check",
      sql`${table.status} IN ('DRAFT', 'ACTIVE', 'ARCHIVED')`,
    ),
  ],
);

export const curriculumNodes = sqliteTable(
  "curriculum_nodes",
  {
    id: text("id").primaryKey(),
    curriculumTreeId: text("curriculum_tree_id")
      .notNull()
      .references(() => curriculumTrees.id, { onDelete: "restrict" }),
    parentId: text("parent_id"),
    nodeType: text("node_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    officialCode: text("official_code"),
    officialTitle: text("official_title"),
    sortOrder: integer("sort_order").notNull().default(0),
    depth: integer("depth").notNull().default(0),
    path: text("path"),
    isRequired: integer("is_required", { mode: "boolean" })
      .notNull()
      .default(true),
    isPractical: integer("is_practical", { mode: "boolean" })
      .notNull()
      .default(false),
    difficulty: text("difficulty"),
    importance: integer("importance"),
    metadata: text("metadata"),
    status: text("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (table) => [
    index("curriculum_nodes_tree_parent_order_idx").on(
      table.curriculumTreeId,
      table.parentId,
      table.sortOrder,
      table.id,
    ),
    index("curriculum_nodes_tree_path_idx").on(table.curriculumTreeId, table.path),
    index("curriculum_nodes_parent_idx").on(table.parentId),
    foreignKey({
      name: "curriculum_nodes_parent_fk",
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    check(
      "curriculum_nodes_status_check",
      sql`${table.status} IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')`,
    ),
    check(
      "curriculum_nodes_depth_check",
      sql`${table.depth} >= 0 AND ${table.depth} <= 20`,
    ),
    check(
      "curriculum_nodes_sort_order_check",
      sql`${table.sortOrder} >= 0`,
    ),
    check(
      "curriculum_nodes_importance_check",
      sql`${table.importance} IS NULL OR (${table.importance} >= 0 AND ${table.importance} <= 100)`,
    ),
    check(
      "curriculum_nodes_parent_self_check",
      sql`${table.parentId} IS NULL OR ${table.parentId} <> ${table.id}`,
    ),
    check(
      "curriculum_nodes_metadata_length_check",
      sql`${table.metadata} IS NULL OR length(${table.metadata}) <= 20000`,
    ),
  ],
);

export const subjects = sqliteTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    displayOrder: integer("display_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("subjects_course_code_unique").on(table.courseId, table.code),
    index("subjects_course_listing_idx").on(
      table.courseId,
      table.active,
      table.deletedAt,
      table.displayOrder,
    ),
  ],
);

export const topics = sqliteTable(
  "topics",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    parentTopicId: text("parent_topic_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    displayOrder: integer("display_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("topics_subject_code_unique").on(table.subjectId, table.code),
    index("topics_subject_listing_idx").on(
      table.subjectId,
      table.active,
      table.deletedAt,
      table.displayOrder,
    ),
    index("topics_parent_idx").on(table.parentTopicId),
    foreignKey({
      name: "topics_parent_topic_fk",
      columns: [table.parentTopicId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
  ],
);

export const learningUnits = sqliteTable(
  "learning_units",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    topicId: text("topic_id").references(() => topics.id, {
      onDelete: "restrict",
    }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    displayOrder: integer("display_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    completionPolicy: text("completion_policy")
      .notNull()
      .default("MANUAL"),
    minimumProgressPercent: integer("minimum_progress_percent")
      .notNull()
      .default(100),
    minimumStudySeconds: integer("minimum_study_seconds")
      .notNull()
      .default(0),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("learning_units_subject_code_unique").on(
      table.subjectId,
      table.code,
    ),
    index("learning_units_course_listing_idx").on(
      table.courseId,
      table.active,
      table.published,
      table.deletedAt,
      table.displayOrder,
    ),
    index("learning_units_subject_listing_idx").on(
      table.subjectId,
      table.active,
      table.published,
      table.displayOrder,
    ),
    index("learning_units_topic_idx").on(table.topicId, table.displayOrder),
    check(
      "learning_units_completion_policy_check",
      sql`${table.completionPolicy} IN ('MANUAL', 'SCROLL_END', 'MINIMUM_REQUIREMENTS')`,
    ),
    check(
      "learning_units_minimum_progress_check",
      sql`${table.minimumProgressPercent} >= 0 AND ${table.minimumProgressPercent} <= 100`,
    ),
    check(
      "learning_units_minimum_study_seconds_check",
      sql`${table.minimumStudySeconds} >= 0 AND ${table.minimumStudySeconds} <= 86400`,
    ),
  ],
);

export const lessons = sqliteTable(
  "lessons",
  {
    id: text("id").primaryKey(),
    learningUnitId: text("learning_unit_id").references(
      () => learningUnits.id,
      { onDelete: "restrict" },
    ),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull(),
    contentFormat: text("content_format").notNull().default("PLAIN_TEXT"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(10),
    displayOrder: integer("display_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    version: integer("version").notNull().default(1),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lessons_topic_code_unique").on(table.topicId, table.code),
    uniqueIndex("lessons_learning_unit_code_unique").on(
      table.learningUnitId,
      table.code,
    ),
    index("lessons_learning_unit_listing_idx").on(
      table.learningUnitId,
      table.active,
      table.published,
      table.displayOrder,
    ),
    index("lessons_course_listing_idx").on(
      table.courseId,
      table.active,
      table.published,
      table.deletedAt,
      table.displayOrder,
    ),
    index("lessons_subject_listing_idx").on(
      table.subjectId,
      table.active,
      table.published,
      table.displayOrder,
    ),
    index("lessons_topic_listing_idx").on(
      table.topicId,
      table.active,
      table.published,
      table.displayOrder,
    ),
    check(
      "lessons_content_format_check",
      sql`${table.contentFormat} IN ('PLAIN_TEXT', 'MARKDOWN')`,
    ),
    check(
      "lessons_estimated_minutes_check",
      sql`${table.estimatedMinutes} > 0 AND ${table.estimatedMinutes} <= 1440`,
    ),
    check("lessons_version_check", sql`${table.version} > 0`),
  ],
);

export const contents = sqliteTable(
  "contents",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    canonicalKey: text("canonical_key").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull(),
    bodyFormat: text("body_format").notNull().default("MARKDOWN"),
    learningObjectivesJson: text("learning_objectives_json")
      .notNull()
      .default("[]"),
    coreConceptsJson: text("core_concepts_json").notNull().default("[]"),
    practicalExamplesJson: text("practical_examples_json")
      .notNull()
      .default("[]"),
    diagramsJson: text("diagrams_json").notNull().default("[]"),
    mediaJson: text("media_json").notNull().default("[]"),
    version: text("version").notNull().default("1.0.0"),
    status: text("status").notNull().default("DRAFT"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("contents_slug_unique").on(table.slug),
    uniqueIndex("contents_canonical_key_unique").on(table.canonicalKey),
    index("contents_status_idx").on(table.status, table.updatedAt),
    check(
      "contents_status_check",
      sql`${table.status} IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    ),
    check(
      "contents_body_format_check",
      sql`${table.bodyFormat} IN ('MARKDOWN', 'STRUCTURED_JSON', 'PLAIN_TEXT')`,
    ),
    check(
      "contents_body_length_check",
      sql`length(${table.body}) <= 200000`,
    ),
  ],
);

export const courseLessons = sqliteTable(
  "course_lessons",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    curriculumNodeId: text("curriculum_node_id").references(
      () => curriculumNodes.id,
      { onDelete: "restrict" },
    ),
    contentId: text("content_id")
      .notNull()
      .references(() => contents.id, { onDelete: "restrict" }),
    lessonId: text("lesson_id").references(() => lessons.id, {
      onDelete: "restrict",
    }),
    displayTitle: text("display_title").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    difficulty: text("difficulty"),
    importance: integer("importance"),
    estimatedMinutes: integer("estimated_minutes").notNull().default(10),
    isRequired: integer("is_required", { mode: "boolean" })
      .notNull()
      .default(true),
    unlockCondition: text("unlock_condition"),
    completionRule: text("completion_rule").notNull().default("MANUAL"),
    status: text("status").notNull().default("DRAFT"),
    deletedAt: text("deleted_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("course_lessons_course_node_content_unique").on(
      table.courseId,
      table.curriculumNodeId,
      table.contentId,
    ),
    uniqueIndex("course_lessons_node_order_unique").on(
      table.courseId,
      table.curriculumNodeId,
      table.sortOrder,
    ),
    index("course_lessons_course_listing_idx").on(
      table.courseId,
      table.status,
      table.sortOrder,
    ),
    index("course_lessons_content_usage_idx").on(table.contentId, table.courseId),
    index("course_lessons_lesson_usage_idx").on(table.lessonId, table.courseId),
    check(
      "course_lessons_status_check",
      sql`${table.status} IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    ),
    check(
      "course_lessons_completion_rule_check",
      sql`${table.completionRule} IN ('MANUAL', 'SCROLL_END', 'MINIMUM_REQUIREMENTS')`,
    ),
    check(
      "course_lessons_estimated_minutes_check",
      sql`${table.estimatedMinutes} > 0 AND ${table.estimatedMinutes} <= 1440`,
    ),
    check(
      "course_lessons_importance_check",
      sql`${table.importance} IS NULL OR (${table.importance} >= 0 AND ${table.importance} <= 100)`,
    ),
  ],
);

export const courseLessonExtensions = sqliteTable(
  "course_lesson_extensions",
  {
    id: text("id").primaryKey(),
    courseLessonId: text("course_lesson_id")
      .notNull()
      .references(() => courseLessons.id, { onDelete: "restrict" }),
    learningObjectivesOverrideJson: text("learning_objectives_override_json"),
    additionalBody: text("additional_body"),
    examPointsJson: text("exam_points_json").notNull().default("[]"),
    practicalNotes: text("practical_notes").notNull().default(""),
    legalNotes: text("legal_notes").notNull().default(""),
    standardNotes: text("standard_notes").notNull().default(""),
    evidenceNotes: text("evidence_notes").notNull().default(""),
    commonMistakes: text("common_mistakes").notNull().default(""),
    instructorNotes: text("instructor_notes").notNull().default(""),
    version: text("version").notNull().default("1.0.0"),
    status: text("status").notNull().default("DRAFT"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("course_lesson_extensions_lesson_unique").on(
      table.courseLessonId,
    ),
    index("course_lesson_extensions_status_idx").on(
      table.status,
      table.updatedAt,
    ),
    check(
      "course_lesson_extensions_status_check",
      sql`${table.status} IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    ),
    check(
      "course_lesson_extensions_additional_body_length_check",
      sql`${table.additionalBody} IS NULL OR length(${table.additionalBody}) <= 100000`,
    ),
  ],
);

export const userCourseLessonProgress = sqliteTable(
  "user_course_lesson_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    courseLessonId: text("course_lesson_id")
      .notNull()
      .references(() => courseLessons.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("IN_PROGRESS"),
    progressPercent: integer("progress_percent").notNull().default(0),
    completedAt: text("completed_at"),
    lastViewedAt: text("last_viewed_at"),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    lastStudiedAt: text("last_studied_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_course_lesson_progress_unique").on(
      table.userId,
      table.courseId,
      table.courseLessonId,
    ),
    index("user_course_lesson_progress_user_course_idx").on(
      table.userId,
      table.courseId,
      table.status,
      table.lastStudiedAt,
    ),
    index("user_course_lesson_progress_lesson_idx").on(
      table.courseLessonId,
      table.status,
    ),
    check(
      "user_course_lesson_progress_status_check",
      sql`${table.status} IN ('IN_PROGRESS', 'COMPLETED')`,
    ),
    check(
      "user_course_lesson_progress_percent_check",
      sql`${table.progressPercent} >= 0 AND ${table.progressPercent} <= 100`,
    ),
    check(
      "user_course_lesson_progress_time_spent_check",
      sql`${table.timeSpentSeconds} >= 0 AND ${table.timeSpentSeconds} <= 31536000`,
    ),
  ],
);

export const audioContents = sqliteTable(
  "audio_contents",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    audioUrl: text("audio_url").notNull().default(""),
    transcript: text("transcript").notNull().default(""),
    transcriptSegmentsJson: text("transcript_segments_json")
      .notNull()
      .default("[]"),
    durationSeconds: integer("duration_seconds").notNull(),
    voiceProvider: text("voice_provider").notNull().default(""),
    voiceName: text("voice_name").notNull().default(""),
    speedOptionsJson: text("speed_options_json")
      .notNull()
      .default("[0.75,1,1.25,1.5,2]"),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [
    index("audio_contents_lesson_listing_idx").on(
      table.lessonId,
      table.published,
      table.createdAt,
    ),
    check(
      "audio_contents_duration_check",
      sql`${table.durationSeconds} > 0 AND ${table.durationSeconds} <= 86400`,
    ),
  ],
);

export const lectures = sqliteTable(
  "lectures",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    instructorName: text("instructor_name").notNull().default(""),
    description: text("description").notNull().default(""),
    videoProvider: text("video_provider").notNull(),
    videoUrl: text("video_url").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    durationSeconds: integer("duration_seconds").notNull(),
    free: integer("free", { mode: "boolean" }).notNull().default(false),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    displayOrder: integer("display_order").notNull().default(0),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lectures_topic_order_unique").on(
      table.topicId,
      table.displayOrder,
    ),
    index("lectures_course_listing_idx").on(
      table.courseId,
      table.published,
      table.displayOrder,
    ),
    index("lectures_subject_listing_idx").on(
      table.subjectId,
      table.published,
      table.displayOrder,
    ),
    index("lectures_topic_listing_idx").on(
      table.topicId,
      table.published,
      table.displayOrder,
    ),
    check(
      "lectures_duration_check",
      sql`${table.durationSeconds} > 0 AND ${table.durationSeconds} <= 86400`,
    ),
    check(
      "lectures_display_order_check",
      sql`${table.displayOrder} >= 0`,
    ),
  ],
);

export const contentRevisions = sqliteTable(
  "content_revisions",
  {
    id: text("id").primaryKey(),
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    courseId: text("course_id").references(() => courses.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    contentDate: text("content_date").notNull(),
    version: text("version").notNull(),
    revisionStatus: text("revision_status").notNull().default("draft"),
    snapshotJson: text("snapshot_json").notNull(),
    reviewedAt: text("reviewed_at"),
    reviewedBy: text("reviewed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    publishedAt: text("published_at"),
    supersededAt: text("superseded_at"),
    changeSummary: text("change_summary").notNull().default(""),
    previousVersionId: text("previous_version_id"),
    isLatest: integer("is_latest", { mode: "boolean" })
      .notNull()
      .default(false),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("content_revisions_identity_version_unique").on(
      table.contentType,
      table.contentId,
      table.version,
    ),
    uniqueIndex("content_revisions_single_latest_unique")
      .on(table.contentType, table.contentId)
      .where(sql`${table.isLatest} = 1`),
    index("content_revisions_public_idx").on(
      table.contentType,
      table.contentId,
      table.revisionStatus,
      table.isLatest,
    ),
    index("content_revisions_course_idx").on(
      table.courseId,
      table.revisionStatus,
      table.contentDate,
    ),
    index("content_revisions_previous_idx").on(table.previousVersionId),
    foreignKey({
      name: "content_revisions_previous_fk",
      columns: [table.previousVersionId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    check(
      "content_revisions_type_check",
      sql`${table.contentType} IN ('LEGAL_ARTICLE', 'ISMS_STANDARD', 'PRIVACY_IMPACT_ITEM', 'SUBJECT', 'SECURE_CODING_WEAKNESS', 'LEARNING_UNIT', 'LESSON', 'QUESTION_EXPLANATION', 'AUDIO_CONTENT', 'LECTURE')`,
    ),
    check(
      "content_revisions_status_check",
      sql`${table.revisionStatus} IN ('draft', 'review', 'published', 'superseded', 'archived')`,
    ),
    check(
      "content_revisions_latest_status_check",
      sql`${table.isLatest} = 0 OR ${table.revisionStatus} = 'published'`,
    ),
    check(
      "content_revisions_snapshot_length_check",
      sql`length(${table.snapshotJson}) <= 100000`,
    ),
  ],
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    courseId: text("course_id").references(() => courses.id, {
      onDelete: "restrict",
    }),
    grantedBy: text("granted_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    grantedAt: text("granted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("user_roles_scope_unique").on(
      table.userId,
      table.roleId,
      table.courseId,
    ),
    index("user_roles_course_idx").on(table.courseId, table.roleId),
  ],
);

export const userCourseEnrollments = sqliteTable(
  "user_course_enrollments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("ACTIVE"),
    enrolledAt: text("enrolled_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
    currentLevel: integer("current_level").notNull().default(1),
    progressPercent: integer("progress_percent").notNull().default(0),
    totalXp: integer("total_xp").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("enrollments_user_course_unique").on(
      table.userId,
      table.courseId,
    ),
    index("enrollments_user_status_idx").on(table.userId, table.status),
    index("enrollments_course_status_idx").on(table.courseId, table.status),
    check(
      "enrollments_progress_check",
      sql`${table.progressPercent} >= 0 AND ${table.progressPercent} <= 100`,
    ),
    check(
      "enrollments_status_check",
      sql`${table.status} IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')`,
    ),
  ],
);

export const userProgress = sqliteTable(
  "user_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    progressPercent: integer("progress_percent").notNull().default(0),
    completedLessons: integer("completed_lessons").notNull().default(0),
    completedQuestions: integer("completed_questions").notNull().default(0),
    correctAnswers: integer("correct_answers").notNull().default(0),
    totalAnswers: integer("total_answers").notNull().default(0),
    lastStudiedAt: text("last_studied_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_progress_scope_unique").on(
      table.userId,
      table.courseId,
      table.subjectId,
      table.topicId,
    ),
    index("user_progress_user_course_idx").on(
      table.userId,
      table.courseId,
      table.lastStudiedAt,
    ),
    check(
      "user_progress_percent_check",
      sql`${table.progressPercent} >= 0 AND ${table.progressPercent} <= 100`,
    ),
  ],
);

export const userLessonProgress = sqliteTable(
  "user_lesson_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("IN_PROGRESS"),
    progressPercent: integer("progress_percent").notNull().default(0),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    lastViewedAt: text("last_viewed_at").notNull().default(""),
    lastPosition: integer("last_position").notNull().default(0),
    studySeconds: integer("study_seconds").notNull().default(0),
    lastStudiedAt: text("last_studied_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_lesson_progress_unique").on(table.userId, table.lessonId),
    index("user_lesson_progress_user_course_idx").on(
      table.userId,
      table.courseId,
      table.status,
      table.lastStudiedAt,
    ),
    index("user_lesson_progress_lesson_idx").on(table.lessonId, table.status),
    check(
      "user_lesson_progress_status_check",
      sql`${table.status} IN ('IN_PROGRESS', 'COMPLETED')`,
    ),
    check(
      "user_lesson_progress_percent_check",
      sql`${table.progressPercent} >= 0 AND ${table.progressPercent} <= 100`,
    ),
  ],
);

export const audioProgress = sqliteTable(
  "audio_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    audioContentId: text("audio_content_id")
      .notNull()
      .references(() => audioContents.id, { onDelete: "restrict" }),
    currentPositionSeconds: integer("current_position_seconds")
      .notNull()
      .default(0),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    completedAt: text("completed_at"),
    lastPlayedAt: text("last_played_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("audio_progress_user_content_unique").on(
      table.userId,
      table.audioContentId,
    ),
    index("audio_progress_user_recent_idx").on(
      table.userId,
      table.lastPlayedAt,
    ),
    index("audio_progress_content_completed_idx").on(
      table.audioContentId,
      table.completed,
    ),
    check(
      "audio_progress_position_check",
      sql`${table.currentPositionSeconds} >= 0`,
    ),
  ],
);

export const lectureProgress = sqliteTable(
  "lecture_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    lectureId: text("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "restrict" }),
    currentPositionSeconds: integer("current_position_seconds")
      .notNull()
      .default(0),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    completedAt: text("completed_at"),
    lastPlayedAt: text("last_played_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("lecture_progress_user_lecture_unique").on(
      table.userId,
      table.lectureId,
    ),
    index("lecture_progress_user_recent_idx").on(
      table.userId,
      table.lastPlayedAt,
    ),
    index("lecture_progress_lecture_completed_idx").on(
      table.lectureId,
      table.completed,
    ),
    check(
      "lecture_progress_position_check",
      sql`${table.currentPositionSeconds} >= 0`,
    ),
  ],
);

export const lectureBookmarks = sqliteTable(
  "lecture_bookmarks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    lectureId: text("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "restrict" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("lecture_bookmarks_user_lecture_unique").on(
      table.userId,
      table.lectureId,
    ),
    index("lecture_bookmarks_user_recent_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const lectureNotes = sqliteTable(
  "lecture_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    lectureId: text("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "restrict" }),
    content: text("content").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lecture_notes_user_lecture_unique").on(
      table.userId,
      table.lectureId,
    ),
    index("lecture_notes_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
    check(
      "lecture_notes_content_length_check",
      sql`length(${table.content}) <= 4000`,
    ),
  ],
);

export const questions = sqliteTable(
  "questions",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    type: text("type").notNull(),
    difficulty: text("difficulty").notNull().default("MEDIUM"),
    explanation: text("explanation").notNull().default(""),
    wrongAnswerExplanation: text("wrong_answer_explanation")
      .notNull()
      .default(""),
    status: text("status").notNull().default("DRAFT"),
    source: text("source"),
    sourceDate: text("source_date"),
    version: integer("version").notNull().default(1),
    answerConfigJson: text("answer_config_json").notNull().default("{}"),
    isSample: integer("is_sample", { mode: "boolean" })
      .notNull()
      .default(false),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewedBy: text("reviewed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    publishedAt: text("published_at"),
    archivedAt: text("archived_at"),
    ...timestamps,
  },
  (table) => [
    index("questions_public_idx").on(
      table.status,
      table.difficulty,
      table.publishedAt,
    ),
    index("questions_author_idx").on(table.createdBy, table.status),
    index("questions_reviewer_idx").on(table.reviewedBy, table.status),
    check(
      "questions_type_check",
      sql`${table.type} IN ('TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY', 'ORDERING', 'FILL_BLANK', 'CASE_ANALYSIS', 'CODE_ANALYSIS', 'LOG_ANALYSIS', 'CALCULATION')`,
    ),
    check(
      "questions_status_check",
      sql`${table.status} IN ('DRAFT', 'REVIEW_REQUESTED', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED')`,
    ),
    check(
      "questions_difficulty_check",
      sql`${table.difficulty} IN ('EASY', 'MEDIUM', 'HARD')`,
    ),
    check("questions_version_check", sql`${table.version} > 0`),
  ],
);

export const questionChoices = sqliteTable(
  "question_choices",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    isCorrect: integer("is_correct", { mode: "boolean" })
      .notNull()
      .default(false),
    explanation: text("explanation").notNull().default(""),
  },
  (table) => [
    uniqueIndex("question_choices_order_unique").on(
      table.questionId,
      table.displayOrder,
    ),
    index("question_choices_question_idx").on(
      table.questionId,
      table.displayOrder,
    ),
  ],
);

export const questionCourses = sqliteTable(
  "question_courses",
  {
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    weight: integer("weight").notNull().default(100),
  },
  (table) => [
    uniqueIndex("question_courses_unique").on(table.questionId, table.courseId),
    index("question_courses_course_idx").on(table.courseId, table.questionId),
    check(
      "question_courses_weight_check",
      sql`${table.weight} >= 0 AND ${table.weight} <= 1000`,
    ),
  ],
);

export const questionSubjects = sqliteTable(
  "question_subjects",
  {
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("question_subjects_unique").on(
      table.questionId,
      table.subjectId,
    ),
    index("question_subjects_subject_idx").on(
      table.subjectId,
      table.questionId,
    ),
  ],
);

export const questionTopics = sqliteTable(
  "question_topics",
  {
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("question_topics_unique").on(table.questionId, table.topicId),
    index("question_topics_topic_idx").on(table.topicId, table.questionId),
  ],
);

export const questionVersions = sqliteTable(
  "question_versions",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    reviewComment: text("review_comment").notNull().default(""),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("question_versions_unique").on(
      table.questionId,
      table.version,
    ),
    index("question_versions_history_idx").on(
      table.questionId,
      table.createdAt,
    ),
  ],
);

export const questionAttempts = sqliteTable(
  "question_attempts",
  {
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    mode: text("mode").notNull().default("LEARNING"),
    examSessionId: text("exam_session_id"),
    selectedAnswer: text("selected_answer").notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    score: integer("score").notNull().default(0),
    responseTime: integer("response_time").notNull().default(0),
    attemptedAt: text("attempted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("question_attempts_idempotency_unique").on(
      table.userId,
      table.idempotencyKey,
    ),
    index("question_attempts_user_course_idx").on(
      table.userId,
      table.courseId,
      table.attemptedAt,
    ),
    index("question_attempts_user_course_question_idx").on(
      table.userId,
      table.courseId,
      table.questionId,
    ),
    index("question_attempts_question_idx").on(
      table.questionId,
      table.attemptedAt,
    ),
    check(
      "question_attempts_score_check",
      sql`${table.score} >= 0 AND ${table.score} <= 100`,
    ),
    check(
      "question_attempts_response_time_check",
      sql`${table.responseTime} >= 0`,
    ),
    check(
      "question_attempts_mode_check",
      sql`${table.mode} IN ('LEARNING', 'EXAM')`,
    ),
  ],
);

export const wrongNotes = sqliteTable(
  "wrong_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    lastAttemptId: text("last_attempt_id")
      .notNull()
      .references(() => questionAttempts.id, { onDelete: "restrict" }),
    wrongCount: integer("wrong_count").notNull().default(1),
    mastered: integer("mastered", { mode: "boolean" })
      .notNull()
      .default(false),
    userMemo: text("user_memo").notNull().default(""),
    lastReviewedAt: text("last_reviewed_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("wrong_notes_user_question_course_unique").on(
      table.userId,
      table.questionId,
      table.courseId,
    ),
    index("wrong_notes_user_course_idx").on(
      table.userId,
      table.courseId,
      table.mastered,
      table.updatedAt,
    ),
    check("wrong_notes_count_check", sql`${table.wrongCount} > 0`),
  ],
);

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("bookmarks_user_target_course_unique").on(
      table.userId,
      table.targetType,
      table.targetId,
      table.courseId,
    ),
    index("bookmarks_user_course_idx").on(
      table.userId,
      table.courseId,
      table.createdAt,
    ),
    check(
      "bookmarks_target_type_check",
      sql`${table.targetType} IN ('QUESTION', 'TOPIC', 'SUBJECT')`,
    ),
  ],
);

export const questionReports = sqliteTable(
  "question_reports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    content: text("content").notNull().default(""),
    status: text("status").notNull().default("OPEN"),
    resolutionNote: text("resolution_note").notNull().default(""),
    handledBy: text("handled_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    handledAt: text("handled_at"),
    ...timestamps,
  },
  (table) => [
    index("question_reports_status_idx").on(table.status, table.createdAt),
    index("question_reports_question_idx").on(
      table.questionId,
      table.createdAt,
    ),
    check(
      "question_reports_reason_check",
      sql`${table.reason} IN ('WRONG_ANSWER', 'WRONG_EXPLANATION', 'TYPO', 'OUTDATED_STANDARD', 'DUPLICATE', 'OTHER')`,
    ),
    check(
      "question_reports_status_check",
      sql`${table.status} IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED')`,
    ),
  ],
);

export const learningActivities = sqliteTable(
  "learning_activities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    activityType: text("activity_type").notNull(),
    targetId: text("target_id").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("learning_activities_user_course_idx").on(
      table.userId,
      table.courseId,
      table.createdAt,
    ),
  ],
);

export const levels = sqliteTable(
  "levels",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    passingScore: integer("passing_score").notNull().default(60),
    requiredLevelId: text("required_level_id"),
    displayOrder: integer("display_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("levels_course_code_unique").on(table.courseId, table.code),
    uniqueIndex("levels_course_number_unique").on(table.courseId, table.number),
    index("levels_course_listing_idx").on(
      table.courseId,
      table.active,
      table.published,
      table.displayOrder,
    ),
    foreignKey({
      name: "levels_required_level_fk",
      columns: [table.requiredLevelId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    check("levels_number_check", sql`${table.number} > 0`),
    check(
      "levels_passing_score_check",
      sql`${table.passingScore} >= 0 AND ${table.passingScore} <= 100`,
    ),
  ],
);

export const levelContents = sqliteTable(
  "level_contents",
  {
    id: text("id").primaryKey(),
    levelId: text("level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    required: integer("required", { mode: "boolean" })
      .notNull()
      .default(true),
  },
  (table) => [
    uniqueIndex("level_contents_unique").on(
      table.levelId,
      table.contentType,
      table.contentId,
    ),
    index("level_contents_level_idx").on(table.levelId, table.displayOrder),
    check(
      "level_contents_type_check",
      sql`${table.contentType} IN ('QUESTION', 'SUBJECT', 'TOPIC', 'CONTENT')`,
    ),
  ],
);

export const userLevelProgress = sqliteTable(
  "user_level_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    levelId: text("level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("LOCKED"),
    bestScore: integer("best_score").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    completedAt: text("completed_at"),
    masteredAt: text("mastered_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_level_progress_unique").on(
      table.userId,
      table.courseId,
      table.levelId,
    ),
    index("user_level_progress_user_course_idx").on(
      table.userId,
      table.courseId,
      table.status,
    ),
    check(
      "user_level_progress_status_check",
      sql`${table.status} IN ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'MASTERED')`,
    ),
    check(
      "user_level_progress_score_check",
      sql`${table.bestScore} >= 0 AND ${table.bestScore} <= 100`,
    ),
  ],
);

export const reviewSchedules = sqliteTable(
  "review_schedules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    lastReviewedAt: text("last_reviewed_at"),
    nextReviewAt: text("next_review_at").notNull(),
    intervalDays: integer("interval_days").notNull().default(0),
    easeFactor: integer("ease_factor").notNull().default(250),
    consecutiveCorrect: integer("consecutive_correct").notNull().default(0),
    consecutiveWrong: integer("consecutive_wrong").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    status: text("status").notNull().default("DUE"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("review_schedules_user_target_course_unique").on(
      table.userId,
      table.courseId,
      table.targetType,
      table.targetId,
    ),
    index("review_schedules_due_idx").on(
      table.userId,
      table.status,
      table.nextReviewAt,
    ),
    index("review_schedules_course_idx").on(
      table.userId,
      table.courseId,
      table.nextReviewAt,
    ),
    check(
      "review_schedules_target_check",
      sql`${table.targetType} IN ('QUESTION', 'TOPIC', 'CONTENT', 'MOCK_EXAM_QUESTION')`,
    ),
    check(
      "review_schedules_status_check",
      sql`${table.status} IN ('DUE', 'SCHEDULED', 'PAUSED', 'MASTERED')`,
    ),
    check(
      "review_schedules_interval_check",
      sql`${table.intervalDays} >= 0`,
    ),
  ],
);

export const mockExams = sqliteTable(
  "mock_exams",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    examType: text("exam_type").notNull().default("QUICK"),
    questionCount: integer("question_count").notNull(),
    timeLimitMinutes: integer("time_limit_minutes").notNull(),
    passingScore: integer("passing_score").notNull().default(60),
    startAt: text("start_at"),
    endAt: text("end_at"),
    resultOpenAt: text("result_open_at"),
    maxAttempts: integer("max_attempts").notNull().default(1),
    randomizeQuestions: integer("randomize_questions", { mode: "boolean" })
      .notNull()
      .default(true),
    randomizeChoices: integer("randomize_choices", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status").notNull().default("DRAFT"),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [
    index("mock_exams_course_public_idx").on(
      table.courseId,
      table.published,
      table.status,
      table.startAt,
      table.endAt,
    ),
    check(
      "mock_exams_type_check",
      sql`${table.examType} IN ('QUICK', 'SUBJECT', 'REALISTIC', 'WRONG_ANSWER', 'WEAK_AREA', 'MANAGED')`,
    ),
    check(
      "mock_exams_status_check",
      sql`${table.status} IN ('DRAFT', 'READY', 'OPEN', 'CLOSED', 'ARCHIVED')`,
    ),
    check(
      "mock_exams_score_check",
      sql`${table.passingScore} >= 0 AND ${table.passingScore} <= 100`,
    ),
    check(
      "mock_exams_limits_check",
      sql`${table.questionCount} > 0 AND ${table.timeLimitMinutes} > 0 AND ${table.maxAttempts} > 0`,
    ),
  ],
);

export const mockExamSections = sqliteTable(
  "mock_exam_sections",
  {
    id: text("id").primaryKey(),
    mockExamId: text("mock_exam_id")
      .notNull()
      .references(() => mockExams.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").references(() => subjects.id, {
      onDelete: "restrict",
    }),
    title: text("title").notNull(),
    questionCount: integer("question_count").notNull(),
    scoreWeight: integer("score_weight").notNull().default(100),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("mock_exam_sections_order_unique").on(
      table.mockExamId,
      table.displayOrder,
    ),
    index("mock_exam_sections_exam_idx").on(
      table.mockExamId,
      table.displayOrder,
    ),
  ],
);

export const mockExamQuestions = sqliteTable(
  "mock_exam_questions",
  {
    mockExamId: text("mock_exam_id")
      .notNull()
      .references(() => mockExams.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    sectionId: text("section_id").references(() => mockExamSections.id, {
      onDelete: "restrict",
    }),
    score: integer("score").notNull().default(10),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("mock_exam_questions_unique").on(
      table.mockExamId,
      table.questionId,
    ),
    uniqueIndex("mock_exam_questions_order_unique").on(
      table.mockExamId,
      table.displayOrder,
    ),
    index("mock_exam_questions_section_idx").on(
      table.sectionId,
      table.displayOrder,
    ),
  ],
);

export const mockExamAttempts = sqliteTable(
  "mock_exam_attempts",
  {
    id: text("id").primaryKey(),
    mockExamId: text("mock_exam_id")
      .notNull()
      .references(() => mockExams.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at").notNull(),
    submittedAt: text("submitted_at"),
    status: text("status").notNull().default("IN_PROGRESS"),
    score: integer("score").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    wrongCount: integer("wrong_count").notNull().default(0),
    unansweredCount: integer("unanswered_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("mock_exam_attempts_user_exam_idx").on(
      table.userId,
      table.mockExamId,
      table.startedAt,
    ),
    index("mock_exam_attempts_status_expiry_idx").on(
      table.status,
      table.expiresAt,
    ),
    check(
      "mock_exam_attempts_status_check",
      sql`${table.status} IN ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'CANCELLED')`,
    ),
    check(
      "mock_exam_attempts_score_check",
      sql`${table.score} >= 0 AND ${table.score} <= 100`,
    ),
  ],
);

export const mockExamAnswers = sqliteTable(
  "mock_exam_answers",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => mockExamAttempts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    answerData: text("answer_data").notNull().default(""),
    isCorrect: integer("is_correct", { mode: "boolean" }),
    score: integer("score"),
    answeredAt: text("answered_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("mock_exam_answers_attempt_question_unique").on(
      table.attemptId,
      table.questionId,
    ),
    index("mock_exam_answers_attempt_idx").on(
      table.attemptId,
      table.answeredAt,
    ),
  ],
);

export const userLearningSettings = sqliteTable(
  "user_learning_settings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dailyQuestionGoal: integer("daily_question_goal").notNull().default(20),
    dailyStudyMinutes: integer("daily_study_minutes").notNull().default(30),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("user_learning_settings_user_unique").on(table.userId),
    check(
      "user_learning_settings_goal_check",
      sql`${table.dailyQuestionGoal} > 0 AND ${table.dailyQuestionGoal} <= 500 AND ${table.dailyStudyMinutes} > 0 AND ${table.dailyStudyMinutes} <= 1440`,
    ),
  ],
);

export const courseSpecializations = sqliteTable(
  "course_specializations",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    featureType: text("feature_type").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description").notNull().default(""),
    configurationJson: text("configuration_json").notNull().default("{}"),
    displayOrder: integer("display_order").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("course_specializations_unique").on(
      table.courseId,
      table.featureType,
    ),
    index("course_specializations_listing_idx").on(
      table.courseId,
      table.active,
      table.displayOrder,
    ),
  ],
);

export const ismsStandards = sqliteTable(
  "isms_standards",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    majorCategory: text("major_category").notNull(),
    middleCategory: text("middle_category").notNull(),
    description: text("description").notNull().default(""),
    keyPoints: text("key_points").notNull().default(""),
    evidenceExamples: text("evidence_examples").notNull().default(""),
    defectExamples: text("defect_examples").notNull().default(""),
    auditPoints: text("audit_points").notNull().default(""),
    version: text("version").notNull(),
    effectiveDate: text("effective_date").notNull(),
    sourceUrl: text("source_url"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("isms_standards_code_version_unique").on(
      table.code,
      table.version,
    ),
    index("isms_standards_listing_idx").on(
      table.active,
      table.majorCategory,
      table.middleCategory,
      table.code,
    ),
  ],
);

export const ismsDefectCases = sqliteTable(
  "isms_defect_cases",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    situation: text("situation").notNull(),
    defectDescription: text("defect_description").notNull(),
    relatedStandardId: text("related_standard_id")
      .notNull()
      .references(() => ismsStandards.id, { onDelete: "restrict" }),
    evidence: text("evidence").notNull().default(""),
    correctiveAction: text("corrective_action").notNull().default(""),
    source: text("source").notNull(),
    sourceDate: text("source_date").notNull(),
    isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("isms_defect_cases_standard_idx").on(
      table.relatedStandardId,
      table.sourceDate,
    ),
  ],
);

export const legalArticles = sqliteTable(
  "legal_articles",
  {
    id: text("id").primaryKey(),
    lawName: text("law_name").notNull(),
    articleNumber: text("article_number").notNull(),
    articleTitle: text("article_title").notNull(),
    content: text("content").notNull(),
    effectiveDate: text("effective_date").notNull(),
    revisionDate: text("revision_date").notNull(),
    sourceUrl: text("source_url"),
    version: text("version").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("legal_articles_identity_unique").on(
      table.lawName,
      table.articleNumber,
      table.version,
    ),
    index("legal_articles_listing_idx").on(
      table.active,
      table.lawName,
      table.articleNumber,
    ),
  ],
);

export const legalArticleVersions = sqliteTable(
  "legal_article_versions",
  {
    id: text("id").primaryKey(),
    legalArticleId: text("legal_article_id")
      .notNull()
      .references(() => legalArticles.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    content: text("content").notNull(),
    effectiveDate: text("effective_date").notNull(),
    revisionDate: text("revision_date").notNull(),
    changeSummary: text("change_summary").notNull().default(""),
    sourceUrl: text("source_url"),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("legal_article_versions_unique").on(
      table.legalArticleId,
      table.version,
    ),
    index("legal_article_versions_date_idx").on(
      table.legalArticleId,
      table.effectiveDate,
    ),
  ],
);

export const writtenAnswerRules = sqliteTable(
  "written_answer_rules",
  {
    questionId: text("question_id")
      .primaryKey()
      .references(() => questions.id, { onDelete: "cascade" }),
    modelAnswer: text("model_answer").notNull(),
    requiredKeywordsJson: text("required_keywords_json").notNull().default("[]"),
    optionalKeywordsJson: text("optional_keywords_json").notNull().default("[]"),
    maximumScore: integer("maximum_score").notNull().default(100),
    partialScoreRulesJson: text("partial_score_rules_json")
      .notNull()
      .default("[]"),
    guidance: text("guidance").notNull().default(""),
    referenceDate: text("reference_date").notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "written_answer_rules_score_check",
      sql`${table.maximumScore} > 0`,
    ),
  ],
);

export const riskCalculationMethods = sqliteTable(
  "risk_calculation_methods",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    formulaType: text("formula_type").notNull(),
    configurationJson: text("configuration_json").notNull().default("{}"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("risk_calculation_methods_name_unique").on(table.name),
    check(
      "risk_calculation_methods_formula_check",
      sql`${table.formulaType} IN ('MULTIPLY', 'ADD', 'WEIGHTED', 'MATRIX')`,
    ),
  ],
);

export const riskGradeCriteria = sqliteTable(
  "risk_grade_criteria",
  {
    id: text("id").primaryKey(),
    calculationMethodId: text("calculation_method_id")
      .notNull()
      .references(() => riskCalculationMethods.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    minValue: integer("min_value").notNull(),
    maxValue: integer("max_value").notNull(),
    treatmentGuidance: text("treatment_guidance").notNull().default(""),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("risk_grade_criteria_unique").on(
      table.calculationMethodId,
      table.code,
    ),
    index("risk_grade_criteria_range_idx").on(
      table.calculationMethodId,
      table.minValue,
      table.maxValue,
    ),
    check(
      "risk_grade_criteria_range_check",
      sql`${table.minValue} <= ${table.maxValue}`,
    ),
  ],
);

export const riskScenarios = sqliteTable(
  "risk_scenarios",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    calculationMethodId: text("calculation_method_id").references(
      () => riskCalculationMethods.id,
      { onDelete: "restrict" },
    ),
    title: text("title").notNull(),
    asset: text("asset").notNull(),
    threat: text("threat").notNull(),
    vulnerability: text("vulnerability").notNull(),
    existingControls: text("existing_controls").notNull().default(""),
    likelihood: integer("likelihood").notNull(),
    impact: integer("impact").notNull(),
    riskValue: integer("risk_value").notNull(),
    riskLevel: text("risk_level").notNull(),
    treatmentOption: text("treatment_option").notNull(),
    residualRisk: integer("residual_risk").notNull().default(0),
    description: text("description").notNull().default(""),
    referenceDate: text("reference_date").notNull(),
    isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("risk_scenarios_course_idx").on(
      table.courseId,
      table.riskLevel,
      table.createdAt,
    ),
  ],
);

export const riskRegisterItems = sqliteTable(
  "risk_register_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => riskScenarios.id, { onDelete: "restrict" }),
    asset: text("asset").notNull(),
    threat: text("threat").notNull(),
    vulnerability: text("vulnerability").notNull(),
    likelihood: integer("likelihood").notNull(),
    impact: integer("impact").notNull(),
    riskValue: integer("risk_value").notNull(),
    treatment: text("treatment").notNull(),
    owner: text("owner").notNull(),
    dueDate: text("due_date"),
    status: text("status").notNull().default("OPEN"),
    ...timestamps,
  },
  (table) => [
    index("risk_register_items_user_idx").on(
      table.userId,
      table.status,
      table.dueDate,
    ),
    check(
      "risk_register_items_status_check",
      sql`${table.status} IN ('OPEN', 'TREATING', 'ACCEPTED', 'CLOSED')`,
    ),
  ],
);

export const contentCourseLinks = sqliteTable(
  "content_course_links",
  {
    id: text("id").primaryKey(),
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull().default("RELATED"),
    displayOrder: integer("display_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("content_course_links_unique").on(
      table.contentType,
      table.contentId,
      table.courseId,
      table.relationType,
    ),
    index("content_course_links_course_idx").on(
      table.courseId,
      table.contentType,
      table.displayOrder,
    ),
  ],
);

export const contentQuestionLinks = sqliteTable(
  "content_question_links",
  {
    id: text("id").primaryKey(),
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull().default("RELATED"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("content_question_links_unique").on(
      table.contentType,
      table.contentId,
      table.questionId,
    ),
    index("content_question_links_question_idx").on(table.questionId),
  ],
);

export const contentBookmarks = sqliteTable(
  "content_bookmarks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("content_bookmarks_unique").on(
      table.userId,
      table.courseId,
      table.contentType,
      table.contentId,
    ),
    index("content_bookmarks_user_idx").on(
      table.userId,
      table.courseId,
      table.createdAt,
    ),
  ],
);

export const secureCodingWeaknesses = sqliteTable(
  "secure_coding_weaknesses",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    language: text("language").notNull(),
    cweCode: text("cwe_code").notNull(),
    risk: text("risk").notNull(),
    detectionGuide: text("detection_guide").notNull().default(""),
    remediationGuide: text("remediation_guide").notNull().default(""),
    reference: text("reference").notNull().default(""),
    version: text("version").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("secure_coding_weaknesses_code_version_unique").on(
      table.code,
      table.version,
    ),
    index("secure_coding_weaknesses_listing_idx").on(
      table.active,
      table.language,
      table.category,
      table.code,
    ),
    check(
      "secure_coding_weaknesses_language_check",
      sql`${table.language} IN ('Java', 'C', 'C++', 'Python', 'JavaScript', 'COMMON')`,
    ),
    check(
      "secure_coding_weaknesses_risk_check",
      sql`${table.risk} IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`,
    ),
  ],
);

export const secureCodeSamples = sqliteTable(
  "secure_code_samples",
  {
    id: text("id").primaryKey(),
    weaknessId: text("weakness_id")
      .notNull()
      .references(() => secureCodingWeaknesses.id, { onDelete: "restrict" }),
    questionId: text("question_id").references(() => questions.id, {
      onDelete: "restrict",
    }),
    language: text("language").notNull(),
    title: text("title").notNull(),
    vulnerableCode: text("vulnerable_code").notNull(),
    secureCode: text("secure_code").notNull(),
    vulnerableLinesJson: text("vulnerable_lines_json").notNull().default("[]"),
    explanation: text("explanation").notNull().default(""),
    falsePositivePossible: integer("false_positive_possible", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    expectedTruePositive: integer("expected_true_positive", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    callRelation: text("call_relation").notNull().default(""),
    executionFlow: text("execution_flow").notNull().default(""),
    remediationKeywordsJson: text("remediation_keywords_json")
      .notNull()
      .default("[]"),
    sourceDate: text("source_date").notNull(),
    sampleOnly: integer("sample_only", { mode: "boolean" })
      .notNull()
      .default(true),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("secure_code_samples_question_unique").on(table.questionId),
    index("secure_code_samples_listing_idx").on(
      table.active,
      table.language,
      table.weaknessId,
    ),
    check(
      "secure_code_samples_language_check",
      sql`${table.language} IN ('Java', 'C', 'C++', 'Python', 'JavaScript')`,
    ),
  ],
);

export const secureCodeGradingRules = sqliteTable(
  "secure_code_grading_rules",
  {
    id: text("id").primaryKey(),
    sampleId: text("sample_id")
      .notNull()
      .references(() => secureCodeSamples.id, { onDelete: "cascade" }),
    lineScore: integer("line_score").notNull().default(30),
    weaknessScore: integer("weakness_score").notNull().default(20),
    cweScore: integer("cwe_score").notNull().default(15),
    judgmentScore: integer("judgment_score").notNull().default(15),
    keywordScore: integer("keyword_score").notNull().default(15),
    remediationCodeScore: integer("remediation_code_score")
      .notNull()
      .default(5),
    maximumScore: integer("maximum_score").notNull().default(100),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("secure_code_grading_rules_sample_unique").on(table.sampleId),
    check(
      "secure_code_grading_rules_score_check",
      sql`${table.lineScore} >= 0 AND ${table.weaknessScore} >= 0 AND ${table.cweScore} >= 0 AND ${table.judgmentScore} >= 0 AND ${table.keywordScore} >= 0 AND ${table.remediationCodeScore} >= 0 AND ${table.maximumScore} > 0`,
    ),
  ],
);

export const codeAnalysisAnswers = sqliteTable(
  "code_analysis_answers",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => questionAttempts.id, { onDelete: "restrict" }),
    sampleId: text("sample_id")
      .notNull()
      .references(() => secureCodeSamples.id, { onDelete: "restrict" }),
    selectedLinesJson: text("selected_lines_json").notNull().default("[]"),
    weaknessId: text("weakness_id")
      .notNull()
      .references(() => secureCodingWeaknesses.id, { onDelete: "restrict" }),
    selectedCweCode: text("selected_cwe_code").notNull(),
    truePositive: integer("true_positive", { mode: "boolean" }).notNull(),
    userExplanation: text("user_explanation").notNull().default(""),
    remediationCode: text("remediation_code").notNull().default(""),
    matchedCriteriaJson: text("matched_criteria_json").notNull().default("[]"),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
    score: integer("score").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("code_analysis_answers_attempt_unique").on(table.attemptId),
    index("code_analysis_answers_sample_idx").on(
      table.sampleId,
      table.createdAt,
    ),
  ],
);

export const privacyImpactAssessmentItems = sqliteTable(
  "privacy_impact_assessment_items",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    checkPoints: text("check_points").notNull().default(""),
    evidenceExamples: text("evidence_examples").notNull().default(""),
    riskExamples: text("risk_examples").notNull().default(""),
    improvementExamples: text("improvement_examples").notNull().default(""),
    version: text("version").notNull(),
    effectiveDate: text("effective_date").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("privacy_impact_items_code_version_unique").on(
      table.code,
      table.version,
    ),
    index("privacy_impact_items_listing_idx").on(
      table.active,
      table.category,
      table.code,
    ),
  ],
);

export const privacyAssessmentScenarios = sqliteTable(
  "privacy_assessment_scenarios",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    organizationType: text("organization_type").notNull(),
    systemType: text("system_type").notNull(),
    processedData: text("processed_data").notNull(),
    dataSubjects: text("data_subjects").notNull(),
    processingPurpose: text("processing_purpose").notNull(),
    track: text("track").notNull().default("PRACTICE"),
    correctTargetDecision: text("correct_target_decision").notNull(),
    expectedAssessmentItemsJson: text("expected_assessment_items_json")
      .notNull()
      .default("[]"),
    modelImprovementPlan: text("model_improvement_plan").notNull().default(""),
    scoringRulesJson: text("scoring_rules_json").notNull().default("{}"),
    sampleOnly: integer("sample_only", { mode: "boolean" })
      .notNull()
      .default(true),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("privacy_assessment_scenarios_course_idx").on(
      table.courseId,
      table.active,
      table.track,
    ),
    check(
      "privacy_assessment_scenarios_track_check",
      sql`${table.track} IN ('EXAM_PREP', 'PRACTICE')`,
    ),
    check(
      "privacy_assessment_scenarios_decision_check",
      sql`${table.correctTargetDecision} IN ('REQUIRED', 'NOT_REQUIRED', 'REVIEW_NEEDED')`,
    ),
  ],
);

export const privacyFlowNodes = sqliteTable(
  "privacy_flow_nodes",
  {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => privacyAssessmentScenarios.id, {
        onDelete: "cascade",
      }),
    nodeType: text("node_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    systemName: text("system_name").notNull().default(""),
    organizationName: text("organization_name").notNull().default(""),
    displayX: integer("display_x").notNull().default(0),
    displayY: integer("display_y").notNull().default(0),
    displayOrder: integer("display_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("privacy_flow_nodes_scenario_id_unique").on(
      table.scenarioId,
      table.id,
    ),
    index("privacy_flow_nodes_order_idx").on(
      table.scenarioId,
      table.displayOrder,
    ),
    check(
      "privacy_flow_nodes_type_check",
      sql`${table.nodeType} IN ('DATA_SUBJECT', 'COLLECTION', 'PROCESSING', 'STORAGE', 'TRANSFER', 'DESTRUCTION', 'EXTERNAL')`,
    ),
  ],
);

export const privacyFlowEdges = sqliteTable(
  "privacy_flow_edges",
  {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => privacyAssessmentScenarios.id, {
        onDelete: "cascade",
      }),
    sourceNodeId: text("source_node_id").notNull(),
    targetNodeId: text("target_node_id").notNull(),
    dataTypes: text("data_types").notNull(),
    transferMethod: text("transfer_method").notNull(),
    purpose: text("purpose").notNull().default(""),
    protectionMeasures: text("protection_measures").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.scenarioId, table.sourceNodeId],
      foreignColumns: [privacyFlowNodes.scenarioId, privacyFlowNodes.id],
      name: "privacy_flow_edges_source_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.scenarioId, table.targetNodeId],
      foreignColumns: [privacyFlowNodes.scenarioId, privacyFlowNodes.id],
      name: "privacy_flow_edges_target_fk",
    }).onDelete("cascade"),
    uniqueIndex("privacy_flow_edges_unique").on(
      table.scenarioId,
      table.sourceNodeId,
      table.targetNodeId,
      table.dataTypes,
    ),
    index("privacy_flow_edges_scenario_idx").on(table.scenarioId),
    check(
      "privacy_flow_edges_self_check",
      sql`${table.sourceNodeId} <> ${table.targetNodeId}`,
    ),
  ],
);

export const privacyAssessmentAnswers = sqliteTable(
  "privacy_assessment_answers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => privacyAssessmentScenarios.id, {
        onDelete: "restrict",
      }),
    targetDecision: text("target_decision").notNull(),
    selectedAssessmentItemsJson: text("selected_assessment_items_json")
      .notNull()
      .default("[]"),
    identifiedRisks: text("identified_risks").notNull().default(""),
    improvementPlan: text("improvement_plan").notNull().default(""),
    score: integer("score").notNull().default(0),
    feedbackJson: text("feedback_json").notNull().default("{}"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("privacy_assessment_answers_user_scenario_unique").on(
      table.userId,
      table.scenarioId,
    ),
    index("privacy_assessment_answers_user_idx").on(
      table.userId,
      table.updatedAt,
    ),
    check(
      "privacy_assessment_answers_decision_check",
      sql`${table.targetDecision} IN ('REQUIRED', 'NOT_REQUIRED', 'REVIEW_NEEDED')`,
    ),
    check(
      "privacy_assessment_answers_score_check",
      sql`${table.score} >= 0 AND ${table.score} <= 100`,
    ),
  ],
);

export const aiGenerationRecords = sqliteTable(
  "ai_generation_records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    generatedAt: text("generated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    sourceContextIdsJson: text("source_context_ids_json")
      .notNull()
      .default("[]"),
    disclaimer: text("disclaimer").notNull(),
    reviewed: integer("reviewed", { mode: "boolean" })
      .notNull()
      .default(false),
    reviewedBy: text("reviewed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    reviewedAt: text("reviewed_at"),
    requestId: text("request_id").notNull(),
    latencyMs: integer("latency_ms").notNull().default(0),
    status: text("status").notNull(),
    resultJson: text("result_json").notNull().default("{}"),
    errorCode: text("error_code"),
    promptFingerprint: text("prompt_fingerprint").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
    retentionUntil: text("retention_until"),
  },
  (table) => [
    uniqueIndex("ai_generation_records_request_unique").on(table.requestId),
    index("ai_generation_records_user_course_idx").on(
      table.userId,
      table.courseId,
      table.generatedAt,
    ),
    index("ai_generation_records_question_idx").on(
      table.questionId,
      table.generatedAt,
    ),
    index("ai_generation_records_status_idx").on(
      table.status,
      table.generatedAt,
    ),
    check(
      "ai_generation_records_provider_check",
      sql`${table.provider} IN ('mock', 'openai')`,
    ),
    check(
      "ai_generation_records_status_check",
      sql`${table.status} IN ('generated', 'failed', 'insufficient_context', 'reviewed', 'rejected')`,
    ),
    check(
      "ai_generation_records_nonnegative_check",
      sql`${table.latencyMs} >= 0 AND ${table.inputTokens} >= 0 AND ${table.outputTokens} >= 0 AND ${table.estimatedCostMicros} >= 0`,
    ),
  ],
);

export const aiSpecializedGenerationRecords = sqliteTable(
  "ai_specialized_generation_records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    generatedAt: text("generated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    sourceContextIdsJson: text("source_context_ids_json")
      .notNull()
      .default("[]"),
    disclaimer: text("disclaimer").notNull(),
    requestId: text("request_id").notNull(),
    latencyMs: integer("latency_ms").notNull().default(0),
    generationStatus: text("generation_status").notNull(),
    reviewStatus: text("review_status").notNull().default("PENDING"),
    originalResultJson: text("original_result_json").notNull().default("{}"),
    errorCode: text("error_code"),
    inputFingerprint: text("input_fingerprint").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostMicros: integer("estimated_cost_micros").notNull().default(0),
    retentionUntil: text("retention_until"),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("ai_specialized_records_request_unique").on(table.requestId),
    index("ai_specialized_records_user_idx").on(
      table.userId,
      table.courseId,
      table.generatedAt,
    ),
    index("ai_specialized_records_target_idx").on(
      table.targetType,
      table.targetId,
      table.generatedAt,
    ),
    index("ai_specialized_records_review_idx").on(
      table.reviewStatus,
      table.deletedAt,
      table.generatedAt,
    ),
    check(
      "ai_specialized_records_target_check",
      sql`${table.targetType} IN ('WRITTEN_ANSWER', 'RISK_SCENARIO', 'PRIVACY_ASSESSMENT', 'SECURE_CODE')`,
    ),
    check(
      "ai_specialized_records_provider_check",
      sql`${table.provider} IN ('mock', 'openai')`,
    ),
    check(
      "ai_specialized_records_generation_status_check",
      sql`${table.generationStatus} IN ('generated', 'failed', 'insufficient_context', 'reviewed', 'rejected')`,
    ),
    check(
      "ai_specialized_records_review_status_check",
      sql`${table.reviewStatus} IN ('PENDING', 'REVIEWED', 'APPROVED_WITH_EDITS', 'REJECTED', 'DELETED', 'COPIED')`,
    ),
    check(
      "ai_specialized_records_nonnegative_check",
      sql`${table.latencyMs} >= 0 AND ${table.inputTokens} >= 0 AND ${table.outputTokens} >= 0 AND ${table.estimatedCostMicros} >= 0`,
    ),
  ],
);

export const aiSpecializedReviews = sqliteTable(
  "ai_specialized_reviews",
  {
    id: text("id").primaryKey(),
    generationId: text("generation_id")
      .notNull()
      .references(() => aiSpecializedGenerationRecords.id, {
        onDelete: "restrict",
      }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    action: text("action").notNull(),
    editedResultJson: text("edited_result_json").notNull().default("{}"),
    reviewNote: text("review_note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("ai_specialized_reviews_revision_unique").on(
      table.generationId,
      table.revision,
    ),
    index("ai_specialized_reviews_reviewer_idx").on(
      table.reviewerId,
      table.createdAt,
    ),
    check(
      "ai_specialized_reviews_action_check",
      sql`${table.action} IN ('REVIEWED', 'APPROVED_WITH_EDITS', 'REJECTED', 'DELETED', 'COPIED')`,
    ),
    check(
      "ai_specialized_reviews_revision_check",
      sql`${table.revision} > 0`,
    ),
  ],
);

export const aiReviewedContents = sqliteTable(
  "ai_reviewed_contents",
  {
    id: text("id").primaryKey(),
    generationId: text("generation_id")
      .notNull()
      .references(() => aiSpecializedGenerationRecords.id, {
        onDelete: "restrict",
      }),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    title: text("title").notNull(),
    contentJson: text("content_json").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ai_reviewed_contents_generation_unique").on(
      table.generationId,
    ),
    index("ai_reviewed_contents_course_idx").on(
      table.courseId,
      table.active,
      table.updatedAt,
    ),
  ],
);

export const aiExplainabilityFeedback = sqliteTable(
  "ai_explainability_feedback",
  {
    id: text("id").primaryKey(),
    traceSource: text("trace_source").notNull(),
    questionGenerationId: text("question_generation_id").references(
      () => aiGenerationRecords.id,
      { onDelete: "restrict" },
    ),
    specializedGenerationId: text("specialized_generation_id").references(
      () => aiSpecializedGenerationRecords.id,
      { onDelete: "restrict" },
    ),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    rating: text("rating").notNull(),
    issueType: text("issue_type").notNull(),
    note: text("note").notNull().default(""),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("ai_explainability_feedback_trace_idx").on(
      table.traceSource,
      table.createdAt,
    ),
    index("ai_explainability_feedback_reviewer_idx").on(
      table.reviewerId,
      table.createdAt,
    ),
    index("ai_explainability_feedback_question_idx").on(
      table.questionGenerationId,
    ),
    index("ai_explainability_feedback_specialized_idx").on(
      table.specializedGenerationId,
    ),
    check(
      "ai_explainability_feedback_trace_source_check",
      sql`${table.traceSource} IN ('QUESTION_EXPLANATION', 'SPECIALIZED_REVIEW')`,
    ),
    check(
      "ai_explainability_feedback_rating_check",
      sql`${table.rating} IN ('HELPFUL', 'NOT_HELPFUL', 'NEEDS_REVIEW')`,
    ),
    check(
      "ai_explainability_feedback_issue_type_check",
      sql`${table.issueType} IN ('NONE', 'LOW_QUALITY_CONTEXT', 'MISSING_CITATION', 'WRONG_CONCEPT', 'PROMPT_ISSUE', 'SENSITIVE_CONTENT_RISK', 'OTHER')`,
    ),
    check(
      "ai_explainability_feedback_target_check",
      sql`(${table.traceSource} = 'QUESTION_EXPLANATION' AND ${table.questionGenerationId} IS NOT NULL AND ${table.specializedGenerationId} IS NULL) OR (${table.traceSource} = 'SPECIALIZED_REVIEW' AND ${table.specializedGenerationId} IS NOT NULL AND ${table.questionGenerationId} IS NULL)`,
    ),
  ],
);

export const ontologyConcepts = sqliteTable(
  "ontology_concepts",
  {
    id: text("id").primaryKey(),
    conceptKey: text("concept_key").notNull(),
    namespace: text("namespace").notNull().default("securium"),
    label: text("label").notNull(),
    normalizedLabel: text("normalized_label").notNull(),
    category: text("category").notNull().default("general"),
    description: text("description").notNull().default(""),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    weight: integer("weight").notNull().default(1),
    status: text("status").notNull().default("ACTIVE"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ontology_concepts_key_unique").on(table.conceptKey),
    index("ontology_concepts_namespace_idx").on(
      table.namespace,
      table.status,
      table.weight,
    ),
    index("ontology_concepts_normalized_idx").on(table.normalizedLabel),
    index("ontology_concepts_source_idx").on(table.sourceType, table.sourceId),
    check(
      "ontology_concepts_status_check",
      sql`${table.status} IN ('ACTIVE', 'DRAFT', 'ARCHIVED')`,
    ),
    check(
      "ontology_concepts_weight_check",
      sql`${table.weight} >= 0 AND ${table.weight} <= 100`,
    ),
  ],
);

export const ontologyAliases = sqliteTable(
  "ontology_aliases",
  {
    id: text("id").primaryKey(),
    conceptId: text("concept_id")
      .notNull()
      .references(() => ontologyConcepts.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    language: text("language").notNull().default("und"),
    source: text("source").notNull().default("manual"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ontology_aliases_concept_normalized_unique").on(
      table.conceptId,
      table.normalizedAlias,
    ),
    index("ontology_aliases_lookup_idx").on(table.normalizedAlias),
  ],
);

export const ontologyEdges = sqliteTable(
  "ontology_edges",
  {
    id: text("id").primaryKey(),
    edgeKey: text("edge_key").notNull(),
    courseId: text("course_id").references(() => courses.id, {
      onDelete: "restrict",
    }),
    fromType: text("from_type").notNull(),
    fromId: text("from_id").notNull(),
    toType: text("to_type").notNull(),
    toId: text("to_id").notNull(),
    relation: text("relation").notNull(),
    confidence: integer("confidence").notNull().default(10000),
    evidenceJson: text("evidence_json").notNull().default("[]"),
    status: text("status").notNull().default("ACTIVE"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ontology_edges_key_unique").on(table.edgeKey),
    index("ontology_edges_course_relation_idx").on(
      table.courseId,
      table.relation,
      table.status,
    ),
    index("ontology_edges_from_idx").on(
      table.fromType,
      table.fromId,
      table.relation,
    ),
    index("ontology_edges_to_idx").on(table.toType, table.toId, table.relation),
    check(
      "ontology_edges_status_check",
      sql`${table.status} IN ('ACTIVE', 'DRAFT', 'ARCHIVED')`,
    ),
    check(
      "ontology_edges_confidence_check",
      sql`${table.confidence} >= 0 AND ${table.confidence} <= 10000`,
    ),
    check(
      "ontology_edges_relation_check",
      sql`${table.relation} IN ('COVERS', 'EXPLAINS', 'TESTS', 'REUSES_CONTENT', 'ASSESSED_BY', 'PREREQUISITE_OF', 'RELATED_TO', 'DERIVED_FROM', 'PARENT_OF', 'CHILD_OF', 'SYNONYM_OF', 'CROSS_COURSE_EQUIVALENT')`,
    ),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    courseId: text("course_id").references(() => courses.id, {
      onDelete: "restrict",
    }),
    requestId: text("request_id"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorUserId, table.createdAt),
    index("audit_logs_target_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt,
    ),
  ],
);

export const adminAuditLogs = sqliteTable(
  "admin_audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    actorRole: text("actor_role").notNull().default("UNKNOWN"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    result: text("result").notNull().default("SUCCESS"),
    ipHash: text("ip_hash"),
    userAgentSummary: text("user_agent_summary"),
    requestId: text("request_id"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("admin_audit_logs_actor_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("admin_audit_logs_period_action_idx").on(
      table.createdAt,
      table.action,
      table.result,
    ),
    index("admin_audit_logs_resource_idx").on(
      table.resourceType,
      table.resourceId,
      table.createdAt,
    ),
    index("admin_audit_logs_request_idx").on(table.requestId),
    check(
      "admin_audit_logs_result_check",
      sql`${table.result} IN ('SUCCESS', 'FAILURE', 'DENIED')`,
    ),
    check(
      "admin_audit_logs_metadata_length_check",
      sql`length(${table.metadataJson}) <= 10000`,
    ),
  ],
);

export const practicalRubricVersions = sqliteTable(
  "practical_rubric_versions",
  {
    id: text("id").primaryKey(),
    rubricId: text("rubric_id").notNull(),
    version: integer("version").notNull(),
    snapshotFormatVersion: integer("snapshot_format_version")
      .notNull()
      .default(1),
    snapshotJson: text("snapshot_json").notNull(),
    snapshotDigest: text("snapshot_digest").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    effectiveFrom: text("effective_from"),
    withdrawnAt: text("withdrawn_at"),
  },
  (table) => [
    uniqueIndex("practical_rubric_versions_identity_unique").on(
      table.rubricId,
      table.version,
    ),
    check(
      "practical_rubric_versions_version_check",
      sql`${table.version} > 0`,
    ),
    check(
      "practical_rubric_versions_format_check",
      sql`${table.snapshotFormatVersion} > 0`,
    ),
    check(
      "practical_rubric_versions_snapshot_length_check",
      sql`length(${table.snapshotJson}) <= 100000`,
    ),
    check(
      "practical_rubric_versions_digest_check",
      sql`length(${table.snapshotDigest}) = 64 AND ${table.snapshotDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
);

export const practicalDefinitionVersions = sqliteTable(
  "practical_definition_versions",
  {
    id: text("id").primaryKey(),
    practicalId: text("practical_id").notNull(),
    version: integer("version").notNull(),
    rubricVersionId: text("rubric_version_id")
      .notNull()
      .references(() => practicalRubricVersions.id, { onDelete: "restrict" }),
    snapshotFormatVersion: integer("snapshot_format_version")
      .notNull()
      .default(1),
    snapshotJson: text("snapshot_json").notNull(),
    snapshotDigest: text("snapshot_digest").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    effectiveFrom: text("effective_from"),
    withdrawnAt: text("withdrawn_at"),
  },
  (table) => [
    uniqueIndex("practical_definition_versions_identity_unique").on(
      table.practicalId,
      table.version,
    ),
    uniqueIndex("practical_definition_versions_rubric_binding_unique").on(
      table.id,
      table.rubricVersionId,
    ),
    check(
      "practical_definition_versions_version_check",
      sql`${table.version} > 0`,
    ),
    check(
      "practical_definition_versions_format_check",
      sql`${table.snapshotFormatVersion} > 0`,
    ),
    check(
      "practical_definition_versions_snapshot_length_check",
      sql`length(${table.snapshotJson}) <= 100000`,
    ),
    check(
      "practical_definition_versions_digest_check",
      sql`length(${table.snapshotDigest}) = 64 AND ${table.snapshotDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
);

export const practicalAttempts = sqliteTable(
  "practical_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    practicalId: text("practical_id").notNull(),
    practicalDefinitionVersionId: text("practical_definition_version_id").notNull(),
    rubricVersionId: text("rubric_version_id").notNull(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    curriculumTreeId: text("curriculum_tree_id")
      .notNull()
      .references(() => curriculumTrees.id, { onDelete: "restrict" }),
    curriculumTreeVersionReference: text("curriculum_tree_version_reference").notNull(),
    curriculumNodeId: text("curriculum_node_id")
      .notNull()
      .references(() => curriculumNodes.id, { onDelete: "restrict" }),
    objectivePlacementId: text("objective_placement_id").notNull(),
    practicalPlacementId: text("practical_placement_id").notNull(),
    state: text("state").notNull().default("IN_PROGRESS"),
    responsesJson: text("responses_json").notNull().default("[]"),
    artifactManifestJson: text("artifact_manifest_json").notNull().default("[]"),
    submissionDigest: text("submission_digest"),
    creationIdempotencyKey: text("creation_idempotency_key").notNull(),
    submissionIdempotencyKey: text("submission_idempotency_key"),
    draftRevision: integer("draft_revision").notNull().default(0),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    submittedAt: text("submitted_at"),
    expiresAt: text("expires_at"),
    expiredAt: text("expired_at"),
    voidedAt: text("voided_at"),
    voidReasonCode: text("void_reason_code"),
    eligibilityDecisionReference: text("eligibility_decision_reference"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    foreignKey({
      name: "practical_attempts_definition_rubric_fk",
      columns: [table.practicalDefinitionVersionId, table.rubricVersionId],
      foreignColumns: [
        practicalDefinitionVersions.id,
        practicalDefinitionVersions.rubricVersionId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("practical_attempts_creation_idempotency_unique").on(
      table.userId,
      table.creationIdempotencyKey,
    ),
    uniqueIndex("practical_attempts_submission_idempotency_unique")
      .on(table.userId, table.submissionIdempotencyKey)
      .where(sql`${table.submissionIdempotencyKey} IS NOT NULL`),
    uniqueIndex("practical_attempts_version_binding_unique").on(
      table.id,
      table.practicalDefinitionVersionId,
      table.rubricVersionId,
    ),
    index("practical_attempts_user_history_idx").on(
      table.userId,
      table.practicalId,
      table.startedAt,
    ),
    index("practical_attempts_user_state_idx").on(
      table.userId,
      table.state,
      table.updatedAt,
    ),
    index("practical_attempts_expiration_idx").on(table.state, table.expiresAt),
    check(
      "practical_attempts_state_check",
      sql`${table.state} IN ('IN_PROGRESS', 'SUBMITTED', 'EVALUATED', 'EXPIRED', 'VOIDED')`,
    ),
    check(
      "practical_attempts_responses_length_check",
      sql`length(${table.responsesJson}) <= 100000`,
    ),
    check(
      "practical_attempts_artifact_manifest_length_check",
      sql`length(${table.artifactManifestJson}) <= 20000`,
    ),
    check(
      "practical_attempts_submission_digest_check",
      sql`${table.submissionDigest} IS NULL OR (length(${table.submissionDigest}) = 64 AND ${table.submissionDigest} NOT GLOB '*[^0-9a-f]*')`,
    ),
    check(
      "practical_attempts_draft_revision_check",
      sql`${table.draftRevision} >= 0`,
    ),
    check(
      "practical_attempts_void_reason_length_check",
      sql`${table.voidReasonCode} IS NULL OR length(${table.voidReasonCode}) <= 200`,
    ),
  ],
);

export const practicalEvaluations = sqliteTable(
  "practical_evaluations",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull(),
    sequence: integer("sequence").notNull(),
    previousEvaluationId: text("previous_evaluation_id"),
    practicalDefinitionVersionId: text("practical_definition_version_id").notNull(),
    rubricVersionId: text("rubric_version_id").notNull(),
    method: text("method").notNull(),
    dimensionResultsJson: text("dimension_results_json").notNull(),
    rawScore: real("raw_score"),
    maximumScore: real("maximum_score"),
    qualification: text("qualification").notNull(),
    reviewStatus: text("review_status").notNull().default("NOT_REQUIRED"),
    provenanceJson: text("provenance_json").notNull(),
    reviewerId: text("reviewer_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    reviewedAt: text("reviewed_at"),
    reviewReason: text("review_reason"),
    evaluationPayloadDigest: text("evaluation_payload_digest").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    evaluatorJobId: text("evaluator_job_id"),
    evaluatorResultId: text("evaluator_result_id"),
    evaluatedAt: text("evaluated_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    foreignKey({
      name: "practical_evaluations_attempt_version_fk",
      columns: [
        table.attemptId,
        table.practicalDefinitionVersionId,
        table.rubricVersionId,
      ],
      foreignColumns: [
        practicalAttempts.id,
        practicalAttempts.practicalDefinitionVersionId,
        practicalAttempts.rubricVersionId,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "practical_evaluations_previous_fk",
      columns: [table.previousEvaluationId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    uniqueIndex("practical_evaluations_sequence_unique").on(
      table.attemptId,
      table.sequence,
    ),
    uniqueIndex("practical_evaluations_operation_unique").on(
      table.attemptId,
      table.idempotencyKey,
    ),
    uniqueIndex("practical_evaluations_predecessor_unique")
      .on(table.previousEvaluationId)
      .where(sql`${table.previousEvaluationId} IS NOT NULL`),
    uniqueIndex("practical_evaluations_evaluator_result_unique")
      .on(table.attemptId, table.evaluatorJobId, table.evaluatorResultId)
      .where(
        sql`${table.evaluatorJobId} IS NOT NULL AND ${table.evaluatorResultId} IS NOT NULL`,
      ),
    index("practical_evaluations_review_queue_idx").on(
      table.reviewStatus,
      table.createdAt,
    ),
    check("practical_evaluations_sequence_check", sql`${table.sequence} >= 1`),
    check(
      "practical_evaluations_method_check",
      sql`${table.method} IN ('DETERMINISTIC', 'RUBRIC', 'AI_ASSISTED', 'HUMAN_REVIEWED', 'HYBRID')`,
    ),
    check(
      "practical_evaluations_qualification_check",
      sql`${table.qualification} IN ('QUALIFIED', 'NOT_QUALIFIED', 'PENDING_REVIEW')`,
    ),
    check(
      "practical_evaluations_review_status_check",
      sql`${table.reviewStatus} IN ('NOT_REQUIRED', 'PENDING', 'COMPLETED')`,
    ),
    check(
      "practical_evaluations_dimension_results_length_check",
      sql`length(${table.dimensionResultsJson}) <= 100000`,
    ),
    check(
      "practical_evaluations_provenance_length_check",
      sql`length(${table.provenanceJson}) <= 10000`,
    ),
    check(
      "practical_evaluations_review_reason_length_check",
      sql`${table.reviewReason} IS NULL OR length(${table.reviewReason}) <= 2000`,
    ),
    check(
      "practical_evaluations_score_pair_check",
      sql`(${table.rawScore} IS NULL AND ${table.maximumScore} IS NULL) OR (${table.rawScore} IS NOT NULL AND ${table.maximumScore} IS NOT NULL AND ${table.rawScore} >= 0 AND ${table.maximumScore} > 0 AND ${table.rawScore} <= ${table.maximumScore} AND ${table.rawScore} <= 1.7976931348623157e308 AND ${table.maximumScore} <= 1.7976931348623157e308)`,
    ),
    check(
      "practical_evaluations_ai_qualification_check",
      sql`NOT (${table.method} = 'AI_ASSISTED' AND ${table.qualification} = 'QUALIFIED')`,
    ),
    check(
      "practical_evaluations_evaluator_identity_check",
      sql`(${table.evaluatorJobId} IS NULL AND ${table.evaluatorResultId} IS NULL) OR (${table.evaluatorJobId} IS NOT NULL AND ${table.evaluatorResultId} IS NOT NULL)`,
    ),
    check(
      "practical_evaluations_digest_check",
      sql`length(${table.evaluationPayloadDigest}) = 64 AND ${table.evaluationPayloadDigest} NOT GLOB '*[^0-9a-f]*'`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type CourseGroup = typeof courseGroups.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type LearningUnit = typeof learningUnits.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type AudioContent = typeof audioContents.$inferSelect;
export type AudioProgress = typeof audioProgress.$inferSelect;
export type Lecture = typeof lectures.$inferSelect;
export type LectureProgress = typeof lectureProgress.$inferSelect;
export type LectureBookmark = typeof lectureBookmarks.$inferSelect;
export type LectureNote = typeof lectureNotes.$inferSelect;
export type ContentRevision = typeof contentRevisions.$inferSelect;
export type UserCourseEnrollment =
  typeof userCourseEnrollments.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type UserLessonProgress = typeof userLessonProgress.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type QuestionChoice = typeof questionChoices.$inferSelect;
export type QuestionAttempt = typeof questionAttempts.$inferSelect;
export type WrongNote = typeof wrongNotes.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type Level = typeof levels.$inferSelect;
export type UserLevelProgress = typeof userLevelProgress.$inferSelect;
export type ReviewSchedule = typeof reviewSchedules.$inferSelect;
export type MockExam = typeof mockExams.$inferSelect;
export type MockExamAttempt = typeof mockExamAttempts.$inferSelect;
export type CourseSpecialization = typeof courseSpecializations.$inferSelect;
export type IsmsStandard = typeof ismsStandards.$inferSelect;
export type LegalArticle = typeof legalArticles.$inferSelect;
export type RiskScenario = typeof riskScenarios.$inferSelect;
export type SecureCodingWeakness = typeof secureCodingWeaknesses.$inferSelect;
export type SecureCodeSample = typeof secureCodeSamples.$inferSelect;
export type CodeAnalysisAnswer = typeof codeAnalysisAnswers.$inferSelect;
export type PrivacyImpactAssessmentItem =
  typeof privacyImpactAssessmentItems.$inferSelect;
export type PrivacyAssessmentScenario =
  typeof privacyAssessmentScenarios.$inferSelect;
export type PrivacyAssessmentAnswer =
  typeof privacyAssessmentAnswers.$inferSelect;
export type AISpecializedGenerationRecord =
  typeof aiSpecializedGenerationRecords.$inferSelect;
export type AISpecializedReview = typeof aiSpecializedReviews.$inferSelect;
export type AIReviewedContent = typeof aiReviewedContents.$inferSelect;
export type AIExplainabilityFeedback =
  typeof aiExplainabilityFeedback.$inferSelect;
export type OntologyConcept = typeof ontologyConcepts.$inferSelect;
export type OntologyAlias = typeof ontologyAliases.$inferSelect;
export type OntologyEdge = typeof ontologyEdges.$inferSelect;
export type AuditLog = typeof adminAuditLogs.$inferSelect;
export type PracticalRubricVersionRecord =
  typeof practicalRubricVersions.$inferSelect;
export type PracticalDefinitionVersionRecord =
  typeof practicalDefinitionVersions.$inferSelect;
export type PracticalAttemptRecord = typeof practicalAttempts.$inferSelect;
export type PracticalEvaluationRecord =
  typeof practicalEvaluations.$inferSelect;
