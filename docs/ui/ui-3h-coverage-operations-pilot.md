# UI-3H — Coverage Operations Pilot

## Scope

UI-3H creates the first dedicated Coverage Operations console page.

This sprint does not change database schema, seed data, API routes, repositories, secrets, or deployment settings.

## Applied changes

- Added `/admin/coverage`.
- Added Coverage to the admin navigation.
- Reused existing official security certification coverage utilities.
- Added shared `SectionHeader`, `PageToolbar`, `WorkspaceLayout`, and `InspectorPanel`.
- Added priority queue, content gap panel, and question gap panel.

## Why a separate Coverage screen

Coverage data previously lived inside the Curriculum page. That page already manages official trees, node editing, content links, operational gaps, ontology gaps, and manager UI. Keeping all coverage operations there makes the page too dense.

The dedicated Coverage page separates the operational question:

> “Which official curriculum areas still need content or questions?”

from the editing question:

> “How do I edit a curriculum tree or link specific content?”

## Information architecture

1. Coverage summary metrics
2. Coverage scope toolbar
3. Priority queue
4. Content gap detail
5. Question gap detail
6. Coverage inspector

## Current data source

The first pilot uses the existing static official security certification content map utilities:

- `getSecurityCertificationDeepNodeCoverageSummary`
- `getSecurityCertificationContentMapSummary`

No new data access layer is introduced.

## Future expansion

The Coverage screen can later evolve into a full matrix:

- Course filter
- Exam track filter
- Subject filter
- Node type filter
- Gap type filter
- Owner/status workflow
- Bulk-safe review queue
- Coverage trend over time

## Inspector role

The inspector summarizes:

- Content gaps
- Question gaps
- Content coverage percent
- Question coverage percent
- Readiness state

It does not mutate coverage status in this sprint.

## Accessibility

- Page has one `h1`.
- Queue items use text labels and badges, not color alone.
- Action links point to existing admin pages.
- Mobile layout stacks gap panels into one column.

## Validation checklist

- `/admin/coverage` route builds successfully.
- Admin navigation includes Coverage.
- Links point to existing admin routes.
- No new repository or API code is introduced.
- No database, seed, migration, secret, or deployment change is introduced.
