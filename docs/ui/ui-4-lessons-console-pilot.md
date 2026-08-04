# UI-4 Lessons Console Pilot

## Scope

This pilot applies the admin Console Shell pattern to the theory CMS page for Learning Units and Lessons. It preserves existing forms, archive actions, API routes, and repository contracts.

## Updated Surface

| Route | Purpose | Applied Pattern |
| --- | --- | --- |
| `/admin/lessons` | Create and maintain Learning Units, body Lessons, completion policy, and publication state | Section Header, Metric Cards, Page Toolbar, Workspace Layout, Inspector Panel |

## Design Intent

Theory CMS spans curriculum hierarchy, publication status, completion policy, and learner progress preservation. The updated page separates:

1. **Header** — clarifies that the page manages Learning Units and body Lessons through the shared Course/Subject/Topic structure.
2. **Metrics** — summarizes Learning Unit count, Lesson count, publication state, and total estimated study minutes.
3. **Toolbar** — reminds admins that progress records should be preserved and archive/private states should be preferred.
4. **Main Workspace** — keeps the existing create/edit forms and archive actions.
5. **Inspector** — summarizes the latest Lesson, hierarchy linkage, content format, estimated time, version, and preview action.

## Compatibility

- Existing `AdminLearningUnitForm` remains unchanged.
- Existing `AdminLessonForm` remains unchanged.
- Existing `AdminArchiveButton` remains unchanged.
- Existing `/api/admin/learning-units` and `/api/admin/lessons` routes remain unchanged.
- Existing `listAdminLearningUnits()`, `listAdminLessons()`, and `listLearningScopeOptions()` repository functions remain unchanged.
- Existing authorization remains `requireCatalogManager("/admin/lessons")`.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Relevant integration test | Passed |
| Production build | Passed |

## Manual QA

Verify with a course manager or admin account:

1. Learning Unit create/update still persists.
2. Lesson create/update still persists.
3. Archive actions still use the existing API endpoints.
4. Lesson preview link opens the correct preview route.
5. Empty states render correctly for no units or no lessons.
6. Inspector stacks below the CMS forms on mobile without horizontal scroll.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- API changes: none
- Repository changes: none
- Deployment: none
