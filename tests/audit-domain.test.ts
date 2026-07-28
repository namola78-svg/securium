import assert from "node:assert/strict";
import test from "node:test";
import {
  auditResultForStatus,
  choosePrimaryActorRole,
  requestAuditContext,
  sanitizeAuditMetadata,
  summarizeUserAgent,
} from "../lib/services/audit-service.ts";

test("감사 metadata는 action별 allowlist만 저장한다", () => {
  const safe = sanitizeAuditMetadata("COURSE_UPDATED", {
    changedFields: ["name", "active"],
    password: "never-store",
    requestBody: "never-store",
    arbitrary: "drop",
  });
  assert.deepEqual(safe, { changedFields: ["name", "active"] });
  assert.doesNotMatch(JSON.stringify(safe), /never-store/);
});

test("최초 관리자 감사로그는 허용된 최소 metadata만 저장한다", () => {
  const safe = sanitizeAuditMetadata("ADMIN_BOOTSTRAPPED", {
    assignedRoles: ["SUPER_ADMIN"],
    bootstrapMethod: "D1_CLI",
    email: "never-store@example.invalid",
    password: "never-store",
  });
  assert.deepEqual(safe, {
    assignedRoles: ["SUPER_ADMIN"],
    bootstrapMethod: "D1_CLI",
  });
  assert.doesNotMatch(JSON.stringify(safe), /never-store/);
});

test("토큰·답안·개인정보 형태의 metadata 키를 차단한다", () => {
  const safe = sanitizeAuditMetadata("DATA_EXPORTED", {
    format: "CSV",
    rowCount: 3,
    apiKey: "secret",
    answerText: "raw-answer",
    personalData: "raw-personal-data",
  });
  assert.deepEqual(safe, { format: "CSV", rowCount: 3 });
});

test("허용된 metadata 필드 안의 민감정보 형태도 마스킹한다", () => {
  const safe = sanitizeAuditMetadata("QUESTION_REJECTED", {
    fromStatus: "IN_REVIEW",
    toStatus: "REJECTED",
    reasonCode: "token=secret-value-that-must-not-be-stored",
  });
  assert.deepEqual(safe, {
    fromStatus: "IN_REVIEW",
    toStatus: "REJECTED",
    reasonCode: "[REDACTED]",
  });
});

test("관리자 역할은 가장 높은 역할 하나로 요약한다", () => {
  assert.equal(
    choosePrimaryActorRole(["USER", "COURSE_MANAGER", "ADMIN"]),
    "ADMIN",
  );
  assert.equal(choosePrimaryActorRole([]), "UNKNOWN");
});

test("IP 원문 대신 hash와 축약 User-Agent만 생성한다", async () => {
  const request = new Request("https://example.invalid/admin", {
    headers: {
      "cf-connecting-ip": "203.0.113.77",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
      "x-request-id": "audit-test-request",
    },
  });
  const context = await requestAuditContext(request);
  assert.match(context.ipHash ?? "", /^sha256:[0-9a-f]{24}$/);
  assert.doesNotMatch(context.ipHash ?? "", /203\.0\.113/);
  assert.equal(context.userAgentSummary, "Chrome/Windows");
  assert.equal(context.requestId, "audit-test-request");
  assert.equal(summarizeUserAgent(null), null);
});

test("권한 거부와 처리 실패 결과를 구분한다", () => {
  assert.equal(auditResultForStatus(403), "DENIED");
  assert.equal(auditResultForStatus(500), "FAILURE");
});
