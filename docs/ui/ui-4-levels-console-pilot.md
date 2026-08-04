# UI-4 Levels Console Pilot

## Scope

This pilot applies the admin Console Shell pattern to the course level management page. It preserves existing level creation, level update, level content linking, API routes, and repository contracts.

## Updated Surface

| Route | Purpose | Applied Pattern |
| --- | --- | --- |
| `/admin/levels` | Manage course-specific levels, passing scores, prerequisites, publication state, and level content links | Section Header, Metric Cards, Page Toolbar, Workspace Layout, Inspector Panel |

## Design Intent

Level learning controls learner progression, locking, completion, and course-specific progress separation. The updated page separates:

1. **Header** — clarifies that levels are course-scoped and DB-managed.
2. **Metrics** — summarizes total levels, published levels, inactive levels, average passing score, and prerequisite count.
3. **Toolbar** — highlights inactive levels and course-specific progress separation.
4. **Main Workspace** — preserves the existing `AdminLevelForm` and `AdminLevelContentForm`.
5. **Inspector** — summarizes the first listed level, its prerequisite state, passing score, code, display order, and curriculum linkage reminder.

## Compatibility

- Existing `AdminLevelForm` remains unchanged.
- Existing `AdminLevelContentForm` remains unchanged.
- Existing `/api/admin/levels` and `/api/admin/level-contents` routes remain unchanged.
- Existing `listAdminLevels()` repository function remains unchanged.
- Existing authorization remains `requireCatalogManager("/admin/levels")`.
- Course-specific level progress and server-side access checks remain unchanged.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Relevant integration test | Passed |
| Production build | Passed |

## Manual QA

Verify with a course manager or admin account:

1. Creating a level still persists and reloads the page.
2. Updating a level still preserves course-scoped prerequisite validation.
3. Linking level content still uses the existing API endpoint.
4. Empty state renders correctly when no levels exist.
5. Inspector stacks below the level list on mobile without horizontal scroll.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- API changes: none
- Repository changes: none
- Deployment: none
