# SECURIUM 랜딩·대시보드 UX 정리

## 1. 개편 목적

공개 랜딩 페이지와 로그인 사용자의 학습 대시보드 역할을 명확히 분리한다.

- 비로그인 사용자: `/`에서 SECURIUM의 가치와 공개 과정 탐색을 확인한다.
- 로그인 사용자: `/` 접근 시 `/dashboard`로 이동해 실제 학습 상태를 확인한다.

## 2. 확인된 현재 구조

- App Router 기반 화면은 `app` 디렉터리에 있다.
- 공개 랜딩 페이지는 `app/page.tsx`이다.
- 로그인 사용자 대시보드는 `app/dashboard/page.tsx`이다.
- 공통 헤더는 `components/site-header.tsx`와 `components/header-controls.tsx`를 사용한다.
- 공통 과정 카드는 `components/course-card.tsx`를 사용한다.
- 공개 과정 데이터는 `listPublishedCoursesCached()`를 통해 조회한다.
- 대시보드 수강 데이터는 `listDashboardUserEnrollments()`를 통해 조회한다.
- 오늘의 학습 계획은 `getTodayLearningPlan()`을 통해 조회한다.
- `.openai/hosting.json`은 기존 Sites 호스팅 설정이므로 변경하지 않았다.

## 3. 비로그인·로그인 사용자 흐름

| 사용자 상태 | 경로 | 처리 |
| --- | --- | --- |
| 비로그인 | `/` | 공개 랜딩 페이지 표시 |
| 로그인 | `/` | 서버 측에서 `/dashboard`로 redirect |
| 로그인 | `/dashboard` | 실제 수강·복습·추천 학습 요약 표시 |
| 비로그인 | `/dashboard` | 기존 인증 보호 흐름 유지 |

## 4. 정보 구조

### 공개 랜딩

- Hero: SECURIUM의 핵심 가치, CTA, 학습 흐름 예시
- 가치 카드: 과정별 진도 관리, 문제·복습 중심 학습, AI 학습 지원
- 과정 카탈로그: 기존 CourseCard와 공개 과정 조회 재사용

### 대시보드

- 상단 Hero: 사용자 인사, 현재 이어갈 과정, 오늘 목표·복습 요약
- 통계 카드: 기존 수강 과정, 오늘 학습, 오늘 복습 지표 유지
- 오늘의 추천 학습: 기존 추천/설정 UI 유지
- 진행 중인 과정: 기존 Enrollment 카드 유지

## 5. 데이터 출처

- 공개 과정 수: `listPublishedCoursesCached()`
- 현재 수강 과정: `listDashboardUserEnrollments(user.id)`
- 오늘 문제 목표와 복습 수: `getTodayLearningPlan(user.id)`

실제 데이터가 없을 때는 임의 숫자를 만들지 않고 빈 상태 또는 안내 상태로 표시한다.

## 6. 예외 상태

- 공개 과정 조회 실패: 기존 안내 문구 유지
- 대시보드 데이터 조회 실패: 기존 `safeDashboardData()` fallback 유지
- 진행 중인 과정 없음: 과정 둘러보기 CTA 제공
- 추천 데이터 없음: 첫 학습 시작 안내 표시

## 7. 반응형 기준

- 기존 `app/globals.css`의 960px, 680px breakpoint를 유지한다.
- 모바일에서는 Hero CTA가 충분한 터치 영역을 갖도록 기존 버튼 규칙을 재사용한다.
- 과정 카드와 대시보드 카드 그리드는 기존 반응형 규칙을 따른다.

## 8. 접근성 기준

- Hero와 주요 섹션은 기존 heading 구조를 유지한다.
- 보조 학습 요약은 `aria-label`이 있는 aside로 제공한다.
- 장식적 진행 막대는 기존 `ProgressBar` 또는 `aria-hidden` 처리된 스타일을 유지한다.
- 버튼과 링크는 기존 focus-visible 스타일을 재사용한다.

## 9. 변경된 파일

- `app/page.tsx`
- `app/dashboard/page.tsx`
- `app/globals.css`
- `docs/design/landing-dashboard-ux.md`

## 10. 향후 개선 범위

- 운영 브라우저에서 360px, 390px, 768px, 1024px, 1440px 이상 수동 검수
- 로그인 사용자의 `/` redirect가 Supabase 세션 갱신 흐름과 충돌하지 않는지 운영 확인
- 과정 카드의 추천 대상과 학습량을 더 풍부하게 하려면 기존 Course 메타데이터 확장이 필요할 수 있음

