# UI-6 Preview Beta Readiness

UI-6 is the last product-polish lane before Preview Beta Freeze. It is intentionally conservative: no new feature work, no schema work, no production operations, and no deployment side effects.

## Release path

```text
UI-6
  ↓
Preview Beta Freeze
  ↓
QA
  ↓
User Testing
  ↓
Production Release
```

## UI-6 scope

UI-6 is allowed to change:

- UI copy that improves clarity.
- Layout consistency inside existing routes.
- Accessibility attributes and focus behavior.
- Loading, empty, and error state presentation.
- Documentation and QA checklists.
- Regression tests that lock existing UX contracts.

UI-6 must not change:

- Production or Preview DB.
- Migrations or seeds.
- API contracts.
- Repository layer.
- Domain logic.
- AI retrieval logic.
- Ontology logic.
- Authentication or RBAC.
- Secrets or environment variables.
- Vercel deployment configuration.

## Freeze criteria

Preview Beta Freeze can begin when all items below are true:

- [ ] `main` has no unreviewed local changes except approved release notes.
- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Rendered HTML integration tests pass.
- [ ] Production build passes.
- [ ] Public branding and development-copy search is clean.
- [ ] Learner core flow has a completed manual QA pass.
- [ ] Admin core flow has a completed manual QA pass.
- [ ] Known limitations are documented and accepted.
- [ ] No DB, seed, migration, API, auth, or secret change is waiting unreviewed.

## QA scope

### Learner

1. Home
2. Course list
3. Course detail and enrollment CTA
4. Dashboard
5. My courses
6. Curriculum path
7. Course lesson
8. Practice
9. AI explanation
10. Wrong notes
11. Today's review
12. Analytics
13. Profile and settings

### Admin

1. Dashboard
2. Curriculum
3. Coverage
4. Ontology
5. AI Explainability
6. AI Reviews
7. Content Revisions
8. Audit Logs
9. Questions
10. Question Reports
11. Shared Content
12. Lessons

## Manual viewport matrix

| Width | Priority |
| --- | --- |
| 390px | Mobile learner and mobile admin drawer behavior |
| 768px | Tablet stacking and inspector placement |
| 1024px | Small desktop shell and table/list readability |
| 1280px | Standard admin console layout |
| 1440px | Wide workspace balance |

## Beta entry risks

| Risk | Mitigation |
| --- | --- |
| Supabase/Auth session behavior differs between local and Vercel | Verify login, return_to, refresh, logout, and protected routes in the target Preview URL. |
| Dense admin screens regress into inconsistent layouts | Keep shell marker tests for toolbar, workspace, and inspector. |
| Mobile inspector behavior is visually acceptable but not fully drawer-driven | Treat mobile drawer behavior as a QA item before Production Release. |
| Official curriculum and sample content boundaries are misunderstood | Keep official source metadata visible and avoid "development sample" language in public screens. |
| Environment certificate warnings obscure real failures | Clean `NODE_EXTRA_CA_CERTS` before final release verification. |

## Preview Beta Freeze rule

After freeze starts, only these changes are allowed:

- P0/P1 bug fixes.
- Copy corrections.
- Accessibility fixes.
- Test fixes that align with current product behavior.
- Documentation corrections.

Everything else moves to the post-beta backlog.

