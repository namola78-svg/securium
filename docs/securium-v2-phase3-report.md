# SECURIUM V2 - PHASE 3 AUTHENTICATION

## Scope

Phase 3 migrates only `/login` and `/signup` to the opt-in V2 presentation. Authentication APIs, provider selection, session handling, protected-route behavior, database access, learner routes, and admin routes retain their existing contracts.

## Implementation

- `AuthV2Shell` supplies a scoped authentication header, supporting learning narrative, responsive two-column layout, and mobile single-column presentation.
- `AuthV2Card` provides the shared title and form surface for both authentication providers.
- `LoginPanel` and `SignupPanel` retain the existing Supabase actions, field names, `returnTo` values, client validation, OAuth links, and legal routes.
- The Sites provider retains the existing ChatGPT/Google sign-in path without presenting unsupported password or social-login methods.
- The legacy site header, footer, and command trigger are hidden only while `[data-auth-v2]` is present.
- V2 styling remains isolated in a CSS Module and does not add auth selectors to `app/globals.css`.

## Accessibility and responsive behavior

- Each route renders one `main` landmark and one `h1`.
- Inputs retain explicit labels and appropriate autocomplete values.
- Validation messages remain associated through `aria-describedby` and invalid fields through `aria-invalid`.
- Password visibility controls expose state-specific accessible names.
- Interactive controls preserve a minimum 48px height and visible V2 focus treatment.
- At 390, 768, 1024, and 1440px, the pages have no horizontal overflow.
- Reduced-motion preferences remove nonessential field and provider-button transitions.

## QA harness correction

The initial Phase 3 browser script mixed a Vinext runtime check with presentation QA and forced `APP_BUILD_TARGET=cloudflare` into a Next development server. This either stalled at readiness or caused Node to import the runtime-only `cloudflare:workers` module.

`reports/ui-v2/phase3/auth-qa.mjs` now uses the stable Next development runtime for both provider configurations and varies only `AUTH_PROVIDER`. Cloudflare runtime compatibility remains a separate build-suite responsibility. The script also prints captured server logs when readiness fails, so future failures expose their cause.

## Validation results

Generated at `2026-08-11T08:24:05.150Z`:

| Check | Result |
| --- | --- |
| Auth presentation contract tests | PASS, 5/5 |
| Browser route/provider/viewport cases | PASS, 16/16 |
| Sites login/signup cases | PASS, 8/8 |
| Supabase login/signup cases | PASS, 8/8 |
| HTTP responses | 200 for all 16 rendered cases |
| Console warnings/errors | 0 |
| Page errors | 0 |
| Horizontal overflow | 0 cases |
| Login to signup `return_to` | `/dashboard` preserved |
| Signup to login `return_to` | `/dashboard` preserved |
| Supabase password visibility | `password` to `text` |
| Supabase empty-submit validation | email and password errors visible |
| Supabase protected route | 307 to `/login?return_to=%2Fdashboard` |

The machine-readable evidence is stored in `reports/ui-v2/phase3/qa-results.json`. Sixteen full-page screenshots are stored beside it for both providers and all four viewports.

This continuation did not rerun the full unit suite, lint, typecheck, production build, or Cloudflare build.

## Phase boundary

Phase 3 is complete. Dashboard, learner shell/navigation, learning, practice, review, analytics, AI Tutor, profile, and admin V2 migrations remain outside this phase.
