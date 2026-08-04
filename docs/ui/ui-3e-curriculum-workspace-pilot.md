# UI-3E — Curriculum Workspace Pilot

## Scope

UI-3E applies the console workspace foundation to the admin Curriculum screen.

This sprint does not change database schema, seed data, API routes, repositories, secrets, or deployment settings.

## Applied changes

- Replaced the custom curriculum page header with the shared `SectionHeader`.
- Added breadcrumb orientation: `Admin / Curriculum`.
- Added a `PageToolbar` that explains the selected tree context and links to related work areas.
- Wrapped `AdminCurriculumManager` with `WorkspaceLayout`.
- Added a right-side `InspectorPanel` for selected tree readiness and coverage summary.

## Intent

The Curriculum screen is one of SECURIUM’s densest admin surfaces. It contains official trees, course lessons, shared content coverage, ontology coverage, and operational readiness checks.

The goal is to make the page feel like a structured console:

1. Understand the selected curriculum tree.
2. Review coverage and gaps.
3. Edit or connect curriculum content in the main workspace.
4. Keep contextual readiness visible in the inspector.

## Current inspector content

The inspector currently summarizes the selected tree:

- Tree status
- Activation readiness
- Node count
- Linkable content count
- CourseLesson gap count
- Ontology gap count

## Future inspector expansion

When the tree UI exposes selected node state, the inspector should show:

- Official hierarchy number
- Stable key
- Node type in Korean label
- Source PDF page
- Linked shared content
- Linked questions
- Ontology concepts
- Coverage gaps
- Audit/review state

## Toolbar behavior

The toolbar is contextual rather than a filter-only strip:

- It displays the currently selected tree.
- It links to shared content connection.
- It links to Ontology review.
- It keeps the primary tree management page refresh/navigation action visible.

## Responsive behavior

On mobile:

- The inspector stacks above the main workspace.
- The toolbar stacks vertically.
- The main manager remains the primary editor surface below the summary.

## Validation checklist

- Header contains one page-level heading.
- Breadcrumb uses user-facing labels.
- Main manager behavior remains unchanged.
- Inspector does not duplicate editable controls.
- Toolbar links point to existing admin routes.
- No business logic, repository, API, DB, seed, or migration changes are introduced.
