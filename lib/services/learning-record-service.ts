export type WrongNoteState = {
  wrongCount: number;
  mastered: boolean;
  lastAttemptId: string;
};

export function nextWrongNoteState(
  current: WrongNoteState | null,
  attemptId: string,
): WrongNoteState {
  return {
    wrongCount: (current?.wrongCount ?? 0) + 1,
    mastered: false,
    lastAttemptId: attemptId,
  };
}

export function bookmarkIdentity(input: {
  userId: string;
  targetType: string;
  targetId: string;
  courseId: string;
}) {
  return [
    input.userId,
    input.targetType,
    input.targetId,
    input.courseId,
  ].join(":");
}

export function progressScope(input: {
  userId: string;
  courseId: string;
  subjectId: string;
  topicId: string;
}) {
  return [
    input.userId,
    input.courseId,
    input.subjectId,
    input.topicId,
  ].join(":");
}
