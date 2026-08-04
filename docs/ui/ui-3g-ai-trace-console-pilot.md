# UI-3G — AI Trace Console Workspace Pilot

## Scope

UI-3G applies the SECURIUM console workspace pattern to the admin AI Explainability screen.

This sprint does not change database schema, seed data, API routes, repositories, secrets, or deployment settings.

## Applied changes

- Replaced the page header with shared `SectionHeader`.
- Added breadcrumb orientation: `Admin / AI Trace`.
- Added `PageToolbar` for trace scope.
- Wrapped security policy, filters, and trace list in `WorkspaceLayout`.
- Added a right-side `InspectorPanel` for trace summary.
- Kept existing trace query, feedback form, authorization flow, and API routes unchanged.

## Explainability flow

The AI Trace console is organized around the trust chain:

1. Source request
2. Concept detection
3. Alias expansion
4. Retrieval context
5. Citation
6. Prompt fingerprint
7. AI result
8. Feedback and reviewer note

The main workspace contains the trace cards. The inspector summarizes the currently visible trace set and previews the first visible trace until interactive row selection is introduced.

## Current inspector content

- Selected/preview request ID
- Provider
- Generation status
- Visible traces
- Failed traces
- Reviewed traces
- Feedback count
- Sensitive prompt handling reminder

## Future inspector expansion

When row selection is introduced, the inspector should show:

- Request ID
- Provider/model
- Course scope
- Source type
- Target type and ID
- Concept detection summary
- Alias expansion summary
- Retrieval context count
- Citation count
- Token/latency/cost
- Review status
- Latest feedback and reviewer note

## Security principle

The console must remain explainable without exposing sensitive data:

- No full prompt body
- No full learner answer body
- No secrets
- No tokens
- No raw request/response body

Only fingerprints, scoped context, citation metadata, and safe operational metrics should be shown.

## Toolbar behavior

The toolbar shows:

- Current source filter
- Current provider filter
- Current status filter
- Links to Ontology and Curriculum
- Reset trace view action

This keeps AI trace review connected to ontology quality and official curriculum coverage.

## Responsive behavior

- On mobile, inspector stacks above the trace list.
- Trace cards retain their existing disclosure sections.
- Long request IDs, context IDs, and JSON result blocks remain wrapped or scrollable through existing styles.

## Validation checklist

- Header contains one page-level heading.
- Breadcrumb uses user-facing labels.
- Existing filter form action remains unchanged.
- Existing feedback form behavior remains unchanged.
- Inspector is read-only and does not mutate AI review state.
- No business logic, repository, API, DB, seed, or migration changes are introduced.
