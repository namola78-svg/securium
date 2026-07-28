import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLectureCompletionPosition,
  createSafeVideoEmbed,
  validateLecturePosition,
} from "../lib/services/video-provider-service.ts";

test("허용된 영상 공급자를 안전한 embed URL로 변환한다", () => {
  const youtube = createSafeVideoEmbed(
    "YOUTUBE",
    "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    42,
  );
  assert.equal(youtube.provider, "YOUTUBE");
  assert.match(
    youtube.embedUrl,
    /^https:\/\/www\.youtube-nocookie\.com\/embed\//,
  );
  assert.match(youtube.embedUrl, /start=42/);
  assert.equal(
    youtube.iframeSandbox,
    "allow-scripts allow-same-origin allow-presentation",
  );

  const vimeo = createSafeVideoEmbed(
    "VIMEO",
    "https://vimeo.com/76979871",
  );
  assert.match(
    vimeo.embedUrl,
    /^https:\/\/player\.vimeo\.com\/video\/76979871/,
  );
});

test("허용되지 않은 공급자·도메인·URL scheme을 차단한다", () => {
  assert.throws(() =>
    createSafeVideoEmbed("UNKNOWN", "https://example.com/video"),
  );
  assert.throws(() =>
    createSafeVideoEmbed(
      "YOUTUBE",
      "https://untrusted.example/watch?v=M7lc1UVf-VE",
    ),
  );
  assert.throws(() =>
    createSafeVideoEmbed("YOUTUBE", "javascript:alert(1)"),
  );
});

test("강의 재생 위치와 완료 조건을 서버 규칙으로 검증한다", () => {
  assert.equal(validateLecturePosition(120, 600), 120);
  assert.throws(() => validateLecturePosition(601, 600));
  assert.doesNotThrow(() => assertLectureCompletionPosition(590, 600));
  assert.throws(() => assertLectureCompletionPosition(300, 600));
});
