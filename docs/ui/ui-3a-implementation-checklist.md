# UI-3A Implementation Checklist

UI-3A 구현 직전 체크리스트다. 이 문서는 구현 순서, 파일별 변경 예정, 테스트, rollback 기준, 커밋 단위를 잠근다.

UI-3A의 목표는 Console Shell의 최소 골격을 안전하게 구현하고 Admin Dashboard에서만 pilot 검증하는 것이다.

## Scope Summary

Allowed:

1. ConsoleTopBar
2. AdminSidebar grouping
3. AccountDrawer
4. EnvironmentBadge
5. Command Palette entry alignment
6. Admin Dashboard pilot spacing/state validation
7. Minimal Shell CSS tokens

Forbidden:

- Curriculum refactor
- Ontology refactor
- AI Trace refactor
- Coverage refactor
- API 변경
- Repository 변경
- DB / Seed / Migration
- Auth/RBAC 정책 변경
- 비즈니스 로직 변경
- 배포

## File-Level Work Plan

| File | Action | Allowed Change | Forbidden Change | Risk |
| --- | --- | --- | --- | --- |
| `app/admin/layout.tsx` | Modify | ConsoleTopBar slot 추가, existing admin guard 유지 | auth guard 변경, route 구조 변경 | Medium |
| `components/admin-nav.tsx` | Modify | 그룹형 IA, active/focus/accessibility 개선 | 기존 route 삭제 | Medium |
| `components/admin-console-top-bar.tsx` | New | 관리자 Top Bar client/server boundary 결정 후 생성 | DB/env secret 표시 | Low |
| `components/account-drawer.tsx` | New or defer | 기존 logout 흐름 보존한 계정 drawer | Supabase auth 로직 재작성 | Medium |
| `components/design-system-primitives.tsx` | Extend | EnvironmentBadge 또는 shell badge 보조 primitive | 기존 API breaking change | Low |
| `components/command-palette.tsx` | Minimal modify | Top Bar trigger와 충돌 없게 조정 | command routing 대규모 변경 | Medium |
| `app/admin/page.tsx` | Minimal modify | Dashboard pilot spacing과 shell compatibility 확인 | data query/metric 로직 변경 | Low |
| `app/globals.css` | Modify | shell layout tokens, topbar/sidebar/account drawer style | global reset 대규모 변경 | Medium |

## Implementation Sequence

### Step 1. Baseline Verification

Run before editing:

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

Optional if time permits:

```powershell
npm.cmd run build
```

### Step 2. Create ConsoleTopBar

Checklist:

- [ ] Shows SECURIUM Admin identity
- [ ] Provides sidebar/menu trigger placeholder
- [ ] Provides Command Palette trigger
- [ ] Shows EnvironmentBadge without secrets
- [ ] Provides notification placeholder
- [ ] Provides account trigger
- [ ] Does not include page-level Primary CTA
- [ ] Mobile compact state defined

### Step 3. Group AdminSidebar

Checklist:

- [ ] Overview group
- [ ] Learning Operations group
- [ ] Knowledge & AI group
- [ ] Administration group
- [ ] Existing route list preserved
- [ ] Active state visible
- [ ] Keyboard focus visible
- [ ] Collapsed/mobile behavior does not hide access

### Step 4. Add AccountDrawer

Checklist:

- [ ] Shows user display name
- [ ] Shows role/admin context without exposing token
- [ ] Links to profile/settings if existing routes are safe
- [ ] Admin screen link visible only in admin shell context
- [ ] Logout preserves existing Supabase signOut flow
- [ ] Logout loading/disabled state
- [ ] ESC close
- [ ] Focus return to trigger

### Step 5. Add EnvironmentBadge

Checklist:

- [ ] Production / Preview / Local display
- [ ] No DB URL
- [ ] No token
- [ ] No secret name/value
- [ ] Safe fallback when environment unknown

### Step 6. Admin Dashboard Pilot

Checklist:

- [ ] Dashboard content still renders
- [ ] Existing metric cards still visible
- [ ] Existing inspector/summary region still readable
- [ ] Shell spacing stable at 1440px
- [ ] Mobile 360/390 has no horizontal scroll
- [ ] Loading/empty/error states not degraded

## Test Plan

### Automated

Required:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Optional if relevant tests exist:

```powershell
npm.cmd test -- --runInBand
```

Do not mark missing scripts as passed. Check `package.json` if a command is unavailable.

### Manual

| Scenario | Expected |
| --- | --- |
| Non-admin visits `/admin` | access still blocked |
| Admin visits `/admin` | Dashboard renders in new shell |
| Sidebar route click | route works, active state updates |
| Command Palette opens | `Ctrl/Cmd + K` still works |
| Account drawer opens | focus moves into drawer |
| Logout | existing session/logout behavior preserved |
| 360px mobile | no horizontal scroll |
| 768px tablet | navigation remains usable |
| 1440px desktop | Top Bar + Sidebar + Dashboard stable |

## Rollback Criteria

Rollback UI-3A changes if:

- Admin access control breaks.
- Logout/session behavior regresses.
- Sidebar loses existing admin routes.
- Dashboard fails to render.
- Top Bar exposes environment secrets.
- Mobile navigation becomes inaccessible.
- Typecheck, lint, or build fails and cannot be fixed within UI-3A scope.

## Commit Plan

Prefer small commits:

1. `Add admin console shell primitives`
2. `Group admin navigation for console shell`
3. `Apply console shell to admin dashboard pilot`
4. `Document UI-3A validation results`

If the implementation is small, a single commit is acceptable:

```text
Implement UI-3A admin console shell pilot
```

## UI-3A Done Definition

UI-3A is done only when:

- [ ] Scope stayed within this checklist.
- [ ] Production/Preview DB unchanged.
- [ ] API/Repository unchanged.
- [ ] Auth/RBAC policy unchanged.
- [ ] Admin Dashboard pilot verified.
- [ ] Typecheck passed.
- [ ] Lint passed.
- [ ] Production build passed.
- [ ] Manual QA notes recorded.

Validation record:

- [UI-3A Validation Results](./ui-3a-validation-results.md)
