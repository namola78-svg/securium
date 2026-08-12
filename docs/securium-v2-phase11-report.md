# SECURIUM V2 — PHASE 11 AI TUTOR + MY / PROFILE

## A. Scope

`/ai-tutor`, `/profile`, `/settings`와 기존 Bookmarks/Analytics/My Courses 연결의 V2 presentation을 정리했다.

## B. Green Baseline

Unit 342/342, Integration 23/23, Full E2E 80/80, typecheck/lint/Next/Cloudflare build PASS에서 시작했다.

## C. Previous AI Tutor UX

기존 AI Tutor는 Practice AI 설명으로 이동하는 안내 페이지였으나 학습 맥락, 권위 구분, 다음 행동의 우선순위가 약했다.

## D. AI Tutor Information Architecture

AI 설명 시작 → 현재 학습 맥락 → source authority → 수강 과정별 진입 순서로 구성했다.

## E. AI Conversation

Standalone conversation API가 없어 가짜 composer나 대화를 만들지 않았다. 기존 Practice 채점 후 AI 설명 요청 flow를 명확한 entry composer로 연결한다.

## F. AI Context

실제 최근 수강 과정과 진도만 표시하며 question context가 없을 때 `아직 선택되지 않음`으로 표시한다.

## G. Sources / Verification

공식 채점/해설 → 연결 근거/콘텐츠 → AI 보조 설명 순서를 명시한다. 실제 response source/status presentation은 기존 Practice AI component를 유지한다.

## H. Suggested Actions

실제 Practice flow가 지원하는 개념 이해, 오답 이해, 근거 확인 entry만 제공한다.

## I. AI Loading / Error

Route loading과 retry 가능한 error boundary를 추가했다. AI API failure presentation은 기존 Practice contract를 유지한다.

## J. AI Mobile UX

결과는 최종 browser QA 후 확정한다.

## K. Previous MY/Profile UX

기존 Profile은 이름, 이메일, 역할만 표시하고 학습 상태와 실제 관련 route 연결이 부족했다.

## L. Profile Information Architecture

사용자 정보 → 현재 학습 → quick links → compact course list → settings/logout 순서다.

## M. Learning Summary

기존 enrollment query의 과정명과 progress를 사용한다. chart나 새 aggregate를 추가하지 않았다.

## N. Quick Links

실제 `/my-courses`, `/analytics`, `/bookmarks`, `/settings`만 제공한다.

## O. Bookmarks

기존 user-scoped bookmark repository와 `/bookmarks` 화면을 변경 없이 재사용한다.

## P. Settings

기존 daily question goal과 study minutes만 표시하고 동일 form/API persistence를 유지한다.

## Q. Logout

기존 `/api/auth/supabase/logout` POST와 `/` redirect contract를 재사용한다.

## R. Desktop UX

최종 browser QA 후 확정한다.

## S. Tablet UX

최종 browser QA 후 확정한다.

## T. Mobile UX

최종 browser QA 후 확정한다.

## U. Accessibility

Heading, list/dl/nav semantics, focus-visible, loading/error status, 44px mobile target을 적용했다.

## V. Security / User Scoping

모든 repository 호출은 `requireCurrentAppUser`의 user ID로 scope된다. raw ID, token, provider metadata를 출력하지 않는다.

## W. Performance

Profile의 enrollment와 bookmark 조회는 `Promise.all`로 병렬 실행한다. item별 query와 신규 client dependency가 없다.

## X. Browser QA

최종 검증 후 기록한다.

## Y. Responsive QA

최종 검증 후 기록한다.

## Z. Regression QA

최종 검증 후 기록한다.

## AA. Tests

최종 검증 후 기록한다.

## AB. Build

최종 검증 후 기록한다.

## AC. Full E2E

최종 검증 후 기록한다.

## AD. Files Changed

최종 변경 경로는 close-out에서 기록한다.

## AE. Intentionally Not Changed

Dashboard, Learn, Practice, Explanation, Review, Wrong Notes, Mock Exam, Analytics, Public, Auth, Admin application code를 변경하지 않았다.

## AF. DB / Migration / AI Contract Status

DB, migration, seed, AI API/provider/prompt/safety/source contract, user/course/content schema를 변경하지 않았다.

## AG. Known Remaining Issues

Standalone AI conversation/history backend와 profile edit는 현재 contract에 없어 추가하지 않았다.

## AH. Phase 12 Readiness

Phase 11 검증 기준을 충족했다. Phase 12 Final Responsive / Accessibility / Visual QA를 시작할 수 있다.

## Close-out Verification

- Phase 11 status: PASS
- Browser runtime: authenticated local Vinext runtime with existing D1 and test-user fixtures
- AI Tutor: `/ai-tutor` rendered at 390, 768, 1024, and 1440. The page keeps the real practice-first AI contract and does not advertise a standalone chat API that does not exist.
- AI contract: focused semantic tests 7/7 PASS; AI authentication, source, safety, user scoping, request limits, and pre-answer exposure E2E 5/5 PASS.
- AI context: current enrolled course context and practice entry routes are derived from existing enrollment data. No synthetic lesson, question, or concept context is displayed.
- Sources / verification: official explanation and reviewed evidence remain visually higher authority than AI auxiliary explanations. Raw identifiers and source JSON are not exposed.
- Profile: `/profile` uses the authenticated user's display name/email, real enrollment progress, real bookmark count, and only existing quick-link routes. No internal user/auth identifiers are rendered.
- Settings: `/settings` exposes only `dailyQuestionGoal` and `dailyStudyMinutes`. Direct API save, reload persistence, and restoration passed with the existing `/api/learning-settings` contract; existing success/error live-region presentation is preserved.
- Bookmarks: `/bookmarks` rendered with the existing user-scoped bookmark data and empty-state contract. Profile navigation points to the existing route.
- Logout: Profile posts to the existing `/api/auth/supabase/logout` endpoint and uses the existing dashboard redirect contract. Logged-out access to AI Tutor, Profile, Settings, and Bookmarks remains protected.
- Responsive QA: 390, 768, 1024, and 1440 render checks passed. Body horizontal overflow was 0 at every checked viewport; no composer, bottom-navigation, sidebar, or content collision was found.
- Visual QA: screenshots are stored under `reports/ui-v2/phase11/` for AI Tutor, Profile, Settings, and Bookmarks at the required representative viewports.
- Accessibility: one H1 per page, ordered section headings, semantic lists/definition lists, labelled settings controls, live status/error regions, focus-visible styles, and 44px mobile actions are retained. AI Tutor and MY active navigation states are mutually exclusive.
- Console QA: Phase 11 routes produced no console error, warning, hydration mismatch, invalid nesting, or React key warning in the browser matrix.
- Numeric QA: no `NaN`, `Infinity`, `undefined`, `null%`, or `-0%` artifacts were found. Profile progress and counts use existing repository values.
- Regression: Dashboard, Learn, Practice, Explanation, Review, Wrong Notes, Mock Exam, and Analytics business contracts remained green through Unit, Integration, build, and Full E2E suites.
- `git diff --check`: PASS
- TypeScript: PASS
- Lint: PASS
- Unit: 342/342 PASS
- Integration: 23/23 PASS
- Next.js build: PASS
- Cloudflare/Vinext build: PASS
- Full E2E: 80/80 PASS in 410.9 seconds
- Known limitation: the repository has no standalone AI Tutor conversation/history persistence contract. Phase 11 therefore provides a truthful contextual learning entry and retains the existing post-answer AI explanation flow instead of creating a fake composer or backend.

Phase 11 최종 검증 전에는 Phase 12를 시작하지 않는다.
