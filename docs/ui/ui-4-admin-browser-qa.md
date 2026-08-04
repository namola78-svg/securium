# UI-4 Admin Browser QA

## Scope

This pass checked the UI-3 admin console integration from a local runtime perspective. It did not change production data, preview data, migrations, seeds, secrets, APIs, repositories, or deployment settings.

## Local Runtime

| Check | Result |
| --- | --- |
| Local dev server | Passed |
| Local home route | `200` |
| Admin route protection | `307` redirect |
| Coverage admin route protection | `307` redirect |
| Coverage redirect target | `/login?return_to=%2Fadmin%2Fcoverage` |

## Browser Tool Result

The in-app browser could not open the local `127.0.0.1:3100` pages and returned `net::ERR_ABORTED`. HTTP-level checks confirmed the local app was healthy, so this was recorded as a browser-surface limitation rather than an application failure.

## Verified Behaviors

- Public home route responds successfully.
- Admin-only surfaces do not expose content to an unauthenticated request.
- The new `/admin/coverage` route uses the same protected-route behavior as the rest of the admin console.
- The redirect keeps `return_to` as an internal encoded path.

## Manual Admin QA Still Required

Use an authenticated admin account in a normal browser to verify:

1. `/admin` dashboard layout at desktop and mobile widths.
2. `/admin/curriculum` CRUD manager inside the new workspace shell.
3. `/admin/ontology` filters, forms, and inspector placement.
4. `/admin/ai-explainability` trace selection and feedback flow.
5. `/admin/coverage` read-only gap panels and inspector summary.
6. `/admin/audit-logs` filter, detail selection, pagination, and CSV export role gate.
7. Mobile stacking for workspace and inspector panels without horizontal scroll.

## Production Impact

None.

- DB changes: none
- Seed changes: none
- Migration execution: none
- Secret changes: none
- Deployment: none
