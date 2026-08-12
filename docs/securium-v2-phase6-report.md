# SECURIUM V2 - PHASE 6 LEARN EXPERIENCE

## A. Scope

`/learn/**`의 과정 개요, 과목, legacy lesson, Course Lesson, curriculum presentation을 V2로 전환했다.

## B. Previous Learn UX

기존 과정 화면은 이어서 학습, 문제, 복습, 분석, 전체 커리큘럼, 이론 목록, 실무, 모의고사를 비슷한 강도로 노출했다. Lesson은 본문과 진도 동작이 한 열에 이어져 현재 위치와 다음 행동을 빠르게 파악하기 어려웠다.

## C. Information Architecture

과정과 다음 학습, 핵심 개념, 실제 시험 포인트와 근거, 문제 확인, 다음 학습 순서로 재구성했다. 전체 curriculum은 기본 접힘 상세 탐색 영역으로 낮췄다.

## D. Course Overview

다음 레슨을 유일한 primary action으로 사용한다. 실제 이론 progress와 due review만 표시하며 Practice, Review, Analytics는 보조 링크로 제공한다.

## E. Lesson Layout

본문은 최대 800px reading column을 사용한다. Desktop은 진행 outline을 오른쪽에, Tablet과 Mobile은 본문 앞에 배치한다.

## F. Curriculum Navigation

기본적으로 최상위 과정만 펼치고 필요할 때 모두 펼칠 수 있다. 선택한 항목은 텍스트와 배경으로 표시하며 학습 자료와 관련 문제 action만 제공한다.

## G. Core Concepts

Lesson H1과 실제 본문 콘텐츠를 핵심 개념 흐름으로 표시한다. 새로운 학습 내용을 생성하지 않았다.

## H. Exam Points

Course Lesson의 기존 `examPoints`가 있을 때만 별도 영역으로 표시한다.

## I. Sources / Evidence

Legacy lesson은 기존 revision 정보를 disclosure로 제공한다. Course Lesson은 기존 legal, standard, evidence notes가 있을 때만 공식 근거 disclosure를 제공한다.

## J. Ontology UX

내부 ontology, SKOS, node ID는 노출하지 않는다. 실제 연결 정보는 학습 항목, 참고 기준, 관련 문제로 번역한다.

## K. Related Questions

관련 count가 없는 경우 실제 Practice route로 이동하는 일반 5문제 CTA를 사용한다. Practice 화면은 변경하지 않았다.

## L. Next Learning

이전/다음 lesson이 존재할 때 실제 repository 결과로 navigation을 구성한다.

## M. Desktop UX

넓은 과정 overview와 제한된 reading column, sticky outline을 사용한다.

## N. Tablet UX

과정 overview는 2열을 유지하고 Lesson outline은 본문 위의 진행 panel로 이동한다.

## O. Mobile UX

다음 학습 CTA를 상단에 유지하고 모든 주요 touch target을 44px 이상으로 설정했다. curriculum과 source는 disclosure로 밀도를 낮췄다.

## P. Accessibility

하나의 H1, semantic article/section/nav, breadcrumb, accessible disclosure, progressbar value, focus-visible, text current-state, keyboard button semantics를 사용한다.

## Q. Data / Domain Preservation

기존 repository, Promise.all, progress API, enrollment/auth, Content V3 renderer, legacy fallback을 유지했다. 계산과 추천 로직을 추가하지 않았다.

## R. Browser QA

Phase 6 browser harness는 overview에서 실제 next lesson으로 이동하고 인증, console, overflow, CTA, progress semantics를 확인했다. 4/4 viewport가 통과했고 인증되지 않은 접근은 로그인 경로로 307 redirect됐다. console warning/error와 page error는 없었다.

## S. Responsive QA

390, 768, 1024, 1440 viewport가 모두 통과했다. 모든 viewport에서 document horizontal overflow는 0이었다. 초기 390 QA에서 breadcrumb touch target이 44px 미만인 문제를 발견해 수정했고, 시각 QA에서 mobile outline이 본문을 앞서는 문제를 발견해 본문과 next learning 뒤로 이동했다.

## T. Tests

Learn hierarchy, learner-facing copy, domain taxonomy, rendered integration 계약을 유지·보강했다.

- `git diff --check`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run test:unit`: PASS
- Learn 집중 계약 테스트: PASS, 7/7
- `npm run test:integration`: PASS, 23/23
- Phase 6 browser QA: PASS, 4/4

## U. Build

`npm run build`와 `npm run build:cloudflare` 모두 통과했다. Next.js는 63개 static generation step을 완료했다. Vinext의 기존 route classification advisory 외 build failure는 없다.

## V. Files Changed

- `app/learn/[courseSlug]/page.tsx`
- `app/learn/[courseSlug]/subjects/[subjectId]/page.tsx`
- `app/learn/[courseSlug]/lessons/[lessonId]/page.tsx`
- `app/learn/[courseSlug]/course-lessons/[courseLessonId]/page.tsx`
- `app/learn/[courseSlug]/levels/[levelId]/page.tsx`
- `components/learn-curriculum-path-tree.tsx`
- `components/course-lesson-actions.tsx`
- `components/lesson-actions.tsx`
- `components/v2/learn-experience.module.css`
- `tests/learn-course-journey.test.ts`
- `tests/learn-learner-copy.test.ts`
- `tests/security-certification-curriculum-domain.test.ts`
- `tests/rendered-html.test.mjs`
- `reports/ui-v2/phase6/learn-qa.mjs`
- `docs/securium-v2-phase6-report.md`

## W. Intentionally Not Changed

Dashboard, Practice 내부 UX, explanation, review, wrong notes, mock exam, analytics, AI Tutor, profile, settings, public/auth, admin을 변경하지 않았다.

## X. Regression Check

Phase 4/5 gate의 재실행은 로컬 Vinext D1 동시 실행 충돌과 개발 서버 connection reset으로 중단됐다. 기존 성공 증거는 Phase 4 28/28, Phase 5 4/4이며 제품 assertion P0는 발견되지 않았다. 최종 integration 23/23, 두 production build, Learn auth redirect와 learner shell/browser 검증은 통과했다. Dashboard, Practice, Public/Auth, Admin 구현 파일은 Phase 6에서 변경하지 않았다.

## Y. DB / Migration / Content Status

DB, migration, taxonomy, curriculum data, ontology, SKOS, provenance, Content V3 변경 없음.

## Z. Phase 7 Readiness

Phase 6는 구현, 정적 검증, unit/integration, production build, responsive/browser/visual QA 기준으로 완료됐다. Phase 7 진행이 가능하지만 시작하지 않았다.
