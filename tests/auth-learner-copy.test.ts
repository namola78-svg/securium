import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authFacingFiles = [
  "app/login/page.tsx",
  "app/signup/page.tsx",
  "components/login-panel.tsx",
  "components/command-palette.tsx",
];

test("auth and command palette copy avoids exposing implementation details to learners", () => {
  const signupPage = readFileSync(authFacingFiles[1], "utf8");
  const loginPanel = readFileSync(authFacingFiles[2], "utf8");
  const commandPalette = readFileSync(authFacingFiles[3], "utf8");
  const combined = [signupPage, loginPanel, commandPalette].join("\n");

  for (const expected of [
    "무료 계정을 만들고 학습을 시작하세요",
    "SECURIUM 계정을 준비합니다",
    "비밀번호 재설정 이메일 발송은 준비되는 대로 제공됩니다",
    "공식 출제기준 트리와 학습 콘텐츠 연결 상태를 점검합니다",
  ]) {
    assert.match(combined, new RegExp(expected));
  }

  assert.doesNotMatch(signupPage, /Supabase Auth|AUTH_PROVIDER|권한 구조|USER 권한/);
  assert.doesNotMatch(loginPanel, /Supabase 메일 설정/);
  assert.doesNotMatch(commandPalette, /CourseLesson 커버리지/);
  assert.doesNotMatch(combined, /�/);
});

test("Sites auth screen exposes the ChatGPT sign-in action", () => {
  const loginPage = readFileSync(authFacingFiles[0], "utf8");
  const signupPage = readFileSync(authFacingFiles[1], "utf8");

  assert.match(loginPage, /Sign in with ChatGPT/);
  assert.match(signupPage, /Sign in with ChatGPT/);
  assert.match(loginPage, /chatGPTSignInPath\(returnTo\)/);
  assert.match(signupPage, /chatGPTSignInPath\(returnTo\)/);
});
