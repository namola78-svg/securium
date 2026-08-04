# UI-3F — Ontology Explorer Workspace Pilot

## Scope

UI-3F applies the SECURIUM console workspace pattern to the admin Ontology screen.

This sprint does not change database schema, seed data, API routes, repositories, secrets, or deployment settings.

## Applied changes

- Replaced the page header with shared `SectionHeader`.
- Added breadcrumb orientation: `Admin / Ontology`.
- Added `PageToolbar` for current explorer scope.
- Wrapped the existing filter, review policy, concept list, and edge list in `WorkspaceLayout`.
- Added a right-side `InspectorPanel` for ontology summary.
- Kept existing concept/edge query, status form, authorization flow, and API routes unchanged.

## Explorer model

The Ontology page now follows the same console structure as Curriculum:

1. Summary metrics
2. Explorer scope toolbar
3. Main workspace
4. Inspector panel

The current main workspace still contains both Concepts and Edges. The next implementation step can split this into a denser explorer pattern:

- Left: Concept/edge navigation list
- Center: selected concept or relation detail
- Right: inspector with metadata, alias, relation, coverage, AI usage, audit, and history

## Current inspector content

Until row selection is introduced, the inspector previews the first visible concept or edge and summarizes:

- Active concepts
- Draft concepts
- Active edges
- Draft edges
- Retrieval preference note for ACTIVE ontology data

## Future selection behavior

When interactive row selection is added, the inspector should update without navigating away:

- Concept label and stable key
- Namespace
- Category
- Aliases
- Parent/child relations
- Cross-course mappings
- Linked curriculum nodes
- Linked content/questions
- AI retrieval usage
- Review/audit history

## Toolbar behavior

The toolbar shows:

- Current namespace scope
- Current course scope
- Links to Curriculum and AI Trace
- Reset view action

This keeps ontology work connected to curriculum coverage and AI explainability.

## Responsive behavior

- Within a workspace with inspector, concept and edge lists collapse to one column.
- On mobile, the inspector stacks above the workspace.
- Long IDs and keys continue to wrap safely.

## Validation checklist

- Header contains one page-level heading.
- Breadcrumb uses user-facing labels.
- Existing filter form action remains unchanged.
- Existing status transition form action remains unchanged.
- Inspector is read-only and does not perform status transitions.
- No business logic, repository, API, DB, seed, or migration changes are introduced.
