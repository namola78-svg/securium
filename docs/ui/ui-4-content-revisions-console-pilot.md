# UI-4 Content Revisions Console Pilot

## Scope

This pilot applies the admin Console Shell pattern to the Content Revision control page. It keeps the existing revision creation, publish, archive, comparison, and impact calculation flows intact.

## Updated Surface

| Route | Purpose | Applied Pattern |
| --- | --- | --- |
| `/admin/content-revisions` | Manage content date, version status, draft creation, publishing, archiving, comparison, and affected content | Section Header, Metric Cards, Page Toolbar, Workspace Layout, Inspector Panel |

## Design Intent

Content revisions need to communicate trust and operational safety. The page now separates:

1. **Header** — explains the revision-control workflow and links to related consoles.
2. **Metrics** — summarizes targets, version history, and affected content.
3. **Toolbar** — shows selected target, content date, current version, latest status, and review queue.
4. **Main Workspace** — preserves target selection, draft creation, version history, comparison, and impact sections.
5. **Inspector** — highlights latest version, review state, draft/archive counts, and content-safety reminders.

## Compatibility

- Existing query parameters are preserved:
  - `contentType`
  - `contentId`
- Existing form actions remain `/api/admin/content-revisions`.
- Existing operations are preserved:
  - `CREATE_DRAFT`
  - `PUBLISH`
  - `ARCHIVE`
- Existing authorization remains `requireQuestionAdministrator("/admin/content-revisions")`.
- No repository or API contract changed.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Relevant integration test | Passed — rendered HTML suite completed |
| Production build | Passed |

## Manual QA

Verify with an admin account:

1. Content type tabs keep the selected type in the URL.
2. Target selection updates the selected content and revision history.
3. Draft creation still posts the same fields and returns to the selected target.
4. Publish and archive actions still use the existing guarded API workflow.
5. Inspector stacks below the workspace on mobile without horizontal scroll.
6. Affected-content counts remain consistent with the previous page.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- API changes: none
- Repository changes: none
- Deployment: none
