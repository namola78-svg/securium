# UI-3A Implementation Scope Lock

이 문서는 UI-3A 구현 Sprint의 범위를 잠근다. UI-3A는 SECURIUM Console Shell의 가장 작은 안전 구현 단위다.

UI-3A는 전체 관리자 화면 리팩터링이 아니다. Top Bar, Sidebar grouping, Account Drawer, Environment Badge, Admin Dashboard pilot만 다룬다.

구현 직전 파일별 체크리스트는 [UI-3A Implementation Checklist](./ui-3a-implementation-checklist.md)에서 관리한다.

## Scope Verdict

**CONDITIONAL GO**

UI-3A는 시작 가능하지만 다음 범위를 넘지 않는다.

## Allowed Scope

| Area | Allowed Work | Candidate Files |
| --- | --- | --- |
| Console Top Bar | 관리자 전용 상단 Bar 골격 추가 | `app/admin/layout.tsx`, new `components/admin-console-top-bar.tsx` |
| Sidebar Grouping | 기존 AdminNav를 그룹형 IA로 정리 | `components/admin-nav.tsx` |
| Account Drawer | 관리자 계정 메뉴/로그아웃 UI 안정화 | `components/header-controls.tsx` or new `components/account-drawer.tsx` |
| Environment Badge | Production/Preview/Local 표시 컴포넌트 | `components/design-system-primitives.tsx` or shell component |
| Command Palette Entry | Top Bar에서 Command Palette 진입점 정렬 | `components/command-palette.tsx`, `app/layout.tsx` |
| Admin Dashboard Pilot | Shell이 Dashboard에서 깨지지 않는지 확인 | `app/admin/page.tsx` |
| Shell CSS Tokens | 최소 layout token 추가 | `app/globals.css` |

## Explicitly Forbidden in UI-3A

| Forbidden | Reason |
| --- | --- |
| Curriculum page refactor | Tree/Inspector 복잡도가 높음 |
| Ontology page refactor | Explorer/Relation/Inspector 복잡도가 높음 |
| AI Trace refactor | Timeline/Context/Reviewer state 복잡도 높음 |
| Coverage refactor | Matrix/Gap workflow 복잡도 높음 |
| API 변경 | UI-3A는 Shell UI Sprint |
| Repository 변경 | 데이터 접근 변경 금지 |
| DB/Seed/Migration | 운영 영향 금지 |
| Auth/RBAC 정책 변경 | 기존 인증·권한 유지 |
| Business logic 변경 | UI Shell 검증 목적 |
| Vercel 배포 | 별도 승인 전 금지 |

## Existing Components to Reuse First

| Need | Reuse Candidate | Rule |
| --- | --- | --- |
| Sidebar links | `AdminNav` | route 삭제 없이 그룹만 정리 |
| Command search | `CommandPalette` | 새 검색 엔진 만들지 않음 |
| Status/environment badge | `StatusBadge` | tone API 재사용 |
| Dashboard metrics | `MetricCard` | 기존 dashboard card 유지 |
| Page summary | `SectionHeader` | UI-3B 전까지 유지 |
| Account/logout patterns | `HeaderControls` | 기존 Supabase signOut 흐름 보존 |
| State UI | `state-ui.tsx` | loading/empty/error 재사용 |

## UI-3A Component Contract

### ConsoleTopBar

Purpose:

- 관리자 Console의 전역 상태와 빠른 이동을 제공한다.

Slots:

- brand
- sidebar toggle
- command palette trigger
- environment badge
- notification placeholder
- account trigger

Must not:

- page-level primary CTA를 포함하지 않는다.
- secret, DB URL, token, raw environment value를 노출하지 않는다.

### AdminSidebar

Purpose:

- 관리자 도메인 간 이동을 담당한다.

Required groups:

1. Overview
2. Learning Operations
3. Knowledge & AI
4. Administration

Must preserve:

- existing admin routes
- server-side admin layout guard
- active state
- keyboard focus

### AccountDrawer

Purpose:

- 관리자 계정, 학습자 화면 이동, 로그아웃을 제공한다.

Must preserve:

- `await supabase.auth.signOut()`
- error handling
- menu close after action
- router replace/refresh behavior where already used
- no token/log exposure

### EnvironmentBadge

Purpose:

- Production, Preview, Local을 사람이 읽을 수 있는 상태로 표시한다.

Must not:

- DB provider detail
- connection string
- secret name/value
- internal deployment token

## Admin Dashboard Pilot

Dashboard pilot은 Shell이 실제 화면에서 안전한지 확인하는 최소 적용 대상이다.

### Allowed Dashboard Changes

- Shell 영역과 dashboard content 간 spacing 조정
- Top Bar와 Sidebar coexistence 확인
- Dashboard metric card 유지
- Inspector optional state 유지
- Empty/Loading/Error state가 깨지지 않는지 확인

### Forbidden Dashboard Changes

- Dashboard data query 변경
- Admin metrics 계산 변경
- API route 변경
- Repository 변경
- 관리자 권한 정책 변경

## Regression Checklist

| Check | Required |
| --- | --- |
| `/admin` 접근은 여전히 관리자 권한 필요 | Yes |
| 비관리자 접근 차단 유지 | Yes |
| Sidebar link route 유지 | Yes |
| Command Palette 단축키 유지 | Yes |
| 로그아웃 동작 유지 | Yes |
| 모바일에서 navigation 접근 가능 | Yes |
| Top Bar와 Page Header CTA 중복 없음 | Yes |
| Dashboard 기존 내용 표시 | Yes |
| Typecheck 통과 | Yes |
| Lint 통과 | Yes |
| Production build 통과 | Recommended before commit |

## Manual QA for UI-3A

| Viewport | QA |
| --- | --- |
| 360px | Top Bar compact, sidebar drawer, account trigger |
| 390px | No horizontal scroll |
| 768px | Sidebar compact/drawer decision works |
| 1024px | Dashboard content remains readable |
| 1440px | Top Bar + Sidebar + Main spacing stable |
| 1920px | Content width does not become visually loose |

## Rollback Strategy

UI-3A should be easy to revert.

- Keep new shell components isolated.
- Do not move data fetching.
- Do not rewrite admin pages broadly.
- Keep Dashboard pilot changes small.
- Avoid changing route structure.

## UI-3A Exit Criteria

UI-3A is complete only when:

1. ConsoleTopBar exists or is explicitly deferred with reason.
2. Sidebar grouping is documented and implemented without route loss.
3. AccountDrawer preserves logout/session behavior.
4. EnvironmentBadge does not expose secrets.
5. Admin Dashboard pilot works on desktop and mobile.
6. Typecheck passes.
7. Lint passes.
8. Production build passes before commit/deployment.

## Next After UI-3A

Proceed to UI-3B only after Dashboard pilot validation.

UI-3B scope:

- Breadcrumb
- Page Header
- Toolbar
- Main Workspace wrapper

Do not start Curriculum, Ontology, AI Trace, or Coverage migration until UI-3A and Dashboard pilot are accepted.
