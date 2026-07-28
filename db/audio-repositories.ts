import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from ".";
import {
  audioContents,
  audioProgress,
  courses,
  learningUnits,
  lessons,
  userCourseEnrollments,
} from "./schema";
import { AppError } from "@/lib/errors";
import {
  assertAudioCompletionPosition,
  configuredAudioHosts,
  normalizeAudioPosition,
  parseSpeedOptions,
  parseTranscriptSegments,
  validateAudioUrl,
} from "@/lib/services/audio-service";

async function requireAccessibleAudio(
  userId: string,
  audioContentId: string,
) {
  const [audio] = await getDb()
    .select({
      id: audioContents.id,
      lessonId: audioContents.lessonId,
      durationSeconds: audioContents.durationSeconds,
      enrollmentStatus: userCourseEnrollments.status,
    })
    .from(audioContents)
    .innerJoin(lessons, eq(audioContents.lessonId, lessons.id))
    .innerJoin(learningUnits, eq(lessons.learningUnitId, learningUnits.id))
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .innerJoin(
      userCourseEnrollments,
      and(
        eq(userCourseEnrollments.userId, userId),
        eq(userCourseEnrollments.courseId, lessons.courseId),
      ),
    )
    .where(
      and(
        eq(audioContents.id, audioContentId),
        eq(audioContents.published, true),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
        eq(courses.active, true),
        eq(courses.published, true),
        isNull(courses.deletedAt),
      ),
    )
    .limit(1);
  if (!audio) {
    throw new AppError(
      "수강 가능한 오디오를 찾을 수 없습니다.",
      404,
      "AUDIO_CONTENT_NOT_FOUND",
    );
  }
  if (audio.enrollmentStatus === "CANCELLED") {
    throw new AppError(
      "취소된 과정의 오디오에는 접근할 수 없습니다.",
      403,
      "AUDIO_ENROLLMENT_INACTIVE",
    );
  }
  return audio;
}

export async function listPublishedAudioForLesson(
  userId: string,
  courseId: string,
  lessonId: string,
) {
  const rows = await getDb()
    .select({
      id: audioContents.id,
      title: audioContents.title,
      audioUrl: audioContents.audioUrl,
      transcript: audioContents.transcript,
      transcriptSegmentsJson: audioContents.transcriptSegmentsJson,
      durationSeconds: audioContents.durationSeconds,
      voiceProvider: audioContents.voiceProvider,
      voiceName: audioContents.voiceName,
      speedOptionsJson: audioContents.speedOptionsJson,
      enrollmentStatus: userCourseEnrollments.status,
      currentPositionSeconds:
        sql<number>`coalesce(${audioProgress.currentPositionSeconds}, 0)`,
      completed: sql<boolean>`coalesce(${audioProgress.completed}, 0)`,
      completedAt: audioProgress.completedAt,
      lastPlayedAt: audioProgress.lastPlayedAt,
    })
    .from(audioContents)
    .innerJoin(lessons, eq(audioContents.lessonId, lessons.id))
    .innerJoin(learningUnits, eq(lessons.learningUnitId, learningUnits.id))
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .innerJoin(
      userCourseEnrollments,
      and(
        eq(userCourseEnrollments.userId, userId),
        eq(userCourseEnrollments.courseId, lessons.courseId),
      ),
    )
    .leftJoin(
      audioProgress,
      and(
        eq(audioProgress.audioContentId, audioContents.id),
        eq(audioProgress.userId, userId),
      ),
    )
    .where(
      and(
        eq(audioContents.lessonId, lessonId),
        eq(audioContents.published, true),
        eq(lessons.courseId, courseId),
        eq(lessons.active, true),
        eq(lessons.published, true),
        isNull(lessons.deletedAt),
        eq(learningUnits.active, true),
        eq(learningUnits.published, true),
        isNull(learningUnits.deletedAt),
        eq(courses.active, true),
        eq(courses.published, true),
        isNull(courses.deletedAt),
      ),
    )
    .orderBy(asc(audioContents.createdAt));

  return rows
    .filter((row) => row.enrollmentStatus !== "CANCELLED")
    .map((row) => ({
      ...row,
      audioUrl: validateAudioUrl(
        row.audioUrl,
        configuredAudioHosts(),
      ),
      transcriptSegments: parseTranscriptSegments(
        row.transcriptSegmentsJson,
        row.durationSeconds,
      ),
      speedOptions: parseSpeedOptions(row.speedOptionsJson),
    }));
}

export async function getAudioProgressForUser(
  userId: string,
  audioContentId: string,
) {
  const audio = await requireAccessibleAudio(userId, audioContentId);
  const [progress] = await getDb()
    .select()
    .from(audioProgress)
    .where(
      and(
        eq(audioProgress.userId, userId),
        eq(audioProgress.audioContentId, audioContentId),
      ),
    )
    .limit(1);
  return {
    audioContentId,
    durationSeconds: audio.durationSeconds,
    currentPositionSeconds: progress?.currentPositionSeconds ?? 0,
    completed: progress?.completed ?? false,
    completedAt: progress?.completedAt ?? null,
    lastPlayedAt: progress?.lastPlayedAt ?? null,
  };
}

export async function updateAudioProgress(input: {
  userId: string;
  audioContentId: string;
  currentPositionSeconds: number;
  complete: boolean;
}) {
  const audio = await requireAccessibleAudio(
    input.userId,
    input.audioContentId,
  );
  const position = normalizeAudioPosition(
    input.currentPositionSeconds,
    audio.durationSeconds,
  );
  if (input.complete) {
    assertAudioCompletionPosition(position, audio.durationSeconds);
  }
  const [current] = await getDb()
    .select()
    .from(audioProgress)
    .where(
      and(
        eq(audioProgress.userId, input.userId),
        eq(audioProgress.audioContentId, input.audioContentId),
      ),
    )
    .limit(1);
  const now = new Date().toISOString();
  const completed = Boolean(current?.completed || input.complete);
  const completedAt = current?.completedAt ?? (completed ? now : null);
  await getDb()
    .insert(audioProgress)
    .values({
      id: current?.id ?? crypto.randomUUID(),
      userId: input.userId,
      audioContentId: input.audioContentId,
      currentPositionSeconds: position,
      completed,
      completedAt,
      lastPlayedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [audioProgress.userId, audioProgress.audioContentId],
      set: {
        currentPositionSeconds: position,
        completed,
        completedAt,
        lastPlayedAt: now,
        updatedAt: now,
      },
    });
  return {
    audioContentId: input.audioContentId,
    currentPositionSeconds: position,
    completed,
    completedAt,
    idempotentReplay: Boolean(current?.completed && input.complete),
  };
}
