# UI-3D — Admin Dashboard Console Pilot

## Scope

UI-3D turns the admin dashboard into the pilot screen for SECURIUM console patterns.

This sprint does not change database schema, seed data, API routes, repositories, secrets, or deployment settings.

## Pilot goals

The dashboard should validate the common admin shell before denser screens adopt it:

- Page orientation through breadcrumb and page header
- Operational summary through metric cards
- Next-step direction through toolbar actions
- Primary workspace through action cards
- Contextual detail through inspector panel

## Dashboard information order

1. Page location
2. Page purpose
3. Operational metrics
4. Recommended next actions
5. Work modules
6. Context summary

## Applied patterns

### Toolbar as operating priority

The dashboard toolbar is not a filter bar. It is used as an operations guide:

`Curriculum → Content → Ontology → AI Trace`

This supports the product principle that official curriculum coverage should be checked before AI and retrieval quality.

### Action cards

Action cards now show:

- Order number
- Domain label
- Current status badge
- Module title
- Short operational description

The card title remains the primary visible element after metadata.

### Inspector

The inspector remains read-only on the dashboard. It summarizes what an operator should look at first and links to the two highest-priority work areas.

## Usage rules for future screens

| Screen | Workspace | Inspector | Toolbar |
| --- | --- | --- | --- |
| Curriculum | Compact tree/list | Selected node detail | Course/tree filters |
| Ontology | Explorer graph/list | Concept metadata | Search/review filters |
| AI Trace | Trace table | Selected trace detail | Provider/status filters |
| Coverage | Gap table | Gap remediation detail | Action type/status filters |
| Audit | Event table | Event metadata | Date/action filters |

## Accessibility notes

- Action cards remain links with keyboard focus support.
- Status is shown through text badges, not color alone.
- Toolbar links are regular anchors and remain reachable by keyboard.
- Mobile layouts stack without horizontal scrolling.

## Validation checklist

- Dashboard has one `h1`.
- Toolbar actions are not duplicates of row-level actions.
- Status badges are textual.
- Inspector is contextual and read-only.
- No protected admin route is exposed to non-admin users by UI-only changes.
- No database, API, repository, seed, or migration change is introduced.
