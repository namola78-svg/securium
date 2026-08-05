# SECURIUM Design System Status

This document tracks the current reusable UI system and the next candidates for consolidation.

## Existing primitives

| Primitive | File | Current usage |
| --- | --- | --- |
| `StatusBadge` | `components/design-system-primitives.tsx` | Admin status chips and compact state markers. |
| `MetricCard` | `components/design-system-primitives.tsx` | Admin and learner summary metrics. |
| `SectionHeader` | `components/design-system-primitives.tsx` | Admin page heading, breadcrumbs, and page actions. |
| `PageToolbar` | `components/design-system-primitives.tsx` | Page-level filters, adjacent workflow links, and primary actions. |
| `WorkspaceLayout` | `components/design-system-primitives.tsx` | Main workspace plus inspector split layout. |
| `InspectorPanel` | `components/design-system-primitives.tsx` | Right-side contextual summary and evidence panel. |
| `InspectorSection` | `components/design-system-primitives.tsx` | Structured blocks inside inspector panels. |
| `PageLoading`, `CardSkeleton`, `EmptyState`, `ErrorState`, `InlineError`, `RetryButton` | `components/state-ui.tsx` | Shared loading, empty, and error states. |
| `AdminConsoleShell` | `components/admin-console-shell.tsx` | Admin navigation shell, responsive drawer, focus handling, and main content region. |
| `AccountDrawer` | `components/account-drawer.tsx` | Account menu and sign-out interaction. |
| `CommandPalette` | `components/command-palette.tsx` | Cross-product command navigation. |

## Consolidation candidates

| Pattern | Current signal | Recommended next step |
| --- | --- | --- |
| Admin table/list | Multiple `admin-record-list`, `admin-record`, and table-like sections. | Create `AdminRecordList` only after Coverage/Ontology/Revision row behavior is reviewed. |
| Filter forms | AI trace, ontology, lectures, questions, and other pages have page-local filters. | Create `AdminFilterBar` after filter semantics are stable. |
| Tree | Learner curriculum and admin curriculum manager have different tree needs. | Keep `CompactTree`, `ExplorerTree`, and `OntologyTree` as separate variants. |
| Drawer/Inspector mobile | Inspector currently stacks through CSS. | Add browser QA before building a full interactive drawer primitive. |
| Toast | Some flows use inline messages. | Introduce toast only after mutation-heavy admin flows are reviewed. |

## Accessibility baseline

- Buttons and links use visible focus styles through global CSS.
- Mobile admin navigation supports Escape, focus movement, and scroll lock.
- Shared state components use `role="status"` or `role="alert"`.
- Progress bars expose ARIA progress semantics.
- Tree controls expose `role="tree"`, `role="treeitem"`, `aria-expanded`, and selection state where implemented.

## Known gaps

- A few admin screens still use page-local list/table structures.
- Inspector responsive drawer behavior is mostly CSS-driven rather than a reusable interactive drawer primitive.
- Full WCAG color contrast measurement should be repeated before Preview Beta.
- Some console output on Windows PowerShell appears mojibake, but UTF-8 file contents should be checked with Node when in doubt.

