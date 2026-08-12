# SECURIUM V2 UI/UX AUDIT

Audit date: 2026-08-11 (Asia/Seoul)

Baseline: `main` / `e3d8293c20127940a9b3d49d912546623b774e77`

Scope: Phase 0 read-only architecture and UX audit. Production V2 redesign is out of scope.

## Executive Summary

Securium은 이미 공개 탐색, 학습자 학습 루프, 관리자 운영 콘솔을 모두 가진 큰 제품이다. 현재 UI는 기능 완성도와 접근성 기반이 양호하지만, 11,310줄의 단일 `app/globals.css`, 71종의 실제 글자 크기 표현, 42종의 radius, 51종의 shadow, 364종의 literal color가 하나의 cascade에 누적되어 있다. 따라서 V2는 기존 전역 토큰을 교체하는 방식이 아니라, 명시적인 opt-in scope 아래에서만 작동하는 독립 foundation으로 시작해야 한다.

핵심 판정은 다음과 같다.

- V2 foundation 준비 필요: **YES**
- 현재 Production 전역 토큰 즉시 교체: **NO**
- 현재 주요 화면의 Phase 1 리디자인: **NO**
- 우선순위: token 격리, typography/spacing/radius/shadow 계약, focus/motion 계약, primitive API 정리, 시각 회귀 방지
- 현재 UI의 강점: 실제 학습 행동 중심 Dashboard, 공식 커리큘럼 연결, 문제 제출→해설→오답/AI 흐름, 접근 가능한 drawer/navigation 기반
- 현재 UI의 주요 위험: 거대한 전역 cascade, legacy와 primitive 병존, 작은 metadata 글자, 분산된 breakpoint, 44px 미만 touch target, 일부 shell/heading 중복

## A. Repository Scope

### A.1 Git and artifact baseline

| 항목 | 결과 |
| --- | --- |
| Branch | `main` |
| HEAD | `e3d8293c20127940a9b3d49d912546623b774e77` |
| Tracked modification | 0 |
| Staged modification | 0 |
| Untracked | `.playwright-mcp/` |
| 보호 대상 artifact | `.playwright-mcp/`, 기존 screenshot, `test-results/`, `reports/`, `docs/`, Content V3 산출물 |

`.playwright-mcp/`와 기존 이미지/보고서는 사용자 소유 산출물로 간주하며 이번 작업에서 수정·삭제·이름 변경하지 않는다.

### A.2 Actual file inventory

| 영역 | 파일 수 | 주요 확장자/비고 |
| --- | ---: | --- |
| `app/**` | 140 | TSX 76, TS 63, CSS 1 |
| `components/**` | 50 | TSX 50 |
| `lib/**` | 68 | TS 59 포함 |
| `db/**` | 44 | TS 31 포함; 이번 작업 변경 금지 |
| `tests/**` | 68 | TS 57, MJS 11 |
| `scripts/**` | 37 | DB/Content V3 스크립트 포함; 변경 금지 |
| `public/**` | 5 | 정적 asset |
| `docs/**` | 163 | 기존 제품·UI·운영 문서 포함 |

App Router 특별 파일:

| 파일 | 수 |
| --- | ---: |
| `page.tsx` | 71 |
| `route.ts` | 60 |
| `layout.tsx` | 2 |
| `loading.tsx` | 1 |
| `error.tsx` | 1 |
| `not-found.tsx` | 1 |

### A.3 Frontend/configuration

- Next.js 16.2.6 App Router, React 19.2.6, TypeScript 5.9.3.
- Tailwind CSS 4는 `@import "tailwindcss"`와 PostCSS plugin으로 연결되며 별도 `tailwind.config.*`는 없다.
- `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.json`, `proxy.ts`, `vite.config.ts`, `wrangler.local.jsonc`, `.openai/hosting.json`이 존재한다.
- 별도 Playwright config는 없고, Node test와 D1/Vinext 기반 custom E2E runner를 사용한다.
- `proxy.ts`가 인증 보호와 `return_to` 계약을 담당한다. 이는 UI foundation 범위에서 변경하지 않는다.

## B. Route Inventory

### B.1 Route counts

| Access group | Page count | Shell/access 메모 |
| --- | ---: | --- |
| Public/Auth | 14 | Root `SiteHeader` + footer; 일부 optional-user redirect |
| Learner/Course | 28 | Root shell, 인증 route는 `proxy.ts`와 server guard 사용 |
| Admin | 27 | `app/admin/layout.tsx` + `AdminConsoleShell`; 관리자 guard |
| Operations | 2 | 운영 상태 화면 |
| API | 60 | UI route가 아닌 Route Handler |

### B.2 Public/Auth pages

`/`, `/about`, `/courses`, `/courses/[courseSlug]`, `/guide`, `/legal`, `/legal/privacy`, `/legal/terms`, `/login`, `/privacy`, `/signup`, `/specialized/[courseSlug]`, `/specialized/[courseSlug]/[contentType]/[contentId]`, `/terms`

Public shell은 `app/layout.tsx`의 `SiteHeader`, `CommandPalette`, main-content target, footer/legal navigation을 공유한다. `/`은 로그인 사용자를 `/dashboard`로 보내며 비로그인 사용자에게 랜딩을 제공한다.

### B.3 Learner pages

`/dashboard`, `/ai-tutor`, `/analytics`, `/analytics/[courseId]`, `/bookmarks`, `/content-versions/[revisionId]`, `/learn/[courseSlug]`, `/learn/[courseSlug]/course-lessons/[courseLessonId]`, `/learn/[courseSlug]/lessons/[lessonId]`, `/learn/[courseSlug]/levels/[levelId]`, `/learn/[courseSlug]/subjects/[subjectId]`, `/lectures/[courseSlug]`, `/lectures/[courseSlug]/[lectureId]`, `/mock-exams`, `/mock-exams/[mockExamId]`, `/mock-exams/attempts/[attemptId]`, `/my-courses`, `/my-learning`, `/practical`, `/practical/[courseSlug]`, `/practical/[courseSlug]/code/[sampleId]`, `/practical/[courseSlug]/privacy/[scenarioId]`, `/practice`, `/practice/[courseSlug]`, `/profile`, `/reviews`, `/settings`, `/wrong-notes`

`/learn/**`는 course context repository/loader를 통해 접근 상태를 결정하고, 나머지 핵심 learner route는 주로 `requireCurrentAppUser`를 사용한다. 기존 access/redirect 계약은 유지 대상이다.

### B.4 Admin pages

`/admin`, `/admin/ai-explainability`, `/admin/ai-reviews`, `/admin/analytics`, `/admin/audit-logs`, `/admin/content-revisions`, `/admin/course-groups`, `/admin/courses`, `/admin/courses/[courseId]`, `/admin/courses/[courseId]/subjects`, `/admin/coverage`, `/admin/curriculum`, `/admin/lessons`, `/admin/lessons/[lessonId]/preview`, `/admin/levels`, `/admin/mock-exams`, `/admin/mock-exams/[mockExamId]`, `/admin/ontology`, `/admin/practical-specializations`, `/admin/question-reports`, `/admin/questions`, `/admin/questions/[questionId]`, `/admin/questions/new`, `/admin/reviews`, `/admin/shared-content`, `/admin/specialized`, `/admin/subjects/[subjectId]/topics`

Admin은 별도 `AdminConsoleShell`을 사용한다. Sidebar는 운영, 과정, 커리큘럼·콘텐츠, 문제·평가, 지식·AI, 특화 과정의 6개 그룹으로 나뉜다.

### B.5 Operations and API

Operations pages: `/ops/health`, `/ops/dashboard-performance`.

API는 auth, enrollment/progress, question/review/bookmark, mock exam, AI, practical, specialized, admin CRUD/operation의 60개 handler로 구성된다. Phase 0~1에서 contract나 handler를 변경하지 않는다. 전체 실제 목록은 기존 [UI route inventory](./ui-route-inventory.md)와 현재 `app/**/route.ts`가 기준이다.

### B.6 Route boundaries

- Root: `app/layout.tsx`, `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`.
- Admin: `app/admin/layout.tsx`.
- Route별 `loading.tsx`/`error.tsx`가 없어 root boundary 의존도가 높다.
- 신규 V2 route는 Phase 1 범위가 아니다.

## C. Public Shell

구성: sticky dark header, brand lockup, 공개 3개 navigation, auth CTA, signed-in primary/utility navigation, mobile drawer, command palette trigger, legal footer.

장점:

- Brand link와 navigation에 접근 가능한 이름이 있다.
- mobile drawer는 focus 순환, Escape 닫기, focus 복귀, scroll lock을 구현한다.
- 현재 위치는 `aria-current="page"`로 전달된다.
- desktop, drawer, bottom navigation의 항목은 `lib/ui-nav.ts`에서 중앙 관리한다.

위험/개선 후보:

- `HeaderControls`가 navigation, auth CTA, account menu, drawer, bottom nav까지 500줄 이상에서 함께 책임져 복잡도가 높다.
- `SiteNav`는 별도 구현이지만 현재 직접 consumer가 확인되지 않아 중복/deprecation 후보이다.
- Desktop에서는 primary 5개 + public 3개 + utility 5개가 동시에 노출될 수 있어 signed-in header가 과밀해진다.
- 390px 기존 캡처에서 landing preview panel이 hero copy보다 먼저 배치되어 첫 viewport가 제품 설명 카드에 대부분 소비된다.
- dark context용 버튼 override가 전역 variant 위에 추가되어 있어 cascade 순서에 민감하다.
- Footer는 legal/about만 제공하며 제품 navigation과 역할은 명확히 분리되어 있다.

## D. Learner Shell

구성: root sticky header, desktop primary navigation, utility navigation, profile menu, mobile drawer, signed-in 전용 5-item bottom navigation.

Navigation depth:

1. Header primary: Dashboard, 이론 학습, 문제풀이, 실무, 내 학습.
2. Utility: AI 튜터, 북마크, 오답노트, 복습, 학습 분석.
3. Mobile bottom: 홈, 학습, 문제, 실무, 내 학습.
4. Mobile drawer: primary + utility + account actions.

평가:

- 모바일은 desktop을 단순 축소하지 않고 drawer와 bottom nav를 별도로 제공하므로 실제 mobile adaptation에 가깝다.
- 다만 같은 목적지들이 desktop primary/utility, drawer, bottom nav, `/my-learning` quick links에서 반복된다.
- learner 전용 sidebar는 없다. 현재 구조에서는 이 선택이 콘텐츠 폭을 확보한다는 장점이 있다.
- breadcrumb는 learn route에서 page-local link로 구현되고 공용 `Breadcrumbs`는 주로 admin에 사용된다.
- notification UI는 확인되지 않았다.

## E. Admin Shell

구성: `AdminConsoleShell` → responsive sidebar + top bar + workspace. Top bar에는 environment badge와 account drawer가 있다.

장점:

- learner shell과 분리된 console navigation 구조이다.
- 960px 이하에서 sidebar drawer로 전환하며 focus trap, Escape, scroll lock, focus restore를 지원한다.
- `SectionHeader`, `PageToolbar`, `WorkspaceLayout`, `InspectorPanel` 계열이 admin 화면의 공통 언어로 널리 사용된다.

위험/개선 후보:

- `AdminConsoleTopBar` 자체가 `h1`을 사용하고, 다수 admin page의 `SectionHeader`도 `h1`을 생성해 한 화면에 두 H1이 생길 가능성이 높다.
- sidebar에는 6개 그룹과 20개 이상의 링크가 있어 운영자에게는 유효하지만 mobile에서 탐색량이 많다.
- `admin-record-list`를 사용하는 파일이 18개, `admin-form` 계열이 14개인 반면 table primitive는 통합되지 않았다.
- account drawer와 learner profile menu가 유사한 계정 기능을 별도 구현한다.
- Admin V2는 learner V2와 별도 migration track으로 유지해야 한다.

## F. Navigation

| Pattern | Source | 상태 | 판정 |
| --- | --- | --- | --- |
| Public/learner desktop nav | `HeaderControls`, `ui-nav.ts` | 사용 중 | KEEP |
| Mobile drawer | `HeaderControls` | 사용 중, a11y 기반 양호 | KEEP |
| Mobile bottom nav | `HeaderControls`, `ui-nav.ts` | 사용 중 | KEEP; Phase 2 이후 검토 |
| Standalone `SiteNav` | `components/site-nav.tsx` | consumer 없음 | DEPRECATE 후보 |
| Admin sidebar | `AdminNav`, `AdminConsoleShell` | 사용 중 | KEEP, learner와 분리 |
| Breadcrumb | page-local + shared `Breadcrumbs` | 이중 구현 | REFACTOR 후보 |
| Account menu | header profile menu + admin account drawer | 이중 구현 | REFACTOR 후보 |
| Command palette | root layout | cross-product | KEEP, 별도 QA 필요 |

## G. Design System Inventory

### G.1 Existing shared primitives

| Primitive | Path | Consumers/usage | Variant/tone/size | CSS dependency | Accessibility | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| `ActionButton` | `components/design-system-primitives.tsx` | 50개 이상 import site의 주요 CTA | primary, secondary, outline, ghost, danger, dark; sm/md/lg | `.ds-button`, `.variant-*`, legacy `.button` override | disabled link 차단, busy, native button | KEEP; V2 adapter 필요 |
| `StatusBadge` | same | Admin status, environment | neutral/success/warning/danger/info/brand; compact | `.status-badge`, `.tone-*` | text로 상태 병행 | KEEP |
| `MetricCard` | same | Admin/learner metric | 단일 | `.stat-card`, `.ds-metric-card` | label/value 구조 | KEEP |
| `Panel` | same | Admin panel | 단일 | `.admin-panel`, `.ds-panel` | section landmark | KEEP |
| `Breadcrumbs` | same | Admin header | current/href | `.ds-breadcrumbs` | nav label, aria-current | REFACTOR: Next Link 검토 |
| `SectionHeader` | same | 다수 admin page | eyebrow/description/actions | `.admin-page-header`, `.ds-section-header` | header + h1 | KEEP; shell H1 충돌 수정은 후속 |
| `PageToolbar` | same | Admin filters/actions | primary/secondary | `.ds-page-toolbar*` | 구조적 group label은 consumer 의존 | KEEP |
| `WorkspaceLayout` | same | Admin split layout | inspector optional | `.ds-workspace-*` | semantic은 child 의존 | KEEP |
| `DrawerSurface` | same | 제한적 | open/closed | `.ds-drawer-*` | aria-hidden/label | REVIEW: 닫힌 child focusability |
| `InspectorPanel/Section` | same | Admin detail/evidence | badges/meta/actions | `.ds-inspector-*` | aside label, headings | KEEP |
| `ProgressBar` | `components/progress-bar.tsx` | 7개 file | value/label | `.progress-wrap/track/label` | progressbar min/max/now/text | KEEP |
| State components | `components/state-ui.tsx` | 17개 file | loading/empty/error/retry | `.state-*`, `.empty-state` | live/status/alert | KEEP |

### G.2 Missing or fragmented primitives

| Requested family | Current state |
| --- | --- |
| Button | Shared `ActionButton` 있음; raw `.button` 병존 |
| Badge | `StatusBadge`, `.badge`, `.status-on/off`, course status 병존 |
| Card | Course/review/action/stat/admin card가 page/class 단위로 분산 |
| Progress | `ProgressBar` 있음; practice/mock/analytics inline track 병존; ring 없음 |
| Tabs | 범용 primitive 없음 |
| Input/Select/Textarea | form-local markup/CSS 중심 |
| Checkbox/Radio | practice/admin form-local 구현 |
| Empty/Loading/Error | shared state component 있음 |
| Section heading | learner page-local + admin `SectionHeader` 이원화 |
| Modal/Dialog | Command palette와 account drawer의 목적별 구현만 있음 |
| Drawer | Header/admin shell/account에서 각자 구현; generic foundation은 불완전 |
| Dropdown | Header profile menu 구현만 있음 |
| Tooltip | 범용 primitive 없음; `title` 의존 구간 존재 |
| Toast | 없음; inline message 사용 |
| Table | Admin page-local table/list 중심 |
| Pagination | page-local/admin 중심 |

### G.3 Duplication classification

| Pattern | 판정 | 근거 |
| --- | --- | --- |
| `ActionButton` | KEEP | 가장 넓은 consumer와 안정된 API |
| raw `.button` CTA | DEPRECATE gradually | shared primitive와 variant가 중복 |
| `StatusBadge` | KEEP | tone API 존재 |
| `.badge`, `.status-*`, course status | REFACTOR | 의미가 겹치지만 즉시 migration 금지 |
| `ProgressBar` | KEEP | ARIA 포함 |
| inline `.progress-track` | REFACTOR | practice/analytics와 공용 구현 중복 |
| State UI | KEEP | loading/empty/error 기반 양호 |
| page-local empty state markup | DEPRECATE gradually | shared `EmptyState`와 중복 |
| learner/admin section heading | KEEP separate initially | 사용 맥락과 정보 밀도가 다름 |
| account/profile menus | REFACTOR | focus/close 로직 중복 |
| mobile drawers | KEEP separate initially | shell별 책임이 다르며 성급한 generic화 위험 |

## H. CSS and Token Inventory

### H.1 Global CSS size and cascade

`app/globals.css`는 11,310줄이다. 명시적 section comment는 매우 적고, 동일 selector family와 breakpoint가 파일 여러 위치에서 재정의된다. 특히 landing 관련 규칙과 후반 responsive override가 앞선 규칙을 다시 덮는다. V2 foundation은 이 파일의 기존 값을 수정하지 않고 독립 파일 또는 opt-in layer/scope로 추가해야 한다.

### H.2 Existing `:root` tokens

Color:

`--color-background`, `--color-surface`, `--color-surface-soft`, `--color-surface-elevated`, `--color-surface-overlay`, `--color-surface-dark`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse`, `--color-line`, `--color-line-strong`, `--color-brand`, `--color-brand-strong`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`.

Spacing:

`--spacing-0/1/2/3/4/6/8/12/16/24` = 0, 4, 8, 12, 16, 24, 32, 48, 64, 96px.

Radius:

`--radius-sm/md/lg/xl/pill` = 8, 12, 16, 22, 999px.

Shadow/motion:

`--shadow-soft`, `--shadow-card`, `--shadow-focus`, `--motion-fast`, `--motion-base`, `--motion-ease`.

Legacy aliases:

`--ink`, `--ink-soft`, `--paper`, `--white`, `--line`, `--muted`, `--lime`, `--lime-deep`, `--aqua`, `--warm`, `--danger`, `--text`, `--text-muted`, `--surface`, `--surface-soft`, `--surface-dark`, `--accent`, `--accent-strong`, `--success`, `--warning`, `--error`.

### H.3 Hardcoded color audit

| Metric | Result |
| --- | ---: |
| CSS literal color occurrences | 591 |
| Distinct CSS literal color expressions | 364 |
| TSX literal color lines | 0 |

분류:

- TOKEN CANDIDATE: 반복되는 neutral surface/line/text와 lime alpha.
- SEMANTIC: success/warning/danger/info, AI purple, completion blue.
- LEGACY: `#fff`, `#ffffff`, 다수 유사 gray/green이 별도로 존재.
- DARK CONTEXT: charcoal/navy surface와 white alpha border/text.
- DECORATIVE: landing glow, gradient, AI preview accents.
- POTENTIAL RISK: dark context에서 global button/text variant를 override하는 selector와 서로 다른 white alpha 조합.

TSX에 literal color가 없다는 점은 긍정적이다. 문제는 CSS 내부 token adoption이 낮다는 것이다.

### H.4 Typography inventory

| 표현 | 발생 횟수 | 주요 용도/위험 |
| --- | ---: | --- |
| 13px | 56 | metadata, label, navigation 보조문구 |
| 12px | 47 | caption, badge, status, table metadata |
| 11px | 33 | compact metadata, flow label, card footer |
| 10px | 5 | admin/nav/hero preview의 극소형 label |
| 14px | 28 | compact body/control |
| 15px | 10 | body/control |
| 16px | 8 | body |
| 18px | 15 | subheading/control |
| 20px | 9 | card heading |
| 22px | 14 | heading |
| 24px | 7 | heading |
| 30px | 1 | heading |
| 36px | 1 | heading |

Clamp/rem까지 포함하면 실제 font-size 표현은 71종이다. 10~11px는 P1/P2 후보이며, 특히 Korean readability와 mobile zoom 환경에서 취약하다. 이번 Phase에서는 대량 치환하지 않는다.

### H.5 Spacing, radius, shadow

| Metric | Distinct expressions |
| --- | ---: |
| gap | 70 |
| padding 계열 | 161 |
| margin 계열 | 110 |
| border-radius | 42 |
| box-shadow | 51 |

기본 token scale은 단정하지만 실제 화면은 arbitrary value를 광범위하게 사용한다. 카드 radius는 12/14/16/18/20/22/24px와 rem 값이 혼재하고, shadow도 유사한 soft shadow가 alpha와 blur만 달리한 채 반복된다.

### H.6 Breakpoint inventory

| Breakpoint | 등장 횟수 | 주요 목적 |
| --- | ---: | --- |
| 375px | 1 | landing 극소형 보정 |
| 520px | 1 | curriculum summary |
| 560px | 1 | audit/admin filter |
| 640px | 5 | landing, lecture, curriculum, practical |
| 680px | 9 | global/mobile shell, landing, specialized, content |
| 760px | 3 | curriculum/dashboard/practical |
| 820px | 1 | landing hero |
| 900px | 4 | lecture/specialized/practical/admin |
| 960px | 2 | admin and global shell |
| 1024px | 2 | landing/dashboard; 두 media syntax 사용 |
| 1100px | 1 | landing hero |
| reduced motion | 3 | global/landing/practical |

`max-width`와 range syntax(`width <=`)가 혼재한다. 640/680과 900/960의 역할이 겹치며 동일 landing hero가 여러 구간에서 재정의된다. Phase 1에서 breakpoint 통합은 하지 않고, V2 token에 명명된 breakpoint 계약만 문서화하는 편이 안전하다.

## I. Information Architecture Audit

현재 UI는 기능 삭제가 필요한 상태라기보다, 같은 기능으로 들어가는 진입점이 많아 표현 구조를 단순화할 필요가 있다.

| 영역 | 현재 책임 | 중복/복잡도 |
| --- | --- | --- |
| Dashboard | 오늘 행동, 과정, 기록 요약 | analytics/review/my-learning 정보와 일부 중복 |
| Learn | 이어 학습, 문제, 복습, 분석, curriculum, lesson, level, practical, mock | 한 화면에서 여러 학습 모델이 경쟁 |
| Practice | 과정 선택, filter, question, grade, AI, report | 기능은 완결적이나 화면 focus가 복잡해질 수 있음 |
| Reviews | 시간 기반 복습 일정 | Wrong Notes와 목적이 인접하지만 우선순위/일정으로 구분 가능 |
| Wrong Notes | 틀린 문제 기록/메모/재풀이 | Reviews와 상호 링크 필요 |
| Analytics | 통합/과정별 성과와 추천 행동 | Dashboard metric과 중복 |
| Mock Exam | 시험 선택→안내→응시→결과 | Practice component 패턴 일부 재사용 가능 |
| AI Tutor | 독립 안내와 contextual explanation | 실제 가치가 context 안에서 더 강함 |

기능 구조를 사용자에게 그대로 노출하는 대표 지점은 `/learn/[courseSlug]`의 curriculum, lesson, level, practical, mock exam 병존과 signed-in navigation의 13개 내외 진입점이다. 기능 삭제와 표현 단순화는 구분해야 하며, Phase 0~1에서는 둘 다 구현하지 않는다.

## J. Dashboard Audit

- 주요 section: hero/action rail, 오늘 계획, 진행 중 과정, 학습 현황.
- 고정 카드: 오늘 계획 4개 + 과정 카드 N개 + stat 4개.
- Primary action은 `next` 추천과 오늘 문제 CTA로 명확하다.
- 사용자는 5초 이내에 “지금 무엇을 공부해야 하는가”를 이해할 가능성이 높다. hero 안에서 다음 행동과 CTA가 직접 제공된다.
- 다만 hero 요약, 오늘 계획, stats에서 문제/복습/진도가 반복되어 아래쪽 정보 밀도가 높다.
- AI는 dashboard primary surface에 직접 노출되지 않아 현재 우선순위는 적절하다.

판정: **KEEP STRUCTURE / Phase 2에서 hierarchy refinement**.

## K. Learn Audit

`/learn/[courseSlug]`에는 hero, 진행 요약, 4개 action card, 공식 curriculum tree, 공식 학습 콘텐츠, 비보안 과정 subject list, 단계 학습, 실무, 모의고사가 존재한다.

- Security certification course는 기존 taxonomy 기준에 따라 필기/실기를 첫 선택으로 표시한다.
- “필요한 범위부터 선택” subject block은 security certification course에서 조건상 숨겨진다.
- 오늘 행동과 공식 curriculum이 모두 상단 주요 구조여서 학습 진입은 좋다.
- Curriculum, CourseLesson, legacy level, practical, mock exam이 한 route 안에서 서로 다른 학습 모델로 보일 수 있다.
- 내부 명칭은 상당 부분 `publicCopy`로 정리되지만, 화면 구조 자체의 개념 수는 많다.

판정: **P1 audit finding / Phase 2 이후 presentation simplification**.

## L. Practice and Explanation Audit

### L.1 Practice flow

과정 선택 → filter → context summary → question → answer submit → grade → AI reference → next/finish → review 연결 구조이다.

강점:

- radio/checkbox/short answer를 실제 question type에 따라 분리한다.
- 제출 중복 방지와 idempotency key가 있다.
- bookmark, report, result, session completion이 한 흐름에 있다.
- 진행률, 남은 문제, disabled 상태가 명시된다.

위험:

- global header/mobile bottom nav가 문제 집중 화면에도 유지된다.
- question card 안에 toolbar, content, choices, grade, AI, report, navigation이 누적된다.
- practice progress는 공용 `ProgressBar`가 아니라 별도 `.progress-track` markup이다.
- 일반 practice에는 timer가 없고 mock exam에만 timer가 있다. 이는 기능상 합리적이다.

### L.2 Explanation support

| 요구 | 현재 지원 |
| --- | --- |
| 정답 여부 | 지원 |
| 정답 | 지원 |
| 왜 정답인지 | 공식 해설로 지원 |
| 다른 선택지가 왜 틀렸는지 | 기본 wrong explanation + AI wrong reasons |
| 핵심 개념 | 제한적; 현재 “관련 개념”은 question type/difficulty 표시 |
| 시험 포인트 | AI/공식 해설 내용에 의존 |
| 관련 개념 | canonical concept UI 연결은 확인되지 않음 |
| 관련 문제 | AI result type에는 있으나 현재 panel에 직접 렌더링되지 않음 |
| 오답노트 | backend 자동 기록/별도 route 연결 |
| AI 질문 | “AI 참고 설명 확인” 지원 |
| 공식 근거 | `EvidenceCard`와 version/review date 지원 |
| source/provenance | 내부 source 목록을 details로 지원; 원본 provenance 전체 노출은 아님 |

판정: 학습 loop는 강하지만 concept/relearning 연결의 presentation은 향후 강화 대상이다.

## M. Review and Wrong Notes Audit

- `/reviews`: due/overdue/estimated/completed, completion progress, 다음 행동, 과정별 복습, 우선순위 inspector.
- `/wrong-notes`: 과정/과목/주제/난이도/반복/숙련 filter, memo, mastered, bookmark, 재풀이.
- 책임은 각각 “언제 복습할 것인가”와 “무엇을 틀렸는가”로 구분 가능하다.
- navigation과 copy에서는 오답 복습/오답노트/복습이 혼용될 여지가 있다.
- 두 route 모두 `/practice`를 실행 surface로 재사용한다는 점은 일관적이다.

판정: **KEEP 기능 분리 / terminology와 cross-link를 후속 정리**.

## N. Mock Exam Audit

- 시험 선택 카드가 문제 수, 시간, 최고 점수, 남은 응시 횟수를 제공한다.
- session은 server expiration 기반 timer, 자동 답안 저장, numbered question nav, submit, score, analysis를 제공한다.
- `aria-current="step"`, answer status label, live answered count가 있다.
- Practice와 answer choices/grade/analysis 시각 패턴을 공유하지만 component/API는 별도이다.
- 실제 시험 focus를 위해 global learner navigation visibility를 후속 검토할 수 있으나 Phase 1 변경 대상은 아니다.

## O. Analytics Audit

현재 통합 분석은 전체 정답률, 학습량, 과정별 상태, 취약 우선 행동, practice/review CTA를 제공한다.

- Dashboard와 accuracy/progress/review count가 중복된다.
- Analytics는 “왜/어디가 취약한가”, Dashboard는 “지금 무엇을 할 것인가”로 책임을 더 선명히 나눌 수 있다.
- chart는 복잡한 외부 visualization보다 progress/bar 기반이 중심이라 현재 bundle/접근성 위험은 낮다.

## P. AI Tutor Audit

현재 AI는 standalone `/ai-tutor` route와 문제 채점 후 contextual explanation에 모두 존재한다. 실제 사용자 가치가 가장 명확한 지점은 채점 직후의 “왜 틀렸는지” 설명이다.

판정: **Contextual Helper에 가장 가까움**.

후속 후보: 쉽게 설명, 왜 틀렸는지, 비슷한 문제, 시험 출제 방식, 공식 근거. Phase 0~1에서는 구현하지 않는다.

## Q. Mobile UX Audit

강점:

- 전용 mobile header/drawer와 signed-in bottom navigation이 있다.
- safe-area bottom padding을 적용한다.
- drawer는 focus/scroll/Escape 처리를 제공한다.
- 주요 grid는 1열로 바뀌고 filter/action은 wrapping 또는 stacking한다.

위험:

- 640/680/760 등 인접 breakpoint가 같은 화면을 연속 override한다.
- 34/36/38/40/42px 높이의 interactive control 규칙이 여러 곳에 있어 WCAG 2.2 target size 관점에서 검토가 필요하다.
- 390px landing에서 preview panel이 첫 화면을 차지해 핵심 value proposition과 CTA가 아래로 밀린다.
- bottom nav와 sticky header를 동시에 쓰는 learner page는 vertical space가 줄어든다.
- dense admin table/filter는 CSS stacking에 의존하며 실제 360/390 keyboard/zoom QA가 필요하다.

판정: 단순 desktop 축소는 아니지만, mobile-first hierarchy가 모든 화면에 일관되게 적용된 상태는 아니다.

## R. Accessibility Audit

코드 계측:

| Signal | Count |
| --- | ---: |
| `aria-label` | 170 |
| `aria-current` | 8 |
| `aria-expanded` | 6 |
| `aria-controls` | 6 |
| `<main>` | 49 |
| `<nav>` | 12 |
| `<header>` | 28 |
| `<footer>` | 3 |
| `<article>` | 56 |
| `<h1>` | 48 |
| `<h2>` | 156 |
| input/select/textarea lines | 309 |
| label lines | 272 |

Strengths:

- root skip link와 admin skip link가 있다.
- global `:focus-visible`과 component-specific focus style이 있다.
- reduced-motion rule이 존재한다.
- mobile/admin drawer와 command palette에 Escape/focus 관리가 있다.
- current navigation, expanded state, progress, live status, error alert를 전달한다.
- 대부분 form control이 label 또는 aria-label을 사용한다.

Risks:

- Admin top bar H1과 page H1의 중복 가능성.
- 71 page 중 모든 page가 자체 H1을 갖는 것은 아니며 shell heading 의존 여부를 route별 확인해야 한다.
- 44px 미만 control 높이가 다수 존재한다.
- 10~11px Korean text의 가독성.
- `DrawerSurface`가 closed 상태에도 DOM/focusable child를 유지할 수 있다.
- title tooltip은 keyboard/touch에서 일관된 설명 수단이 아니다.
- automated contrast/axe와 screen reader journey는 이번 정적 audit만으로 PASS 처리할 수 없다.

Accessibility verdict: **FOUNDATION PRESENT, FULL WCAG VERIFICATION PENDING**.

## S. SEO and Semantic UI Audit

- Root metadata가 존재하며 host/config 기반으로 생성된다.
- `app/sitemap.ts`, `app/robots.ts`가 존재한다.
- course detail에는 기존 metadata/semantic SEO 작업이 있다.
- root layout은 semantic header/footer를 제공하고 page들은 대체로 main/section/article을 사용한다.
- admin은 shell top bar와 page header의 heading hierarchy를 재검토해야 한다.
- SEO 전면 수정은 Phase 0~1 범위가 아니다.

## T. Priority Findings

### P0 — Foundation safety

1. V2 token을 기존 `:root` 값 위에 덮어쓰지 않는다.
2. V2 opt-in scope/layer가 없으면 Production visual regression 위험이 높다.
3. `globals.css` cascade snapshot과 주요 공개 route screenshot baseline이 필요하다.
4. Content V3, DB, taxonomy, auth, route contract는 UI 테스트 실패 해결 수단으로 사용하지 않는다.

### P1 — Design-system readiness

1. 10~11px typography 사용처와 44px 미만 touch target을 inventory로 관리한다.
2. primitive API와 legacy class의 역할을 문서화한다.
3. V2 color/typography/space/radius/shadow/focus/motion token을 namespaced/opt-in으로 정의한다.
4. admin heading hierarchy와 closed drawer focusability를 별도 accessibility backlog에 둔다.
5. semantic aliases는 raw palette와 분리한다.

### P2 — Later screen migration

1. signed-in navigation density.
2. Learn 화면의 curriculum/lesson/level/practical/mock hierarchy.
3. Practice focus mode와 concept/relearning explanation.
4. Dashboard/Analytics/Review 정보 중복.
5. breakpoint consolidation과 page-by-page mobile adaptation.

## U. Phase 1 Entry Guard

Phase 1 구현은 다음 조건을 따라야 한다.

- 기존 `:root` token 값 변경 금지.
- 기존 selector에 V2 값 적용 금지.
- production screen에 V2 class 부착 금지.
- 신규 foundation은 명시적인 namespace 또는 opt-in container에서만 활성화.
- 최소 primitive를 만들더라도 기존 consumer를 migration하지 않음.
- visual regression 검증은 기존 public baseline과 computed style 중심으로 수행.
- Phase 2 화면 redesign을 선행하지 않음.

프롬프트의 Phase 1 상세 지시가 현재 전달본에서 `## H. CSS` 이후 누락되어 있으므로, 구체적인 token naming/file layout/test artifact는 나머지 master prompt를 확인한 뒤 확정한다.

## V. Phase 0 Verdict

**PHASE 0 AUDIT COMPLETE — PHASE 1 SPEC CONTINUATION REQUIRED**

현재 Production 화면을 변경하지 않고 repository, route, shell, navigation, component, CSS, IA, core learning flow, mobile, accessibility, semantic UI를 조사했다. 다음 단계는 누락된 Phase 1 master prompt를 받아 V2 foundation만 격리 구현하고, 검증 후 반드시 정지하는 것이다.
