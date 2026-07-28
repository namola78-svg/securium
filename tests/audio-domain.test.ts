import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAudioCompletionPosition,
  normalizeAudioPosition,
  parseSpeedOptions,
  parseTranscriptSegments,
  supportsSpeechSynthesis,
  validateAudioUrl,
} from "../lib/services/audio-service.ts";

test("오디오 재생 위치는 길이 범위 안에서만 저장한다", () => {
  assert.equal(normalizeAudioPosition(42, 90), 42);
  assert.throws(
    () => normalizeAudioPosition(91, 90),
    /재생 위치가 오디오 길이 범위를 벗어났습니다/,
  );
});

test("오디오 완료는 끝부분에 도달한 경우만 허용한다", () => {
  assert.doesNotThrow(() => assertAudioCompletionPosition(85, 90));
  assert.throws(
    () => assertAudioCompletionPosition(40, 90),
    /오디오를 끝까지 학습한 뒤 완료할 수 있습니다/,
  );
});

test("오디오 URL은 동일 출처 상대경로 또는 허용 HTTPS 호스트만 사용한다", () => {
  assert.equal(validateAudioUrl("/audio/sample.mp3", []), "/audio/sample.mp3");
  assert.equal(
    validateAudioUrl(
      "https://media.example.com/sample.mp3",
      ["media.example.com"],
    ),
    "https://media.example.com/sample.mp3",
  );
  assert.throws(() => validateAudioUrl("javascript:alert(1)", []));
  assert.throws(() => validateAudioUrl("data:audio/mp3;base64,AAAA", []));
  assert.throws(() =>
    validateAudioUrl("https://untrusted.example/sample.mp3", [
      "media.example.com",
    ]),
  );
});

test("스크립트 세그먼트와 배속 옵션은 안전한 범위로 정규화한다", () => {
  assert.deepEqual(
    parseTranscriptSegments(
      JSON.stringify([
        { startSeconds: 0, endSeconds: 20, text: "첫 문장" },
        { startSeconds: 20, endSeconds: 100, text: "범위 초과" },
      ]),
      90,
    ),
    [{ startSeconds: 0, endSeconds: 20, text: "첫 문장" }],
  );
  assert.deepEqual(parseSpeedOptions("[0.75,1,1.5,4]"), [0.75, 1, 1.5]);
});

test("Speech Synthesis 미지원 환경을 안전하게 판별한다", () => {
  assert.equal(supportsSpeechSynthesis(undefined), false);
  assert.equal(supportsSpeechSynthesis({}), false);
  assert.equal(
    supportsSpeechSynthesis({
      speechSynthesis: {},
      SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {},
    }),
    true,
  );
});
