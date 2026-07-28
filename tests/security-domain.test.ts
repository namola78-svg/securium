import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../lib/errors.ts";
import {
  isProductionEnvironment,
  validateRuntimeEnvironment,
} from "../lib/environment.ts";
import {
  MemoryRateLimitProvider,
  type RateLimitProvider,
} from "../lib/rate-limit.ts";
import {
  createSecurityHeaders,
  parseAllowedHttpsOrigins,
} from "../lib/security-headers.ts";
import { validateUpload } from "../lib/services/file-upload-security.ts";
import {
  assertFirstSuperAdminCanBeCreated,
  assertSuperAdminRoleChangeAllowed,
  validateAdminBootstrapIdentity,
} from "../lib/services/admin-bootstrap-service.ts";

test("Production CSP는 unsafe-eval을 제거하고 핵심 지시자를 포함한다", () => {
  const headers = createSecurityHeaders({
    production: true,
    https: true,
    audioHosts: ["https://media.example.com"],
    imageHosts: ["https://images.example.com"],
  });
  const csp = headers["Content-Security-Policy"];
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /media-src 'self' blob: https:\/\/media\.example\.com/);
  assert.equal(
    headers["Strict-Transport-Security"],
    "max-age=31536000; includeSubDomains",
  );
});

test("Development CSP만 unsafe-eval을 허용하고 HTTP에는 HSTS를 넣지 않는다", () => {
  const headers = createSecurityHeaders({
    production: false,
    https: false,
  });
  assert.match(headers["Content-Security-Policy"], /unsafe-eval/);
  assert.equal(headers["Strict-Transport-Security"], undefined);
});

test("CSP 외부 Origin은 HTTPS 호스트만 허용한다", () => {
  assert.deepEqual(
    parseAllowedHttpsOrigins(
      "media.example.com,https://images.example.com,http://bad.test,https://bad.test/path",
    ),
    ["https://media.example.com", "https://images.example.com"],
  );
});

test("메모리 RateLimitProvider는 한도와 재시도 시간을 계산한다", async () => {
  const provider: RateLimitProvider = new MemoryRateLimitProvider();
  const options = { limit: 2, windowMs: 1_000 };
  assert.equal((await provider.consume("user", options, 100)).allowed, true);
  assert.equal((await provider.consume("user", options, 200)).allowed, true);
  const denied = await provider.consume("user", options, 300);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterMs, 800);
  assert.equal((await provider.consume("user", options, 1_101)).allowed, true);
});

test("업로드 정책은 확장자와 MIME을 함께 검증하고 서버 키를 생성한다", () => {
  const result = validateUpload({
    originalName: "  학습 자료 01.pdf  ",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    kind: "DOCUMENT",
    visibility: "PRIVATE",
  });
  assert.equal(result.originalName, "학습 자료 01.pdf");
  assert.match(
    result.storageKey,
    /^private\/document\/[0-9a-f-]{36}\.pdf$/,
  );
  assert.throws(
    () =>
      validateUpload({
        originalName: "../payload.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 100,
        kind: "IMAGE",
        visibility: "PUBLIC",
      }),
    (error: unknown) =>
      error instanceof AppError &&
      ["UPLOAD_NAME_INVALID", "UPLOAD_ACTIVE_CONTENT_BLOCKED"].includes(
        error.code,
      ),
  );
});

test("Production 환경은 개발 인증과 약한 Secret을 차단한다", () => {
  assert.equal(isProductionEnvironment({ APP_ENV: "production" }), true);
  assert.throws(
    () =>
      validateRuntimeEnvironment(
        {
          APP_ENV: "production",
          DEV_AUTH_EMAIL: "developer@example.invalid",
          AUDIT_IP_HASH_SALT: "a".repeat(40),
        },
        true,
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "SECURITY_CONFIGURATION_INVALID",
  );
  assert.doesNotThrow(() =>
    validateRuntimeEnvironment(
      {
        APP_ENV: "production",
        AUDIT_IP_HASH_SALT: "unique-production-salt-material-12345",
        AI_PROVIDER: "mock",
      },
      true,
    ),
  );
});

test("최초 최고 관리자 bootstrap은 신원과 중복 여부를 검증한다", () => {
  assert.deepEqual(
    validateAdminBootstrapIdentity({
      email: "  First.Admin@Example.com ",
      displayName: " Initial  Administrator ",
    }),
    {
      email: "first.admin@example.com",
      displayName: "Initial Administrator",
    },
  );
  assert.doesNotThrow(() => assertFirstSuperAdminCanBeCreated(0));
  assert.throws(
    () => assertFirstSuperAdminCanBeCreated(1),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "ADMIN_BOOTSTRAP_ALREADY_COMPLETE",
  );
});

test("마지막 활성 최고 관리자는 역할 제거 또는 정지할 수 없다", () => {
  assert.throws(
    () =>
      assertSuperAdminRoleChangeAllowed({
        activeSuperAdminCount: 1,
        targetIsActiveSuperAdmin: true,
        removesSuperAdminRole: true,
        suspendsTarget: false,
      }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "LAST_SUPER_ADMIN_PROTECTED",
  );
  assert.doesNotThrow(() =>
    assertSuperAdminRoleChangeAllowed({
      activeSuperAdminCount: 2,
      targetIsActiveSuperAdmin: true,
      removesSuperAdminRole: false,
      suspendsTarget: true,
    }),
  );
});
