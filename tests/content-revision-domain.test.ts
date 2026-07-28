import assert from "node:assert/strict";
import test from "node:test";
import {
  compareRevisionSnapshots,
  isCurrentRevision,
  mergeAllowedSnapshot,
  parseRevisionSnapshot,
} from "../lib/services/content-revision-service.ts";

test("버전 스냅샷은 허용된 필드만 병합한다", () => {
  const merged = mergeAllowedSnapshot(
    { title: "기존", content: "본문", id: "immutable" },
    { title: "개정", id: "changed", injected: "<script>" },
    ["title", "content"],
  );
  assert.deepEqual(merged, { title: "개정", content: "본문" });
});

test("버전 비교는 실제로 변경된 필드만 반환한다", () => {
  const changes = compareRevisionSnapshots(
    JSON.stringify({ title: "기존", content: "같음" }),
    JSON.stringify({ title: "개정", content: "같음" }),
  );
  assert.deepEqual(changes.map((change) => change.field), ["title"]);
});

test("최신 표시는 게시 상태와 최신 플래그를 모두 요구한다", () => {
  assert.equal(
    isCurrentRevision({ revisionStatus: "published", isLatest: true }),
    true,
  );
  assert.equal(
    isCurrentRevision({ revisionStatus: "draft", isLatest: true }),
    false,
  );
  assert.equal(
    isCurrentRevision({ revisionStatus: "superseded", isLatest: false }),
    false,
  );
});

test("배열이나 과도하게 큰 버전 스냅샷을 거부한다", () => {
  assert.throws(() => parseRevisionSnapshot("[]"), /JSON 객체/);
  assert.throws(
    () => parseRevisionSnapshot(JSON.stringify({ content: "가".repeat(40000) })),
    /100KB/,
  );
});

