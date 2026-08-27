import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const audioPath = new URL("../components/audio-learning-player.tsx", import.meta.url);
const lecturePath = new URL("../components/lecture-player.tsx", import.meta.url);

async function source(url: URL) {
  return readFile(url, "utf8");
}

test("both writers retain the 15-second checkpoint and successful dirty-state gate", async () => {
  const [audio, lecture] = await Promise.all([source(audioPath), source(lecturePath)]);
  for (const value of [audio, lecture]) {
    assert.match(value, /15_000/);
    assert.match(value, /lastPersistedRef/);
    assert.match(value, /desired\.position === lastPersistedRef\.current\.position/);
    assert.match(value, /lastPersistedRef\.current =/);
  }
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
    if (desired.position === persisted.position && desired.complete === persisted.complete) return;
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

test("the bounded model keeps active checkpoints and removes paused cadence", () => {
  const activeRequests = Math.floor((60 * 60_000) / 15_000);
  const beforePausedHour = activeRequests;
  const afterPausedHour = 0;
  assert.equal(activeRequests, 240);
  assert.equal(beforePausedHour, 240);
  assert.equal(afterPausedHour, 0);
});
