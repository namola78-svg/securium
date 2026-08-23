import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from ".";
import {
  audioContents,
  contentCourseLinks,
  contentRevisions,
  courseSpecializations,
  ismsStandards,
  learningUnits,
  legalArticles,
  lectures,
  lessons,
  privacyImpactAssessmentItems,
  questionCourses,
  questions,
  secureCodingWeaknesses,
  subjects,
  userCourseEnrollments,
} from "./schema";
import { AppError } from "@/lib/errors";
import {
  CONTENT_REVISION_TYPES,
  CONTENT_REVISION_TYPE_LABELS,
  compareRevisionSnapshots,
  mergeAllowedSnapshot,
  parseRevisionSnapshot,
  type ContentRevisionType,
} from "@/lib/services/content-revision-service";

export { saveGovernedTheoryRevision } from "./content-revision-governance-repositories.ts";

type TargetRecord = {
  contentType: ContentRevisionType;
  contentId: string;
  courseId: string | null;
  title: string;
  contentDate: string;
  version: string;
  snapshot: Record<string, unknown>;
  allowedFields: readonly string[];
};

function batchItems(items: BatchItem<"sqlite">[]) {
  return items as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];
}

function nowIso() {
  return new Date().toISOString();
}

function assertContentType(value: string): asserts value is ContentRevisionType {
  if (!CONTENT_REVISION_TYPES.includes(value as ContentRevisionType)) {
    throw new AppError(
      "지원하지 않는 콘텐츠 유형입니다.",
      400,
      "REVISION_TYPE_INVALID",
    );
  }
}

async function firstCourseForLinkedContent(
  contentType: string,
  contentId: string,
) {
  const [row] = await getDb()
    .select({ courseId: contentCourseLinks.courseId })
    .from(contentCourseLinks)
    .where(
      and(
        eq(contentCourseLinks.contentType, contentType),
        eq(contentCourseLinks.contentId, contentId),
      ),
    )
    .limit(1);
  return row?.courseId ?? null;
}

export async function getRevisionTarget(
  contentType: ContentRevisionType,
  contentId: string,
): Promise<TargetRecord | null> {
  switch (contentType) {
    case "LEGAL_ARTICLE": {
      const [row] = await getDb()
        .select()
        .from(legalArticles)
        .where(eq(legalArticles.id, contentId))
        .limit(1);
      if (!row) return null;
      return {
        contentType,
        contentId,
        courseId: await firstCourseForLinkedContent(contentType, contentId),
        title: `${row.lawName} ${row.articleNumber} ${row.articleTitle}`,
        contentDate: row.effectiveDate,
        version: row.version,
        snapshot: row,
        allowedFields: [
          "lawName",
          "articleNumber",
          "articleTitle",
          "content",
          "effectiveDate",
          "revisionDate",
          "sourceUrl",
          "active",
        ],
      };
    }
    case "ISMS_STANDARD": {
      const [row] = await getDb()
        .select()
        .from(ismsStandards)
        .where(eq(ismsStandards.id, contentId))
        .limit(1);
      if (!row) return null;
      return {
        contentType,
        contentId,
        courseId: await firstCourseForLinkedContent(contentType, contentId),
        title: `${row.code} ${row.title}`,
        contentDate: row.effectiveDate,
        version: row.version,
        snapshot: row,
        allowedFields: [
          "code",
          "title",
          "majorCategory",
          "middleCategory",
          "description",
          "keyPoints",
          "evidenceExamples",
          "defectExamples",
          "auditPoints",
          "effectiveDate",
          "sourceUrl",
          "active",
        ],
      };
    }
    case "PRIVACY_IMPACT_ITEM": {
      const [row] = await getDb()
        .select()
        .from(privacyImpactAssessmentItems)
        .where(eq(privacyImpactAssessmentItems.id, contentId))
        .limit(1);
      if (!row) return null;
      const [course] = await getDb()
        .select({ courseId: courseSpecializations.courseId })
        .from(courseSpecializations)
        .where(
          and(
            eq(courseSpecializations.featureType, "PRIVACY_IMPACT_ASSESSMENT"),
            eq(courseSpecializations.active, true),
          ),
        )
        .limit(1);
      return {
        contentType,
        contentId,
        courseId: course?.courseId ?? null,
        title: `${row.code} ${row.title}`,
        contentDate: row.effectiveDate,
        version: row.version,
        snapshot: row,
        allowedFields: [
          "code",
          "category",
          "title",
          "description",
          "checkPoints",
          "evidenceExamples",
          "riskExamples",
          "improvementExamples",
          "effectiveDate",
          "active",
        ],
      };
    }
    case "SUBJECT": {
      const [row] = await getDb()
        .select()
        .from(subjects)
        .where(eq(subjects.id, contentId))
        .limit(1);
      if (!row) return null;
      return {
        contentType,
        contentId,
        courseId: row.courseId,
        title: row.name,
        contentDate: row.updatedAt.slice(0, 10),
        version: "1",
        snapshot: row,
        allowedFields: [
          "code",
          "name",
          "description",
          "displayOrder",
          "active",
        ],
      };
    }
    case "SECURE_CODING_WEAKNESS": {
      const [row] = await getDb()
        .select()
        .from(secureCodingWeaknesses)
        .where(eq(secureCodingWeaknesses.id, contentId))
        .limit(1);
      if (!row) return null;
      return {
        contentType,
        contentId,
        courseId: await firstCourseForLinkedContent(
          "SECURE_CODING_WEAKNESS",
          contentId,
        ),
        title: `${row.code} ${row.name}`,
        contentDate: row.updatedAt.slice(0, 10),
        version: row.version,
        snapshot: row,
        allowedFields: [
          "code",
          "name",
          "category",
          "description",
          "language",
          "cweCode",
          "risk",
          "detectionGuide",
          "remediationGuide",
          "reference",
          "active",
        ],
      };
    }
    case "LEARNING_UNIT": {
      const [row] = await getDb()
        .select()
        .from(learningUnits)
        .where(eq(learningUnits.id, contentId))
        .limit(1);
      if (!row) return null;
      return {
        contentType,
        contentId,
        courseId: row.courseId,
        title: row.title,
        contentDate: row.updatedAt.slice(0, 10),
        version: "1",
        snapshot: row,
        allowedFields: [
          "title",
          "description",
          "displayOrder",
          "active",
          "published",
          "completionPolicy",
          "minimumProgressPercent",
          "minimumStudySeconds",
        ],
      };
    }
    case "LESSON": {
      const [row] = await getDb()
        .select()
        .from(lessons)
        .where(eq(lessons.id, contentId))
        .limit(1);
      if (!row) return null;
      return {
        contentType,
        contentId,
        courseId: row.courseId,
        title: row.title,
        contentDate: row.updatedAt.slice(0, 10),
        version: String(row.version),
        snapshot: row,
        allowedFields: [
          "title",
          "summary",
          "content",
          "contentFormat",
          "estimatedMinutes",
          "displayOrder",
          "active",
          "published",
        ],
      };
    }
    case "QUESTION_EXPLANATION": {
      const [row] = await getDb()
        .select()
        .from(questions)
        .where(eq(questions.id, contentId))
        .limit(1);
      if (!row) return null;
      const [course] = await getDb()
        .select({ courseId: questionCourses.courseId })
        .from(questionCourses)
        .where(eq(questionCourses.questionId, contentId))
        .limit(1);
      return {
        contentType,
        contentId,
        courseId: course?.courseId ?? null,
        title: row.title,
        contentDate: row.sourceDate ?? row.updatedAt.slice(0, 10),
        version: String(row.version),
        snapshot: row,
        allowedFields: [
          "title",
          "explanation",
          "wrongAnswerExplanation",
          "source",
          "sourceDate",
        ],
      };
    }
    case "AUDIO_CONTENT": {
      const [row] = await getDb()
        .select({
          audio: audioContents,
          courseId: lessons.courseId,
        })
        .from(audioContents)
        .innerJoin(lessons, eq(audioContents.lessonId, lessons.id))
        .where(eq(audioContents.id, contentId))
        .limit(1);
      if (!row) return null;
      return {
        contentType,
        contentId,
        courseId: row.courseId,
        title: row.audio.title,
        contentDate: row.audio.updatedAt.slice(0, 10),
        version: "1",
        snapshot: row.audio,
        allowedFields: [
          "title",
          "audioUrl",
          "transcript",
          "transcriptSegmentsJson",
          "durationSeconds",
          "voiceProvider",
          "voiceName",
          "speedOptionsJson",
          "published",
        ],
      };
    }
    case "LECTURE": {
      const [row] = await getDb()
        .select()
        .from(lectures)
        .where(eq(lectures.id, contentId))
        .limit(1);
      if (!row) return null;
      return {
        contentType,
        contentId,
        courseId: row.courseId,
        title: row.title,
        contentDate: row.updatedAt.slice(0, 10),
        version: "1",
        snapshot: row,
        allowedFields: [
          "title",
          "instructorName",
          "description",
          "videoProvider",
          "videoUrl",
          "thumbnailUrl",
          "durationSeconds",
          "free",
          "published",
          "displayOrder",
        ],
      };
    }
  }
}

export async function getLatestPublishedRevision(
  contentType: ContentRevisionType,
  contentId: string,
) {
  const [revision] = await getDb()
    .select()
    .from(contentRevisions)
    .where(
      and(
        eq(contentRevisions.contentType, contentType),
        eq(contentRevisions.contentId, contentId),
        eq(contentRevisions.revisionStatus, "published"),
        eq(contentRevisions.isLatest, true),
      ),
    )
    .limit(1);
  return revision ?? null;
}

export async function getPublicContentRevision(
  revisionId: string,
  userId: string,
) {
  const [revision] = await getDb()
    .select()
    .from(contentRevisions)
    .where(eq(contentRevisions.id, revisionId))
    .limit(1);
  if (
    !revision ||
    !["published", "superseded"].includes(revision.revisionStatus)
  ) {
    return null;
  }
  if (revision.courseId) {
    const [enrollment] = await getDb()
      .select({ status: userCourseEnrollments.status })
      .from(userCourseEnrollments)
      .where(
        and(
          eq(userCourseEnrollments.userId, userId),
          eq(userCourseEnrollments.courseId, revision.courseId),
        ),
      )
      .limit(1);
    if (!enrollment || enrollment.status === "CANCELLED") return null;
  }
  return {
    ...revision,
    snapshot: parseRevisionSnapshot(revision.snapshotJson),
  };
}

export async function listContentRevisions(
  contentType: ContentRevisionType,
  contentId: string,
) {
  return getDb()
    .select()
    .from(contentRevisions)
    .where(
      and(
        eq(contentRevisions.contentType, contentType),
        eq(contentRevisions.contentId, contentId),
      ),
    )
    .orderBy(
      desc(contentRevisions.isLatest),
      desc(contentRevisions.createdAt),
    );
}

export async function createContentRevisionDraft(input: {
  contentType: string;
  contentId: string;
  contentDate: string;
  version: string;
  changeSummary: string;
  snapshotJson?: string;
  userId: string;
}) {
  assertContentType(input.contentType);
  const target = await getRevisionTarget(input.contentType, input.contentId);
  if (!target) {
    throw new AppError(
      "버전 관리 대상을 찾을 수 없습니다.",
      404,
      "REVISION_TARGET_NOT_FOUND",
    );
  }
  let requested = target.snapshot;
  try {
    requested = input.snapshotJson
      ? parseRevisionSnapshot(input.snapshotJson)
      : target.snapshot;
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : "스냅샷을 확인해 주세요.",
      400,
      "REVISION_SNAPSHOT_INVALID",
    );
  }
  let snapshot;
  try {
    snapshot = mergeAllowedSnapshot(
      target.snapshot,
      requested,
      target.allowedFields,
    );
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : "스냅샷을 확인해 주세요.",
      400,
      "REVISION_SNAPSHOT_INVALID",
    );
  }
  const previous = await getLatestPublishedRevision(
    input.contentType,
    input.contentId,
  );
  const id = crypto.randomUUID();
  await getDb().insert(contentRevisions).values({
    id,
    contentType: input.contentType,
    contentId: input.contentId,
    courseId: target.courseId,
    title: target.title,
    contentDate: input.contentDate,
    version: input.version,
    revisionStatus: "draft",
    snapshotJson: JSON.stringify(snapshot),
    changeSummary: input.changeSummary,
    previousVersionId: previous?.id ?? null,
    createdBy: input.userId,
  });
  return id;
}

function applySnapshot(
  contentType: ContentRevisionType,
  contentId: string,
  snapshot: Record<string, unknown>,
  revision: { version: string; contentDate: string },
) {
  const updatedAt = nowIso();
  switch (contentType) {
    case "LEGAL_ARTICLE":
      return getDb()
        .update(legalArticles)
        .set({
          ...(snapshot as Partial<typeof legalArticles.$inferInsert>),
          version: revision.version,
          effectiveDate: revision.contentDate,
          updatedAt,
        })
        .where(eq(legalArticles.id, contentId));
    case "ISMS_STANDARD":
      return getDb()
        .update(ismsStandards)
        .set({
          ...(snapshot as Partial<typeof ismsStandards.$inferInsert>),
          version: revision.version,
          effectiveDate: revision.contentDate,
          updatedAt,
        })
        .where(eq(ismsStandards.id, contentId));
    case "PRIVACY_IMPACT_ITEM":
      return getDb()
        .update(privacyImpactAssessmentItems)
        .set({
          ...(snapshot as Partial<typeof privacyImpactAssessmentItems.$inferInsert>),
          version: revision.version,
          effectiveDate: revision.contentDate,
          updatedAt,
        })
        .where(eq(privacyImpactAssessmentItems.id, contentId));
    case "SUBJECT":
      return getDb()
        .update(subjects)
        .set({
          ...(snapshot as Partial<typeof subjects.$inferInsert>),
          updatedAt,
        })
        .where(eq(subjects.id, contentId));
    case "SECURE_CODING_WEAKNESS":
      return getDb()
        .update(secureCodingWeaknesses)
        .set({
          ...(snapshot as Partial<typeof secureCodingWeaknesses.$inferInsert>),
          version: revision.version,
          updatedAt,
        })
        .where(eq(secureCodingWeaknesses.id, contentId));
    case "LEARNING_UNIT":
      return getDb()
        .update(learningUnits)
        .set({
          ...(snapshot as Partial<typeof learningUnits.$inferInsert>),
          updatedAt,
        })
        .where(eq(learningUnits.id, contentId));
    case "LESSON":
      return getDb()
        .update(lessons)
        .set({
          ...(snapshot as Partial<typeof lessons.$inferInsert>),
          version: Number.parseInt(revision.version, 10) || 1,
          updatedAt,
        })
        .where(eq(lessons.id, contentId));
    case "QUESTION_EXPLANATION":
      return getDb()
        .update(questions)
        .set({
          ...(snapshot as Partial<typeof questions.$inferInsert>),
          sourceDate: revision.contentDate,
          updatedAt,
        })
        .where(eq(questions.id, contentId));
    case "AUDIO_CONTENT":
      return getDb()
        .update(audioContents)
        .set({
          ...(snapshot as Partial<typeof audioContents.$inferInsert>),
          updatedAt,
        })
        .where(eq(audioContents.id, contentId));
    case "LECTURE":
      return getDb()
        .update(lectures)
        .set({
          ...(snapshot as Partial<typeof lectures.$inferInsert>),
          updatedAt,
        })
        .where(eq(lectures.id, contentId));
  }
}

export async function publishContentRevision(
  revisionId: string,
  reviewerId: string,
) {
  const [revision] = await getDb()
    .select()
    .from(contentRevisions)
    .where(eq(contentRevisions.id, revisionId))
    .limit(1);
  if (!revision || !["draft", "review"].includes(revision.revisionStatus)) {
    throw new AppError(
      "게시 가능한 버전 초안을 찾을 수 없습니다.",
      409,
      "REVISION_NOT_PUBLISHABLE",
    );
  }
  assertContentType(revision.contentType);
  const snapshot = parseRevisionSnapshot(revision.snapshotJson);
  const existing = await getLatestPublishedRevision(
    revision.contentType,
    revision.contentId,
  );
  const now = nowIso();
  const operations: BatchItem<"sqlite">[] = [];
  if (existing && existing.id !== revision.id) {
    operations.push(
      getDb()
        .update(contentRevisions)
        .set({
          revisionStatus: "superseded",
          isLatest: false,
          supersededAt: now,
          updatedAt: now,
        })
        .where(eq(contentRevisions.id, existing.id)),
    );
  }
  operations.push(
    applySnapshot(revision.contentType, revision.contentId, snapshot, revision),
    getDb()
      .update(contentRevisions)
      .set({
        revisionStatus: "published",
        reviewedAt: now,
        reviewedBy: reviewerId,
        publishedAt: now,
        supersededAt: null,
        isLatest: true,
        previousVersionId: existing?.id ?? revision.previousVersionId,
        updatedAt: now,
      })
      .where(eq(contentRevisions.id, revision.id)),
  );
  await getDb().batch(batchItems(operations));
  return revision.id;
}

export async function archiveContentRevision(revisionId: string) {
  const [revision] = await getDb()
    .select()
    .from(contentRevisions)
    .where(eq(contentRevisions.id, revisionId))
    .limit(1);
  if (!revision || revision.isLatest) {
    throw new AppError(
      "최신 게시 버전은 보관할 수 없습니다.",
      409,
      "LATEST_REVISION_ARCHIVE_FORBIDDEN",
    );
  }
  await getDb()
    .update(contentRevisions)
    .set({
      revisionStatus: "archived",
      isLatest: false,
      updatedAt: nowIso(),
    })
    .where(eq(contentRevisions.id, revisionId));
}

export async function getRevisionComparison(revisionId: string) {
  const [revision] = await getDb()
    .select()
    .from(contentRevisions)
    .where(eq(contentRevisions.id, revisionId))
    .limit(1);
  if (!revision) return [];
  let previousJson: string | null = null;
  if (revision.previousVersionId) {
    const [previous] = await getDb()
      .select({ snapshotJson: contentRevisions.snapshotJson })
      .from(contentRevisions)
      .where(eq(contentRevisions.id, revision.previousVersionId))
      .limit(1);
    previousJson = previous?.snapshotJson ?? null;
  }
  return compareRevisionSnapshots(previousJson, revision.snapshotJson);
}

export async function listRevisionTargets(
  contentType: ContentRevisionType,
  limit = 100,
) {
  const tableRows = await (async () => {
    switch (contentType) {
      case "LEGAL_ARTICLE":
        return getDb()
          .select({
            id: legalArticles.id,
            title: sql<string>`${legalArticles.lawName} || ' ' || ${legalArticles.articleNumber} || ' ' || ${legalArticles.articleTitle}`,
          })
          .from(legalArticles)
          .limit(limit);
      case "ISMS_STANDARD":
        return getDb()
          .select({
            id: ismsStandards.id,
            title: sql<string>`${ismsStandards.code} || ' ' || ${ismsStandards.title}`,
          })
          .from(ismsStandards)
          .limit(limit);
      case "PRIVACY_IMPACT_ITEM":
        return getDb()
          .select({
            id: privacyImpactAssessmentItems.id,
            title: sql<string>`${privacyImpactAssessmentItems.code} || ' ' || ${privacyImpactAssessmentItems.title}`,
          })
          .from(privacyImpactAssessmentItems)
          .limit(limit);
      case "SUBJECT":
        return getDb()
          .select({ id: subjects.id, title: subjects.name })
          .from(subjects)
          .limit(limit);
      case "SECURE_CODING_WEAKNESS":
        return getDb()
          .select({
            id: secureCodingWeaknesses.id,
            title: sql<string>`${secureCodingWeaknesses.code} || ' ' || ${secureCodingWeaknesses.name}`,
          })
          .from(secureCodingWeaknesses)
          .limit(limit);
      case "LEARNING_UNIT":
        return getDb()
          .select({ id: learningUnits.id, title: learningUnits.title })
          .from(learningUnits)
          .limit(limit);
      case "LESSON":
        return getDb()
          .select({ id: lessons.id, title: lessons.title })
          .from(lessons)
          .limit(limit);
      case "QUESTION_EXPLANATION":
        return getDb()
          .select({ id: questions.id, title: questions.title })
          .from(questions)
          .limit(limit);
      case "AUDIO_CONTENT":
        return getDb()
          .select({ id: audioContents.id, title: audioContents.title })
          .from(audioContents)
          .limit(limit);
      case "LECTURE":
        return getDb()
          .select({ id: lectures.id, title: lectures.title })
          .from(lectures)
          .limit(limit);
    }
  })();
  return tableRows;
}

export async function getRevisionImpact(
  contentType: ContentRevisionType,
  contentId: string,
) {
  const target = await getRevisionTarget(contentType, contentId);
  if (!target) return { questions: [], explanations: [], lectures: [], audio: [] };
  const linkedCourses = target.courseId
    ? [target.courseId]
    : (
        await getDb()
          .select({ courseId: contentCourseLinks.courseId })
          .from(contentCourseLinks)
          .where(
            and(
              eq(contentCourseLinks.contentType, contentType),
              eq(contentCourseLinks.contentId, contentId),
            ),
          )
      ).map((row) => row.courseId);
  if (!linkedCourses.length) {
    return { questions: [], explanations: [], lectures: [], audio: [] };
  }
  const [questionRows, lectureRows, audioRows] = await Promise.all([
    getDb()
      .selectDistinct({ id: questions.id, title: questions.title })
      .from(questions)
      .innerJoin(questionCourses, eq(questionCourses.questionId, questions.id))
      .where(inArray(questionCourses.courseId, linkedCourses))
      .limit(50),
    getDb()
      .select({ id: lectures.id, title: lectures.title })
      .from(lectures)
      .where(inArray(lectures.courseId, linkedCourses))
      .limit(50),
    getDb()
      .selectDistinct({ id: audioContents.id, title: audioContents.title })
      .from(audioContents)
      .innerJoin(lessons, eq(audioContents.lessonId, lessons.id))
      .where(inArray(lessons.courseId, linkedCourses))
      .limit(50),
  ]);
  return {
    questions: questionRows,
    explanations: questionRows,
    lectures: lectureRows,
    audio: audioRows,
  };
}

export async function getRevisionAdminDetail(
  contentType: ContentRevisionType,
  contentId: string,
) {
  const [target, revisions, impact] = await Promise.all([
    getRevisionTarget(contentType, contentId),
    listContentRevisions(contentType, contentId),
    getRevisionImpact(contentType, contentId),
  ]);
  const comparisons = revisions.length
    ? await getRevisionComparison(revisions[0].id)
    : [];
  return {
    target,
    revisions,
    impact,
    comparisons,
    label: CONTENT_REVISION_TYPE_LABELS[contentType],
  };
}
