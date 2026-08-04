# Console Shell Implementation Plan

This document divides the future implementation into safe React component Sprints. It does not authorize implementation by itself.

## Recommended Rollout Order

Do not refactor every admin screen at once.

Recommended order:

1. Top Bar + Sidebar + Account Drawer
2. Breadcrumb + Page Header + Toolbar
3. Main Workspace + Inspector + Drawer
4. Apply to Admin Dashboard as the first pilot screen
5. Apply to Curriculum
6. Apply to Ontology
7. Apply to AI Trace and Coverage

Rationale:

- Top Bar, Sidebar, and Account Drawer define the global shell contract.
- Breadcrumb, Page Header, and Toolbar define the page-level contract.
- Main Workspace, Inspector, and Drawer define the working interaction model.
- Admin Dashboard is the safest pilot because it has lower interaction complexity than Tree, Ontology, AI Trace, or Coverage screens.
- Curriculum, Ontology, AI Trace, and Coverage should be migrated only after the Dashboard proves that the shell does not break navigation, permissions, responsive behavior, or loading/error states.

## UI-3A: Shell Foundation

Detailed scope lock: [UI-3A Implementation Scope Lock](./ui-3a-scope-lock.md).

Implementation checklist: [UI-3A Implementation Checklist](./ui-3a-implementation-checklist.md).

### Scope

- Shell design tokens
- Top Bar
- Sidebar
- Account Drawer

### Candidate Files

- `app/admin/layout.tsx`
- `components/admin-nav.tsx`
- `components/header-controls.tsx`
- `app/globals.css`

### Tests

- admin layout renders
- sidebar active state
- keyboard focus
- mobile drawer opens/closes

### Risks

- current admin labels require text review
- auth and role visibility must remain server-verified

## UI-3B: Page Structure

### Scope

- Breadcrumb
- Page Header
- Toolbar
- Main Workspace wrappers

### Candidate Files

- new `components/admin-console-shell.tsx`
- new `components/admin-page-header.tsx`
- new `components/admin-toolbar.tsx`
- existing admin pages incrementally

### Tests

- no route breakage
- table/tree pages keep existing behavior
- responsive layout snapshots

## UI-3C: Overlay and Detail

### Scope

- Inspector Panel
- Drawer
- Dialog
- Overlay layer
- Toast layer

### Candidate Files

- `components/design-system-primitives.tsx`
- new drawer/dialog/toast primitives if not already available
- `app/globals.css`

### Tests

- focus trap
- ESC close
- background scroll lock
- reduced motion

## UI-3D: First Screen Rollout

### Scope

- Admin Dashboard first application
- Curriculum second application
- Ontology third application
- AI Trace and Coverage after Shell pilot validation

### Candidate Files

- `app/admin/page.tsx`
- `app/admin/curriculum/page.tsx`
- `app/admin/ontology/page.tsx`

### Tests

- typecheck
- lint
- build
- admin navigation manual QA
- mobile 360/390/768 review

## Exit Criteria

- Shell slots do not duplicate responsibility.
- Top Bar and Page Header CTA are not duplicated.
- Sidebar and workspace trees are visually and semantically distinct.
- Main and Inspector scroll policies are implemented.
- Overlay layer does not conflict with Command Palette.
- No DB/API/Repository changes are required.
- Admin Dashboard pilot passes before Curriculum, Ontology, AI Trace, or Coverage migration.
