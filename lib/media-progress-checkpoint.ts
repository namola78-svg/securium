export const MEDIA_PROGRESS_CHECKPOINT_INTERVAL_MS = 30_000;
export const MEDIA_PROGRESS_MIN_RETRY_DELAY_MS = 1_000;

export type MediaProgressState = Readonly<{
  position: number;
  complete: boolean;
}>;

export type PersistedMediaProgressState = MediaProgressState &
  Readonly<{
    contentRevisionId: string | null;
  }>;

export function isSameMediaProgressState(
  left: MediaProgressState,
  right: MediaProgressState,
) {
  return left.position === right.position && left.complete === right.complete;
}

export function isSamePersistedMediaProgressState(
  left: PersistedMediaProgressState,
  right: PersistedMediaProgressState,
) {
  return (
    isSameMediaProgressState(left, right) &&
    left.contentRevisionId === right.contentRevisionId
  );
}

export function activeCheckpointCount(
  durationMs: number,
  intervalMs = MEDIA_PROGRESS_CHECKPOINT_INTERVAL_MS,
) {
  if (durationMs <= 0 || intervalMs <= 0) return 0;
  return Math.floor(durationMs / intervalMs);
}

export function retryDelayAfterFailure(elapsedMs: number) {
  return Math.max(
    MEDIA_PROGRESS_MIN_RETRY_DELAY_MS,
    MEDIA_PROGRESS_CHECKPOINT_INTERVAL_MS - Math.max(0, elapsedMs),
  );
}
