# SECURIUM TODAY REPORT

## Repository Checks
- date: 2026-08-09
- commands 실행: git status -sb / git diff --stat / git log -5 / npm run typecheck / npm run lint / npm run build

## 핵심 분석 항목
1) 현재 Navigation 구조
- 중앙 nav 설정을 `lib/ui-nav.ts`로 분리. 항목: 공개 메뉴, 학습자 주요 메뉴, 유틸 메뉴, 모바일 Bottom 메뉴.
- `components/site-nav.tsx` 와 `components/header-controls.tsx`는 단일 nav 소스(`lib/ui-nav.ts`)를 사용.
- 관리자 라우트(`/admin/**`)는 기존 구조 유지.

2) 주요 사용자 Flow
- 로그인 후: 홈/대시보드 → 학습 진행 → 문제풀이/실무 → 결과 복습
- 학습 유저 목표 우선 화면은 대시보드에 집중되었으나 카드 피로도가 높아 개선 필요.

3) UI/UX 문제점
- 카드 과다 사용으로 핵심 행동 결정이 지연.
- 모바일에서 카드/테이블/오버레이 동시 노출로 탭 대상 밀림.
- 대시보드와 학습 플로우의 우선순위 구조가 아직 정리되지 않음.
- 용어/표현이 페이지별로 불균일.

4) 디자인 일관성 문제
- `button-*`/`ds-button`/기존 CSS 클래스 혼재.
- spacing과 radius token이 일부 파일에서 규격 이탈.
- 레거시 컬러값 잔존.

5) 중복 Component 후보
- Navigation renderer
- 상태/결과/빈 화면 패널 (`state-ui`, page 인라인)
- quick card / stat card / course card의 유사 구조 통합 필요

6) globals.css / style 구조 문제
- monolithic 스타일 유지, legacy section 다량.
- 신규 클래스는 소폭 추가되었으나 공통 컴포넌트화 미완성.

7) 접근성 문제
- 포커스 순환은 존재하나 mobile nav/툴팁/아이콘 텍스트 보조 라벨 보완 필요.
- 일부 동작 상태(로딩/에러/성공) 메시지의 텍스트 일관성 보완 필요.

8) 모바일 UX 문제
- 바텀 네비와 상단 드로어 모두 노출되면 상호 간섭 가능.
- 표 기반 페이지 일부에서 가로 스크롤 위험.

9) Dashboard 개선안
- "오늘 추천 학습" / "이어하기" / "오답 복습" 우선 1개 액션 노출.
- 통계/진도는 collapsed 또는 섹션 축소하여 인지 부담 최소화.
- 문제풀이/강의 진입 동선 단일 CTA.

10) 가장 먼저 수정해야 할 파일
- components/site-nav.tsx
- components/header-controls.tsx
- app/globals.css
- components/design-system-primitives.tsx (필요시 확장)
- app/dashboard/page.tsx

## P0 / P1 / P2
- P0: 타입/린트 회귀 제거, 기존 라우트/권한 동작 유지(검증)
- P1: 대시보드 핵심 액션 정렬(1순위 CTA), 모바일 학습 시작 경로 단순화
- P2: 중복 컴포넌트 통합(카드/버튼/상태 메시지), 세부 토큰 정리

## Phase 1 진행 상태
- [x] 공통 nav config 도입 (`lib/ui-nav.ts`)
- [x] Header/Main nav에서 공통 nav 사용(`components/header-controls.tsx`, `components/site-nav.tsx`)
- [x] 모바일 bottom 내비 매핑 정리
- [x] my-learning/practical 신규 페이지 구조 추가(빠른 진입 카드 + 진행 목록)
- [x] typecheck/lint 통과 상태 확보
- [x] 대시보드 카드 단축/핵심 액션 최적화
- [ ] 공통 컴포넌트 라이브러리(버튼/카드/상태 패턴) 정합화

## Phase 2 진행 상태
- [x] 네비게이션 shell에서 유틸 메뉴 분리 시작 (`components/header-controls.tsx`)
- [x] 모바일/데스크톱 네비에서 공통 nav 계층 유지(`components/header-controls.tsx`)
- [x] 대시보드 핵심 액션 우선 노출 텍스트/동선 조정 (`app/dashboard/page.tsx`)
- [x] 대시보드 Hero/Action Rail 반응형 레이아웃 정비(`app/globals.css`)
- [x] 대시보드 접근성/모바일 터치 타겟 최적화(2차 검토 필요) (`app/globals.css`)

## Validation
- npm run typecheck: PASS
- npm run lint: PASS
- npm run build: PASS

## 변경 파일
- `lib/ui-nav.ts`
- `components/site-nav.tsx`
- `components/header-controls.tsx`
- `app/dashboard/page.tsx`
- `app/globals.css`
- `app/my-learning/page.tsx`(신규)
- `app/practical/page.tsx`(신규)

## Phase 3 (Learning/Practice 집중 개선) 진행
- [x] Practice Session 핵심 학습 플로우 컴포넌트 정리 (`components/practice-session.tsx`)
- [x] Practice 페이지 필터 UX 정리 (`app/practice/[courseSlug]/page.tsx`)
- [x] Practice 전용 스타일 안정화 (`app/globals.css`)
- [x] Practice 집중 모드 반응형 대응 클래스 보강

## 테스트 실행
- npm run typecheck: PASS
- npm run lint: PASS
- npm run build: PASS

## 변경 파일
- `app/practice/[courseSlug]/page.tsx`
- `components/practice-session.tsx`
- `app/globals.css`

## Phase 4 (Dashboard 접근성/터치 타겟 최적화) 진행
- [x] 대시보드 Hero CTA의 최소 터치 타겟 정리 (`app/globals.css`)
- [x] 대시보드 Next Action 버튼 타겟/정렬 정리 (`app/globals.css`)
- [x] 모바일/데스크톱 터치 접근 동선 보강 (`app/globals.css`)

### 테스트 실행
- npm run typecheck: PASS
- npm run lint: PASS
- npm run build: PASS

### 변경 파일
- `app/globals.css`

## Phase 2 (Dashboard action-first refinement) 진행
- [x] 대시보드 Hero 보조 액션을 details 기반으로 접힘 처리 (`app/dashboard/page.tsx`)
- [x] 오늘 계획 섹션의 보조 카드 그룹을 collapsible 형태로 정리 (`app/dashboard/page.tsx`)
- [x] 새 액션/카드 토글 클래스 및 반응형 스타일 보강 (`app/globals.css`)
- [x] DashboardStats 섹션을 접힘형 통계 블록으로 축소 (`app/dashboard/page.tsx`, `app/globals.css`)

### 테스트 실행
- npm run typecheck: PASS
- npm run lint: PASS
- npm run build: PASS

### 변경 파일
- `app/dashboard/page.tsx`
- `app/globals.css`

## NEXT
- 다음 Batch: `dashboard` 핵심 액션 토글 동선의 A/B 감각 보완 + 공통 액션 버튼 컴포넌트 정규화 (`components/design-system-primitives.tsx` 신규 패턴 정비, 기존 페이지 점진 적용)

## IN_PROGRESS
- 공통 컴포넌트 정규화 Phase 1 설계 정리 (`components/design-system-primitives.tsx`, `app/dashboard/page.tsx`)

## DONE
- 대시보드 핵심 액션 우선 노출 완료
- 대시보드 보조 항목 2단계 축소 UI 완료

## BATCH 4-STATUS (Phase 1 Component Foundation)
- 공통 액션 컴포넌트 도입: `components/design-system-primitives.tsx`
  - `ActionButton` 추가 (`primary/secondary/outline/ghost/danger/dark`)
  - 로딩/disabled 상태 대응 prop 추가
- 상태 UI 공통 버튼 정규화: `components/state-ui.tsx`
  - `RetryButton`, `EmptyState` 액션 링크를 `ActionButton`으로 전환
- `app/globals.css`
  - `.ds-button.variant-*` 및 `dark` variant 스타일 추가
- `app/dashboard/page.tsx`
  - 이번 배치에서 파일 인코딩 손상 이슈로 기존 변경분 일부를 재적용하지 못해 HEAD 복원
  - 이후 배치에서 변경 전후 동일 동선 기준으로 재적용 예정

### Validation
- npm run typecheck: PASS
- npm run lint: PASS
- npm run build: PASS

## AUTO CONTINUE CHECKPOINT (2026-08-09)

## 1) 현재 Navigation 구조
- `lib/ui-nav.ts`에서 공통 네비 항목을 `publicNavItems / learnerPrimaryNavItems / learnerUtilityNavItems / mobileBottomNavItems`로 분리.
- `components/site-nav.tsx`는 `signedIn` 상태에 따라 공개/학습자 루트를 렌더.
- `components/header-controls.tsx`는 상단/모바일/프로필 메뉴의 이벤트 및 상태를 하나의 파일에서 통합.
- 관리자 라우트는 기존 규약대로 분리되어 유지됨(현재 단계에서 추가 라우트 없음).

## 2) 주요 사용자 Flow
- 로그인 이후 목표-기반 시작점은 ` /dashboard`로 수렴.
- 실무형 학습(문제풀이/실무/복습/오답노트)까지 진입이 가능하지만, 액션 표현이 화면별로 달라 이해 부담 존재.
- 현재 문제풀이 흐름은 `practice filter -> PracticeSession -> 결과 -> report` 구성은 유지되며 집중 모드 정리가 가능.

## 3) UI/UX 문제점
- 버튼/액션 표현이 혼재(legacy `button-*` vs `ds-button`)되어 일관성 저하.
- 대시보드와 연계 페이지에서 카드 위주의 시각 과부하 존재.
- 모바일에서 하단 네비/상단 드로어/콘텐츠가 겹치는 패턴이 반복됨.
- 일부 텍스트(ARIA/label) 정합성 점검 필요 지점 존재(이미징/특수문자/축약 라벨).

## 4) 디자인 일관성 문제
- spacing/타입/라운드 토큰 도입 중이며, 기존 클래스의 잔존 영역이 남아 있음.
- `button-*` 레이어에서 `ActionButton`으로 점진 이동 필요.
- 다크/고대비 대응은 일부 개선되었으나 표준 라벨(Primary/Secondary/Disabled)에 대한 공통 규칙 고도화 필요.

## 5) 중복 Component 후보
- Navigation renderer(좌측/상단/하단/드로어)  
- Practice filter + progress + action CTA 묶음
- Empty/empty-with-action 패턴(이미 `state-ui`에서 일부 정규화 완료)
- 카드형 카드(강의/추천/요약) 통합 여지 있음

## 6) globals.css/style 구조 문제
- 공통 토큰은 추가되었으나 파일이 여전히 monolithic.
- legacy button style 섹션(`.button-*`)이 남아 있어 리팩터 가시성 저하.
- 사용된 색상/간격 중 일부는 legacy값과 새 토큰이 공존.

## 7) 접근성 문제
- 포커스 트랩/키보드 닫기 로직은 존재하나 모바일 우선순위/aria 라벨 텍스트 정돈 필요.
- 링크/버튼 역할 혼재 라인 일부에서 라벨 문구를 명시적으로 개선 필요.

## 8) 모바일 UX 문제
- 모바일 바텀 nav와 드로어의 동시 노출/오버랩 가능성 존재.
- 표 기반 목록에서 터치 영역 최소 높이 점검 필요.

## 9) Dashboard 개선안
- 1st-action 우선순위는 유지 (`오늘 추천 학습` 또는 이어하기 라우팅)로 수렴.
- 통계 카드 노출은 축약 및 단계적 펼침 동선이 적절.
- 복습/오답/리뷰는 현재 페이지 내 2차 우선 구역으로 충분히 분리됨.

## 10) 우선 수정 파일
- [P0] `components/design-system-primitives.tsx`, `components/practice-session.tsx`, `app/practice/[courseSlug]/page.tsx`
- [P1] `app/dashboard/page.tsx` (CTA 라벨/중요도 재배치), `components/header-controls.tsx`(로그인/유틸 CTA 통일)
- [P2] `app/globals.css` legacy button 섹션 정리

### P0/P1/P2
- P0: 회귀 방지(타입/린트/빌드 pass + 라우팅/권한 변경 없음) 유지.
- P1: 핵심 사용자 액션 정규화(`practice` 세션 버튼을 `ActionButton`으로 정리 완료).
- P2: 네비/카드/버튼 컴포넌트 통합 확장 및 토큰 기반 완전 정리.

## BATCH 5 (Phase 1 Component Unification - Practice CTA)
- 진행 내용:
  - `components/practice-session.tsx`의 모든 주요 action/button을 `ActionButton`으로 교체
    - 완료/북마크/다음/제출/AI 해설/신고 버튼
  - `app/practice/[courseSlug]/page.tsx`의 문제 구성 적용 버튼을 `ActionButton`으로 교체
  - `components/practice-session.tsx`에 `ActionButton` import 복구
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS

## NEXT
- 다음 배치: `components/header-controls.tsx` 상단/모바일/프로필 CTA(로그인/회원가입/로그아웃)에서 `ActionButton` 스타일 적용 검토
- 그리고 `app/dashboard/page.tsx`에서 CTA 레이블의 용어/우선순위 정리만 진행 후 정합성 재검증

## BATCH 6 (Phase 2 Component Unification - Header CTA)
- 진행 내용:
  - `components/header-controls.tsx`에 `ActionButton` 임포트 추가
  - 모바일/데스크톱 비로그인 CTA: `Link button-*` → `ActionButton`으로 정규화
  - 모바일/프로필 로그아웃 버튼: `button profile-menu-item danger` → `ActionButton variant="danger"`로 정규화
  - `ActionButton`에 미지원 `role` prop가 들어간 부분 제거(타입 정합화)
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `components/header-controls.tsx`

## IN_PROGRESS
- `app/dashboard/page.tsx` CTA 정규화 완료. 다음 단계는 `components/site-nav.tsx` 및 대시보드 보조 카드 문구 정렬 점검.

## BATCH 7 (Phase 2 Dashboard Button Refactor)
- `app/dashboard/page.tsx`
  - `ActionButton` import 추가
  - Hero: `button-lime`, `button-dark`, `button-ghost` → `ActionButton` (primary/dark/ghost)
  - Today plan primary CTA: `button-dark` → `ActionButton` primary
  - Empty-state 및 card-actions CTA: `button-dark`/`button-ghost` → `ActionButton`
  - 강의 선택 CTA 2곳: `button-dark` → `ActionButton` dark
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `app/dashboard/page.tsx`

## NEXT
- 다음 우선순위:
  - `app/dashboard/page.tsx` 핵심 CTA 텍스트/우선순위 고도화
  - 모바일 바텀 네비우스 카드/오버랩 정합성 점검

## BATCH 8 (Phase 2 Dashboard CTA Expansion)
- `app/guide/page.tsx`
  - `Link` import 제거 후 `ActionButton` 도입
  - Hero-bottom CTA를 `ActionButton`(`variant="dark"`, `className="full-width"`)로 교체
  - `</Link>`를 `</ActionButton>`로 일괄 전환 (해당 블록 1건)
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `app/guide/page.tsx`

## IN_PROGRESS
- `app/site-nav` 및 `components/site-nav.tsx`의 네비 CTA/액션 라벨 정합성 점검

## DONE
- `app/dashboard/page.tsx` 버튼 시스템 정규화(버튼 컴포넌트 기반 전환)
- `app/guide/page.tsx` 핵심 CTA ActionButton 전환
- `app/signup/page.tsx` 회원가입 경로 CTA/Submit `ActionButton` 전환

## BATCH 9 (Phase 2 Auth/Signup CTA)
- `app/signup/page.tsx`
  - `ActionButton` import 추가
  - 회원가입 폼 제출 버튼: `button button-dark full-width` → `ActionButton variant="dark"`
  - ChatGPT 회원가입 링크: `button button-dark full-width` → `ActionButton variant="dark"`
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `app/signup/page.tsx`

## NEXT
- 다음 배치 후보:
  - `app/login/page.tsx` 회원가입/로그인 흐름 CTA 표준화
  - `app/analytics/page.tsx` CTA 패널 버튼 정규화

## IN_PROGRESS
- `app/login/page.tsx` 인증 CTA 정규화 진행 중

## BATCH 10 (Phase 2 Login CTA)
- `app/login/page.tsx`
  - `ActionButton` import 추가
  - `Link className="button button-dark full-width"` → `ActionButton` (`variant="dark"`, `className="full-width"`)
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `app/login/page.tsx`

## DONE
- `app/login/page.tsx` 인증 진입 CTA `ActionButton` 전환 완료

## BATCH 11 (Phase 2 Auth Component CTA)
- `components/login-panel.tsx`
  - `import { ActionButton }` 추가
  - 로그인 폼 제출 버튼: `button button-dark` → `ActionButton variant="dark"`
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `components/login-panel.tsx`

## DONE
- `components/login-panel.tsx` 로그인 제출 버튼 정규화 완료

## NEXT
- 다음 배치 후보:
  - `app/analytics/page.tsx` 대시보드/분석 CTA 정규화
  - `app/analytics/[courseId]/page.tsx` 핵심 CTA 정규화
## BATCH 5-STATUS (CTA 정규화/회귀 검증 완료)

- 완료 작업
  - `app/analytics/page.tsx`: CTA를 `ActionButton`으로 정규화
  - `app/analytics/[courseId]/page.tsx`: CTA를 `ActionButton`으로 정규화
  - `app/about/page.tsx`: 하단 CTA를 `ActionButton`으로 정규화
- 검증
  - `rg -n 'className="button button-'` 대상 파일들에서 Legacy button 클래스 미발견
  - `rg -n '<Link className="button button'` 대상 파일들에서 Legacy button Link 패턴 미발견
- 실행 테스트
  - `npm run typecheck` PASS
  - `npm run lint` PASS
  - `npm run build` PASS
- 변경 파일
  - `app/analytics/page.tsx`
  - `app/analytics/[courseId]/page.tsx`
  - `app/about/page.tsx`
- 다음 진행
  - 대시보드/학습 중심 공통 CTA 일관성(필요 시 `components/design-system-primitives.tsx` variant 규칙 보강)
  - my-learning / practical 하위 페이지에서 유사 CTA 문구·인터랙션 일관성 점검

## BATCH 12 (Phase 2 Header CTA Finalization)
- `components/header-controls.tsx`
  - 공통 네비 소스 `lib/ui-nav.ts`에서 구성된 항목 기반 렌더링 유지 확인
  - 모바일/데스크톱 비로그인 CTA(`로그인`, `무료로 시작하기`)를 `ActionButton`으로 정규화
  - 모바일 프로필 로그아웃 버튼을 `ActionButton variant="danger"`으로 정규화
  - 데스크톱 프로필 로그아웃 버튼을 `ActionButton variant="danger"`으로 정규화
  - `ActionButton` 미지원 `role` prop 정리(타입 정합성 확보)
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일
  - `components/header-controls.tsx`

## IN_PROGRESS
- 다음 배치 후보:
  - `components/site-nav.tsx`에서 관리자/학습 메뉴 라벨 계층 재점검
  - 모바일 바텀 네비/드로어 오버랩 대응용 간격/타겟 보강
  - `components/site-nav.tsx`와 `app/dashboard/page.tsx` 용어 정리(“오늘 추천 학습” 동선 명확화)

## BATCH 13 (Phase 2 Settings CTA Standardization)
- `app/settings/page.tsx`
  - 학습 설정 화면 하단 액션 링크(`대시보드 보기`, `문제풀이`)를 `ActionButton`(`variant="dark"`, `variant="ghost"`)으로 정규화
  - `Link` import 제거 및 `ActionButton` import 추가
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `app/settings/page.tsx`

## DONE
- BATCH 14 이전 단계의 후속 점검 항목을 `BATCH 14`/`BATCH 15`에서 순차 반영하기로 조정.

## BATCH 14 (Phase 2 My Courses CTA Standardization)
- `app/my-courses/page.tsx`
  - 헤더/카드 CTA 레거시 링크(`className="button button-dark button-small"`)를 `ActionButton`(`variant="dark"`, `className="button-small"`)로 교체
  - 상태 저장 submit 버튼(`className="button button-ghost button-small"`)을 `ActionButton`(`variant="ghost"`)로 교체
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `app/my-courses/page.tsx`

## BATCH 15 (Phase 2 My Learning CTA Standardization)
- `app/my-learning/page.tsx`
  - 이어 학습 액션의 legacy anchor 버튼(`className="button button-dark full-width"`)를
    `ActionButton`(`variant="dark"`, `className="full-width"`)으로 교체
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `app/my-learning/page.tsx`

## BATCH 16 (Phase 2 Wrong Notes CTA Standardization)
- `app/wrong-notes/page.tsx`
  - 헤더 CTA, 필터 제출 버튼, 빈 상태 CTA, 조건별 재풀이 CTA, 초기화 CTA의
    `className="button ..."` 패턴을 `ActionButton`으로 교체
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `app/wrong-notes/page.tsx`

## BATCH 17 (Phase 2 SiteNav Utility Separation)
- `components/site-nav.tsx`
  - `learnerUtilityNavItems`를 이용해 `signedIn` 상태에서 주 메뉴와 유틸리티 메뉴를
    분리 렌더링
  - 기존 `className="active"` 동작은 primary 유지
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `components/site-nav.tsx`

## BATCH 18 (Phase 2 Bookmarks CTA Standardization)
- `app/bookmarks/page.tsx`
  - 빈 상태 CTA의 `className="button button-dark"`를 `ActionButton`(`variant="dark"`)으로 교체
- Validation:
  - npm run typecheck: PASS
  - npm run lint: PASS
  - npm run build: PASS
- 변경 파일:
  - `app/bookmarks/page.tsx`

## IN_PROGRESS
- 다음 배치 후보:
  - `components/site-nav.tsx`의 네비 라벨 계층 세부 문구 정합성 최종 점검
  - `app/dashboard/page.tsx`의 용어 정합성 보강
