# SECURIUM V2 — PHASE 10 ANALYTICS + WEAKNESS

## A. Scope

`/analytics`와 `/analytics/[courseId]`의 정보 구조, 취약 영역 표현, 반응형 UI, 접근성, 학습 행동 연결을 V2로 정리했다.

## B. Green Baseline

Phase 10 시작 baseline은 Unit 342/342, Integration 23/23, Full E2E 80/80, typecheck/lint/Next/Cloudflare build PASS였다.

## C. Previous Analytics UX

기존 화면은 실제 집계값과 Practice 연결을 제공했지만 요약, 취약 영역, 다음 행동, 상세 데이터의 우선순위가 약했고 과정 상세가 밀집된 단일 마크업에 의존했다.

## D. Analytics Information Architecture

Overview는 학습 결과 요약 → 가장 취약한 수강 과정 → 다음 학습 행동 → 과정별 성과 순서다. 과정 상세는 결과 요약 → 가장 취약한 주제 → 행동 → 과목/주제 성과 → 문제풀이 상세 순서다.

## E. Summary Metrics

Overview는 기존 `getIntegratedStatistics`의 정답률, 문제 풀이 수, 학습일, 수강 과정만 표시한다. 과정 상세는 기존 `getCourseStatistics`의 정답률, 문제 풀이 수, 반복 오답, 단계 완료를 표시한다.

## F. Weakness UX

문제 기록이 있는 수강 과정만 정답률 오름차순으로 비교한다. 과정 상세의 주제도 기존 `byTopic.accuracy` 오름차순을 사용한다. composite weakness score나 readiness model은 추가하지 않았다.

## G. Subject Performance

기존 `bySubject` 집계와 curriculum subject mapping을 사용한다. 과목별 문제 수, 정답률, 기존 `subjectId` Practice route를 제공한다.

## H. Topic Performance

기존 `byTopic` 집계와 curriculum topic mapping을 사용한다. `topicId`, `subjectId`, `count=10` query contract를 유지한다.

## I. Learning Trend

현재 repository가 비교 가능한 time-series를 제공하지 않아 차트, 증감률, 추이 해석을 추가하지 않았다.

## J. Recent Activity

현재 Analytics aggregate가 recent activity row를 제공하지 않아 Dashboard 데이터를 복제하거나 신규 query를 추가하지 않았다.

## K. Actionable Analytics

취약 과정/주제에서 Practice, Review, Wrong Notes로 이동할 수 있다. 모든 Analytics action route는 authenticated fixture에서 HTTP 200을 확인했다.

## L. Review Integration

`/reviews`로 연결한다. Analytics가 `reviewOnly`를 새로 구성하지 않고 Review V2가 기존 review contract를 소유한다.

## M. Wrong Notes Integration

`/wrong-notes`로 연결한다. `wrongOnly`나 `questionId`를 Analytics가 추측하지 않는다.

## N. Practice Integration

과정은 `/practice/{courseSlug}?count=10`, 과목은 `subjectId`, 주제는 `topicId`와 실제 curriculum mapping을 사용한다. 새로운 Practice mode는 없다.

## O. Learn Integration

Analytics aggregate에 lesson/topic-to-Learn route 관계가 없어 가짜 `개념 다시 학습` action을 추가하지 않았다.

## P. Mock Exam Integration

기존 aggregate에는 mock exam 평균만 있고 attempt denominator가 없어 실제 0점과 no-data를 구분할 수 없다. 오해를 피하기 위해 Phase 10 요약에는 표시하지 않았고 Mock Exam 계산/화면은 변경하지 않았다.

## Q. Desktop UX

1440에서 learner sidebar, 4열 summary, weakness/action 2열, subject/topic 비교, compact course rows가 정상 렌더링된다.

## R. Tablet UX

768에서 summary 2×2, weakness/action 단일 열, subject/topic 단일 열로 전환된다.

## S. Mobile UX

390에서 H1, primary action, 2×2 summary, top weakness 순서가 유지된다. 주요 CTA는 44–48px이며 bottom navigation safe area를 적용했다.

## T. Empty / Partial Data

수강 없음, 문제 기록 없음, 취약 영역 미확인을 분리했다. count 0은 `0문제 풀이`, 분모가 없는 accuracy는 `기록 없음`으로 표시한다. 두 번째 authenticated fixture에도 학습 기록이 있어 true empty-user browser 상태는 재현하지 못했으며 새 production account는 만들지 않았다.

## U. Accessibility

H1/H2 계층, `dl` metric semantics, list semantics, progressbar min/max/now/label, focus-visible, 44px mobile target, loading live region, error alert를 적용했다. 상태를 색상만으로 전달하지 않는다.

## V. Numeric / Percentage QA

- Active overview: 정답률 30%, 문제 1752개, 학습일 16일, 수강 과정 6개
- Overview reconciliation: `1752 = 1387 + 0 + 0 + 106 + 0 + 259`
- ISMS-P reconciliation: `1387 = 1240 + 147` subject questions
- Browser progress values: 모두 0–100
- `safeRate`가 반환하는 정수 percentage를 그대로 표시하며 ×100하지 않는다.
- UI clamp를 사용하지 않아 domain contract violation을 숨기지 않는다.
- `NaN`, `Infinity`, `undefined`, `null%`, `-0%`, `10000%`, 음수 count 없음
- 평균 응답 시간은 기존 millisecond contract를 1000으로 나눠 정수 초로 표시한다. 학습 시간 aggregate는 없어 분/시간 지표를 만들지 않았다.
- 날짜 row를 추가하지 않아 신규 timezone/date logic이 없다.

## W. Performance

Overview는 기존 단일 aggregate, 과정 상세는 course/enrollment/curriculum 병렬 조회 후 기존 course statistics를 사용한다. map 내부 query나 weakness row별 query를 추가하지 않았다. chart dependency와 package dependency를 추가하지 않았다.

## X. Security / User Scoping

`requireCurrentAppUser`와 repository의 `user.id` scoping을 유지한다. user ID와 raw DB record를 Client Component에 전달하지 않는다. 비로그인 `/analytics`는 Sites auth route `/signin-with-chatgpt?return_to=/analytics`로 이동하며 local fallback에는 해당 platform route가 없어 최종 HTTP 404지만 Analytics 데이터는 노출되지 않는다.

## Y. Browser QA

Vinext는 `localhost:3000`에서 실행했다. 내장 Browser instance가 환경에 없어 기존 E2E 계열과 동일한 Playwright Chromium fallback을 사용했다.

- `/analytics`: HTTP 200
- `/analytics/course-isms-p`: HTTP 200
- Dashboard → Analytics → 과정 분석 → Practice: PASS
- Analytics → Review/Wrong Notes: PASS
- Analytics action 15개: 모두 HTTP 200
- console error/warning/hydration/invalid nesting: 0
- 결과: `reports/ui-v2/phase10/browser-qa.json`, `reports/ui-v2/phase10/extended-qa.json`

## Z. Responsive QA

390, 768, 1024, 1440 overview/course screenshot을 저장했다. 모든 viewport의 body horizontal overflow는 0이며 text, metric, progress, CTA clipping이 없다.

## AA. Regression QA

Dashboard, Learn, Practice, Review, Wrong Notes, Mock Exam을 390/1440에서 확인했다. 모두 HTTP 200, H1 1개, overflow 0, console message 0이다. Explanation 및 persistence flow는 Full E2E 80/80으로 확인했다.

## AB. Tests

- Analytics focused: 4/4 PASS
- Unit: 342/342 PASS
- Integration: 23/23 PASS
- Full E2E: 80/80 PASS

## AC. Build

`git diff --check`, typecheck, lint, Next.js build, Cloudflare/Vinext build가 PASS했다.

## AD. Full E2E

80/80 PASS. Phase 10 regression, stale assertion, timeout failure가 없다.

## AE. Files Changed

- `app/analytics/page.tsx`
- `app/analytics/[courseId]/page.tsx`
- `app/analytics/analytics-v2.module.css`
- `app/analytics/loading.tsx`
- `app/analytics/error.tsx`
- `tests/analytics-learner-actions.test.ts`
- `tests/phase3-e2e.test.mjs`
- `docs/securium-v2-phase10-report.md`
- `reports/ui-v2/phase10/*`

## AF. Intentionally Not Changed

Dashboard, Learn, Practice, Explanation, Review, Wrong Notes, Mock Exam, AI Tutor, Profile, Settings, Public, Auth, Admin application code를 변경하지 않았다.

## AG. DB / Migration / Content Status

DB schema, migration, migration metadata, seed, analytics/weakness/progress/scoring 계산, Content V3, taxonomy, ontology, SKOS, provenance, question, answer, explanation을 변경하지 않았다.

## AH. Known Remaining Issues

- 내장 Browser instance가 없어 Playwright Chromium fallback으로 검증했다.
- true empty-learning authenticated fixture가 없어 source-level empty contract와 partial-data fixture만 검증했다.
- Sites auth provider의 `/signin-with-chatgpt`는 local Vinext fallback에서 404지만 보호 데이터는 노출되지 않는다.
- 과정 상세 document title은 공통 title template 때문에 `과정 분석 | SECURIUM | SECURIUM`으로 중복된다. 기능 영향이 없는 기존 minor presentation issue로 남겼다.

## AI. Phase 11 Readiness

Phase 10은 최종 검증이 green이면 PASS이며 Phase 11은 별도 요청이 있을 때 진행할 수 있다.
