# SECURIUM V2 - PHASE 5 LEARNER DASHBOARD

## Scope

Phase 5 migrates only `/dashboard` to the V2 learner presentation. The Phase 4 learner shell remains unchanged. Learn, practice, review, wrong notes, mock exams, analytics, AI Tutor, profile, settings, public, authentication, and admin screens are outside this phase.

## Baseline and precondition

- Branch: `agent/isms-p-theory-v1`
- HEAD: `e3d8293c20127940a9b3d49d912546623b774e77`
- Staged changes: none
- The working tree already contained the uncommitted Phase 0-4 implementation and unrelated artifacts; they were preserved.
- The requested `docs/securium-v2-phase1-report.md` does not exist. `docs/securium-v2-phase-0-1-validation.md` was used as the actual Phase 1 validation record.
- Phase 4 browser regression passed 28/28 learner route and viewport cases before Dashboard implementation. No P0 shell, navigation, auth, active-route, or shell-separation issue was found.

## Product hierarchy

The Dashboard answers "오늘 무엇을 공부해야 하는가?" before presenting supporting information.

1. Greeting and one recommended action
2. Current course progress
3. Today's question and review plan
4. Active-course progress
5. Analysis readiness and recent learning

The recommendation card is the only Primary CTA surface. Supporting cards use text or subtle actions.

## Data safety

The implementation reuses only:

- `listDashboardUserEnrollments(user.id)`
- `getTodayLearningPlan(user.id)`

The existing first recommendation remains the preferred next action. Existing due-review data, current active course, and the no-enrollment state provide presentation fallbacks.

No readiness score, pass probability, weakness score, streak, study time, activity count, or subject progress was created. Current course progress is explicitly labeled as course progress, not exam readiness. Because the current Dashboard aggregates do not provide subject-level progress or actual weakness records, the Dashboard shows an analysis-ready empty state instead of invented values.

## Responsive behavior

- Desktop uses a wide two-column analysis layout inside the Phase 4 app shell.
- Tablet keeps the recommendation full width, pairs current progress with today's plan, and preserves the Phase 4 drawer navigation.
- Mobile uses a deliberate order: greeting, recommendation, current progress, today's plan, active courses, analysis readiness, recent learning.
- At 390px, the recommendation and its CTA appear within the first viewport.
- Mobile content retains Phase 4 bottom-navigation safe padding.

## Accessibility

- One Dashboard `h1` and semantic section headings.
- The current-course ring exposes progressbar role, label, min, max, current value, and value text.
- One visually dominant Primary CTA.
- Navigation remains link-based and existing Phase 4 shell controls retain their semantics.
- Visible mobile Dashboard targets meet the 44px minimum.
- V2 focus-visible styling is retained.
- The route-specific loading state exposes `aria-busy` and a screen-reader status without shimmer animation.

## Validation

| Check | Result |
| --- | --- |
| Phase 4 learner-shell regression | PASS, 28/28 |
| Dashboard and mobile-nav focused tests | PASS, 10/10 |
| Typecheck | PASS |
| Lint | PASS |
| Dashboard browser viewport cases | PASS, 4/4 |
| Viewports | 390, 768, 1024, 1440 |
| Authenticated HTTP responses | 200 for all cases |
| Sites unauthenticated redirect | PASS, 307 |
| Horizontal overflow | 0 cases |
| Console warnings/errors | 0 |
| Page errors | 0 |
| Mobile targets below 44px | 0 |
| Visual inspection | PASS at 390 and 1440 |

Machine-readable evidence is stored in `reports/ui-v2/phase5/dashboard-qa-results.json`. Full-page screenshots are stored as `dashboard-v2-390.png`, `dashboard-v2-768.png`, `dashboard-v2-1024.png`, and `dashboard-v2-1440.png` in the same directory.

## Changed files

- `app/dashboard/page.tsx`
- `app/dashboard/loading.tsx`
- `components/v2/dashboard-v2.module.css`
- `tests/dashboard-learner-journey.test.ts`
- `reports/ui-v2/phase5/dashboard-qa.mjs`
- `docs/securium-v2-phase5-dashboard-report.md`

No database, repository, service, API, auth, learner-internal route, public route, or admin route was changed.

## Phase boundary

Phase 5 Dashboard is complete. Internal learner-screen redesign remains outside this phase.
# 최종 검증 보충

- Dashboard 및 Learner Shell 집중 테스트: PASS 11/11
- Dashboard 반응형 브라우저 QA: PASS 4/4 (390, 768, 1024, 1440px)
- 인증되지 않은 `/dashboard` 접근: PASS, 로그인 경로로 307 리다이렉트
- 통합 테스트: PASS 23/23
- Next.js 프로덕션 빌드: PASS (정적 생성 63개 경로)
- Cloudflare/Vinext 빌드: PASS
- 통합 검증 과정에서 모든 등록 과정의 Learn/Practice 링크가 유지되도록 Dashboard 표시 계약을 보완했다.
- 전체 단위 테스트는 Dashboard 범위 밖의 기존 Learn 화면 문구 계약 1건 때문에 실패한다. `tests/security-certification-curriculum-domain.test.ts`는 `필기·실기 선택`을 기대하지만 현재 Learn 구현은 `필기·실기 학습 경로`를 사용한다. Phase 5 범위 준수를 위해 Learn 화면과 해당 계약은 수정하지 않았다.
