import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

const loginPage = read("app/login/page.tsx");
const signupPage = read("app/signup/page.tsx");
const loginPanel = read("components/login-panel.tsx");
const signupPanel = read("components/signup-panel.tsx");
const authShell = read("components/v2/auth-v2.tsx");
const authStyles = read("components/v2/auth-v2.module.css");
const globalStyles = read("app/globals.css");

test("login and signup opt in to the scoped V2 auth presentation", () => {
  assert.match(loginPage, /<AuthV2Shell mode="login">/);
  assert.match(signupPage, /<AuthV2Shell mode="signup">/);
  assert.match(authShell, /data-auth-v2=\{mode\}/);
  assert.match(authStyles, /body:has\(\[data-auth-v2\]\)/);
  assert.doesNotMatch(globalStyles, /data-auth-v2/);
});

test("auth actions and return_to contracts remain intact", () => {
  assert.match(loginPage, /safeAuthReturnPath\(requestedReturnTo\)/);
  assert.match(signupPage, /safeAuthReturnPath\(requestedReturnTo\)/);
  assert.match(loginPage, /chatGPTSignInPath\(returnTo\)/);
  assert.match(signupPage, /chatGPTSignInPath\(returnTo\)/);
  assert.match(loginPanel, /action="\/api\/auth\/supabase\/login"/);
  assert.match(signupPanel, /action="\/api\/auth\/supabase\/signup"/);
  assert.match(loginPanel, /name="returnTo" value=\{returnTo\}/);
  assert.match(signupPanel, /name="returnTo" value=\{returnTo\}/);
});

test("auth forms keep accessible labels, autocomplete, and error associations", () => {
  assert.match(loginPanel, /htmlFor="login-email"/);
  assert.match(loginPanel, /autoComplete="email"/);
  assert.match(loginPanel, /autoComplete="current-password"/);
  assert.match(signupPanel, /htmlFor="signup-display-name"/);
  assert.match(signupPanel, /autoComplete="name"/);
  assert.match(signupPanel, /autoComplete="new-password"/);
  assert.match(loginPanel, /aria-label=\{showPassword \? "비밀번호 숨기기" : "비밀번호 보기"\}/);
  assert.match(signupPanel, /aria-label=\{showPassword \? "비밀번호 숨기기" : "비밀번호 보기"\}/);
  assert.match(loginPanel, /aria-describedby=\{emailError/);
  assert.match(signupPanel, /aria-describedby=\{errors\.password/);
});

test("auth V2 avoids global selectors, legacy accent colors, and tiny new type", () => {
  assert.doesNotMatch(authStyles, /(^|\n)\s*(input|button|form|label)\s*\{/);
  assert.doesNotMatch(authStyles, /10px|11px|#(?:a3ff12|5de2d7)|lime|aqua|gradient/i);
  assert.match(authStyles, /--v2-color-action-primary/);
  assert.match(authStyles, /min-height:\s*3rem/);
});

test("auth keyboard focus and secondary actions use V2 accessibility tokens", () => {
  assert.match(authStyles, /\.field input:focus-visible[\s\S]*?outline:\s*var\(--v2-focus-width\)/);
  assert.match(authStyles, /\.passwordToggle[\s\S]*?min-height:\s*var\(--v2-control-min-size\)/);
  assert.match(authStyles, /\.switchCopy \.textLink,[\s\S]*?min-height:\s*var\(--v2-control-min-size\)/);
});

test("courses hotfix stays page-scoped with readable type and touch targets", () => {
  assert.match(read("app/courses/page.tsx"), /className="page-main catalog-page"/);
  assert.match(globalStyles, /\.catalog-page \.eyebrow,[\s\S]*?font-size:\s*12px/);
  assert.match(globalStyles, /\.catalog-page \.course-card-cta\s*\{[\s\S]*?min-height:\s*44px/);
});

test("provider-specific UI only presents authentication methods that already exist", () => {
  const combined = [loginPage, signupPage, loginPanel, signupPanel].join("\n");
  assert.doesNotMatch(combined, /비밀번호 찾기|Apple|Kakao|Naver/);
  assert.match(combined, /Google/);
});
