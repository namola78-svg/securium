import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  activeCheckpointCount,
  isSameMediaProgressState,
  isSamePersistedMediaProgressState,
  MEDIA_PROGRESS_CHECKPOINT_INTERVAL_MS,
  retryDelayAfterFailure,
} from "../lib/media-progress-checkpoint.ts";
import { lectureProgressSchema } from "../lib/validation.ts";

const audioPath = new URL("../components/audio-learning-player.tsx", import.meta.url);
const lecturePath = new URL("../components/lecture-player.tsx", import.meta.url);
const lecturePagePath = new URL("../app/lectures/[courseSlug]/[lectureId]/page.tsx", import.meta.url);
const audioRepositoryPath = new URL("../db/audio-repositories.ts", import.meta.url);
const lectureRepositoryPath = new URL("../db/lecture-repositories.ts", import.meta.url);

async function source(url: URL) {
  return readFile(url, "utf8");
}

test("both writers share the bounded 30-second checkpoint and acknowledged-state gate", async () => {
  const [audio, lecture] = await Promise.all([source(audioPath), source(lecturePath)]);
  for (const value of [audio, lecture]) {
    assert.match(value, /MEDIA_PROGRESS_CHECKPOINT_INTERVAL_MS/);
    assert.match(value, /lastPersistedRef/);
    assert.match(value, /isSameMediaProgressState/);
    assert.match(value, /lastPersistedRef\.current =/);
  }
  assert.equal(MEDIA_PROGRESS_CHECKPOINT_INTERVAL_MS, 30_000);
});

test("audio lifecycle stops recurring scheduling while paused and checkpoints end", async () => {
  const value = await source(audioPath);
  assert.match(value, /isPlayingRef\.current = false/);
  assert.match(value, /onPause=\{\(\) => \{/);
  assert.match(value, /onEnded=\{\(\) => \{/);
  assert.match(value, /queueSave\(item\.durationSeconds, true, true\)/);
  assert.match(value, /clearInterval\(speechTimerRef\.current\)/);
});

test("lecture lifecycle interprets provider play, pause, and ended state", async () => {
  const value = await source(lecturePath);
  assert.match(value, /playerState === 1/);
  assert.match(value, /playerState === 2/);
  assert.match(value, /message\.event === \"pause\"/);
  assert.match(value, /queueProgress\(durationSeconds, true, true\)/);
  assert.match(value, /removeEventListener\("message", receiveMessage\)/);
});

test("failed saves do not update successful-persistence bookkeeping", async () => {
  const [audio, lecture] = await Promise.all([source(audioPath), source(lecturePath)]);
  for (const value of [audio, lecture]) {
    const failureIndex = value.indexOf("if (!response.ok)");
    const bookkeepingIndex = value.indexOf("lastPersistedRef.current =");
    assert.ok(failureIndex >= 0);
    assert.ok(bookkeepingIndex > failureIndex);
  }
});

test("a deterministic checkpoint model suppresses unchanged successful state", () => {
  let persisted = { position: 20, complete: false };
  const requests: Array<{ position: number; complete: boolean }> = [];
  const checkpoint = (position: number, complete: boolean, success: boolean) => {
    const desired = { position, complete: persisted.complete || complete };
    if (isSameMediaProgressState(desired, persisted)) return;
    requests.push(desired);
    if (success) persisted = desired;
  };

  checkpoint(20, false, true);
  checkpoint(25, false, true);
  checkpoint(25, false, true);
  checkpoint(30, false, false);
  checkpoint(30, false, true);
  checkpoint(30, true, true);

  assert.deepEqual(requests, [
    { position: 25, complete: false },
    { position: 30, complete: false },
    { position: 30, complete: false },
    { position: 30, complete: true },
  ]);
});

test("forced lifecycle boundaries flush changed state but still suppress equal state", () => {
  const persisted = { position: 30, complete: false };
  assert.equal(isSameMediaProgressState(persisted, { position: 30, complete: false }), true);
  assert.equal(isSameMediaProgressState(persisted, { position: 31, complete: false }), false);
  assert.equal(isSameMediaProgressState(persisted, { position: 30, complete: true }), false);
});

test("failed requests retain only the latest state and retry no faster than the bounded window", () => {
  assert.equal(retryDelayAfterFailure(0), 30_000);
  assert.equal(retryDelayAfterFailure(29_500), 1_000);
  assert.equal(retryDelayAfterFailure(60_000), 1_000);
});

test("the bounded model halves active checkpoint requests and removes paused cadence", () => {
  const beforeActiveRequests = Math.floor((60 * 60_000) / 15_000);
  const afterActiveRequests = activeCheckpointCount(60 * 60_000);
  const beforePausedHour = beforeActiveRequests;
  const afterPausedHour = 0;
  assert.equal(beforeActiveRequests, 240);
  assert.equal(afterActiveRequests, 120);
  assert.equal(beforePausedHour, 240);
  assert.equal(afterPausedHour, 0);
});

test("deterministic request-count bounds cover the required playback models", () => {
  const beforeTenMinutes = Math.floor((10 * 60_000) / 15_000);
  const afterTenMinutes = activeCheckpointCount(10 * 60_000);
  assert.deepEqual(
    { beforeTenMinutes, afterTenMinutes },
    { beforeTenMinutes: 40, afterTenMinutes: 20 },
  );
  assert.equal(100 * 240 * 24, 576_000);
  assert.equal(100 * 120 * 24, 288_000);
  assert.equal(100 * 2 * 240 * 24, 1_152_000);
  assert.equal(100 * 2 * 120 * 24, 576_000);
});

test("persisted semantic equality includes explicit content revision identity", () => {
  const revisionA = { position: 30, complete: false, contentRevisionId: "revision-a" };
  const revisionB = { position: 30, complete: false, contentRevisionId: "revision-b" };
  assert.equal(isSamePersistedMediaProgressState(revisionA, revisionA), true);
  assert.equal(isSamePersistedMediaProgressState(revisionA, revisionB), false);
  assert.equal(
    isSamePersistedMediaProgressState(
      { ...revisionA, contentRevisionId: null },
      { ...revisionA, contentRevisionId: "revision-a" },
    ),
    false,
  );
  assert.equal(
    isSamePersistedMediaProgressState(
      { ...revisionA, contentRevisionId: "revision-a" },
      { ...revisionA, contentRevisionId: null },
    ),
    false,
  );
  assert.equal(
    isSamePersistedMediaProgressState(
      { ...revisionA, contentRevisionId: null },
      { ...revisionA, contentRevisionId: null },
    ),
    true,
  );
});

test("both server writers resolve the canonical revision before deciding no-op", async () => {
  const [audio, lecture] = await Promise.all([
    source(audioRepositoryPath),
    source(lectureRepositoryPath),
  ]);
  for (const value of [audio, lecture]) {
    const revisionIndex = value.indexOf("const latestRevision");
    const noOpIndex = value.indexOf("isSamePersistedMediaProgressState(\n");
    assert.ok(revisionIndex >= 0);
    assert.ok(noOpIndex > revisionIndex);
    assert.match(value, /contentRevisionId/);
  }
});

test("lecture identity key separates learner, lecture, and latest revision without rerender churn", async () => {
  const page = await source(lecturePagePath);
  assert.match(page, /key=\{`\$\{user\?\.id \?\? "anonymous"\}:\$\{lecture\.id\}:\$\{revision\?\.id \?\? "none"\}`\}/);
  assert.match(page, /contentRevisionId=\{revision\?\.id \?\? null\}/);
  assert.match(page, /persistedContentRevisionId=\{lecture\.progressContentRevisionId \?\? null\}/);
  const identity = (learner: string, lectureId: string, revision: string | null) =>
    `${learner}:${lectureId}:${revision ?? "none"}`;
  assert.equal(identity("learner-a", "lecture-a", "revision-a"), identity("learner-a", "lecture-a", "revision-a"));
  assert.notEqual(identity("learner-a", "lecture-a", "revision-a"), identity("learner-a", "lecture-b", "revision-a"));
  assert.notEqual(identity("learner-a", "lecture-a", "revision-a"), identity("learner-a", "lecture-a", "revision-b"));
  assert.notEqual(identity("learner-a", "lecture-a", "revision-a"), identity("learner-b", "lecture-a", "revision-a"));
});

test("lecture writer makes revision sync meaningful even when numeric progress is unchanged", async () => {
  const value = await source(lecturePath);
  assert.match(value, /persistedContentRevisionId !== contentRevisionId/);
  assert.match(value, /revisionSyncRef/);
  assert.match(value, /!revisionSyncRef\.current && isSameMediaProgressState/);
  assert.match(value, /revisionSyncRef\.current = false/);
});

test("lecture writer does not drain queued state or mutate new UI after unmount", async () => {
  const value = await source(lecturePath);
  assert.match(value, /if \(!mountedRef\.current\) return;/);
  assert.match(value, /if \(mountedRef\.current\) setCompleted/);
  assert.match(value, /mountedRef\.current = false/);
});

test("caller-supplied or malformed revision hints are not accepted as canonical input", () => {
  const parsed = lectureProgressSchema.parse({
    lectureId: "lecture-1",
    currentPositionSeconds: 20,
    complete: false,
    contentRevisionId: "caller-controlled-revision",
  });
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "contentRevisionId"), false);
  const malformed = lectureProgressSchema.parse({
    lectureId: "lecture-1",
    currentPositionSeconds: 20,
    complete: false,
    contentRevisionId: 42,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(malformed, "contentRevisionId"), false);
});
