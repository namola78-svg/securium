import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profile = readFileSync("app/profile/page.tsx", "utf8");
const settings = readFileSync("app/settings/page.tsx", "utf8");
const logout = readFileSync("components/profile-logout-button.tsx", "utf8");

test("profile prioritizes real account and compact learning data", () => {
  assert.match(profile, /<h1>마이페이지<\/h1>/);
  assert.match(profile, /listUserEnrollments\(user\.id\)/);
  assert.match(profile, /listQuestionBookmarks\(user\.id\)/);
  assert.match(profile, /currentCourse\.progressPercent/);
  assert.match(profile, /href="\/analytics"/);
  assert.match(profile, /href="\/bookmarks"/);
  assert.match(profile, /href="\/settings"/);
  assert.doesNotMatch(profile, /user\.id\}|user\.roles|가입일|시험 목표일|직업/);
});

test("settings exposes only persisted learning goal controls", () => {
  assert.match(settings, /getLearningSettings\(user\.id\)/);
  assert.match(settings, /LearningSettingsForm/);
  assert.match(settings, /dailyQuestionGoal/);
  assert.match(settings, /dailyStudyMinutes/);
  assert.match(settings, /알림, 계정 삭제, 공개 프로필 설정은 현재 제공되는 기능이 아닙니다/);
  assert.doesNotMatch(settings, /type="checkbox"|role="switch"/);
});

test("profile logout reuses the existing logout endpoint", () => {
  assert.match(logout, /fetch\("\/api\/auth\/supabase\/logout", \{ method: "POST", body: form \}\)/);
  assert.match(logout, /form\.set\("returnTo", "\/dashboard"\)/);
  assert.match(logout, /aria-busy=\{pending\}/);
  assert.match(logout, /role="alert"/);
});

test("AI Tutor and MY keep mutually exclusive mobile active states", () => {
  const nav = readFileSync("lib/ui-nav.ts", "utf8");
  const myLine = nav.split("\n").find((line) => line.includes('label: "MY"')) ?? "";
  assert.match(nav, /label: "AI 튜터"[\s\S]*?activeHrefs: \["\/ai-tutor"\]/);
  assert.doesNotMatch(myLine, /\/ai-tutor/);
});
