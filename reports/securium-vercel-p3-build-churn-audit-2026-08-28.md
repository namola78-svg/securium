# SECURIUM VERCEL P3 BUILD / PREVIEW DEPLOYMENT CHURN

## Read-only root-cause audit

Snapshot date: **2026-08-28**  
Authorization: `P3_BUILD_CHURN_READ_ONLY_AUDIT`

## Final status

`SECURIUM_VERCEL_P3_BUILD_CHURN_AUDIT_PASS_ADDITIONAL_VERCEL_RUNTIME_EVIDENCE_REQUIRED`

The repository-side mechanism is understood and a bounded fail-safe remediation is feasible. Exact live Vercel branch filters, ignored-build configuration, deployment records, and historical build count are not provable from this worktree because the external Vercel account/control plane is blocked. No account unblock or deployment action was attempted.

## Baseline and authority

| Field | Result |
|---|---|
| Worktree | `C:\Users\user\Documents\Codex\2026-07-24\1-2-3-4-5-6\securium-vercel-build-p3` |
| Branch | `audit/vercel-build-churn-p3` |
| HEAD | `6ca3b0736dd8cef7b1d3ba3fd228c6d1689a8095` |
| Fresh `origin/main` | `6ca3b0736dd8cef7b1d3ba3fd228c6d1689a8095` |
| Main match | YES |
| Working tree before report | CLEAN |
| Fetch | `git fetch origin` completed |
| P2 merge SHA | `6ca3b0736dd8cef7b1d3ba3fd228c6d1689a8095` |

The audit worktree started at fresh main and had no source/config diff. This report is the only requested audit artifact added by this task.

## Repository and Vercel configuration inventory

The repository is a single Next.js application rooted at the repository root. The App Router is under `app/`; there is no `apps/` or `src/app/` application root.

| Item | Finding |
|---|---|
| `vercel.json` | ABSENT |
| `.vercel/` | ABSENT; `.gitignore` ignores it |
| `.vercelignore` | ABSENT |
| `now.json` | ABSENT |
| `project.json` | ABSENT as a Vercel project file |
| `next.config.ts` | PRESENT; native Vercel path uses `output: "standalone"` and headers |
| Vercel deployment protection | UNKNOWN; no project settings available |
| Git integration project metadata | Not stored locally; `docs/vercel.md` records an existing project named `securium`, GitHub repository `namola78-svg/securium`, and `main` as synchronized branch |
| `.openai/hosting.json` | PRESENT, but this is Sites/Cloudflare metadata (`project_id`, D1 binding `DB`), not Vercel configuration |
| Vercel ignored build step | ABSENT from repository evidence |
| Branch filter | ABSENT from repository evidence |
| Build command override | ABSENT; package default is used |
| Framework override | ABSENT; Next.js is auto-detected |

Exact relevant paths: [next.config.ts](../next.config.ts), [package.json](../package.json), [docs/vercel.md](../docs/vercel.md), [docs/vercel-supabase.md](../docs/vercel-supabase.md), [.openai/hosting.json](../.openai/hosting.json), [.gitignore](../.gitignore), and [vercel-runtime-logs.jsonl](../vercel-runtime-logs.jsonl). The last file is historical runtime-log evidence, not a deployment configuration.

## Package build path

| Field | Value |
|---|---|
| Build script | `next build` |
| Start script | `next start` |
| Next version | `16.2.6` |
| Output mode | `standalone` for the native Next/Vercel path; Cloudflare build condition omits it |
| Vercel-specific package scripts | None |
| Lockfile | `package-lock.json` |

The native Vercel build is a whole Next application build. The separate `build:cloudflare` path is not used by the package `build` script and is not a Vercel deployment command.

## GitHub Actions inventory

There are four tracked workflows, zero deploy-producing workflows, and two build-producing workflows.

| Workflow | Trigger | Build/deploy behavior |
|---|---|---|
| `.github/workflows/ci.yml` | `pull_request` (all branches); `push` to `main` | `npm ci`, unit/integration validation, then `npm run build` |
| `.github/workflows/e2e.yml` | `workflow_dispatch`; `push` to `main`; weekly `schedule` | `npm run test:e2e`; package script first runs `npm run build`, then E2E tests |
| `.github/workflows/postgres-baseline.yml` | filtered `pull_request`; `workflow_dispatch` | PostgreSQL baseline/migration validation; no Next build/deploy command |
| `.github/workflows/postgres-parity.yml` | `workflow_dispatch`; filtered `push` on two feature branches | PostgreSQL parity validation; no Next build/deploy command |

GitHub Actions does not call `vercel`, `vercel deploy`, `vercel build`, `vercel pull`, `vercel --prod`, or a Vercel API. There are no workflow references to `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID`.

GitHub CI and Vercel therefore form two build layers for relevant commits: CI builds for code validation, while a Vercel Preview build creates the deployable Preview artifact and Preview UX. They are not equivalent in purpose, and CI should not be removed solely to reduce Vercel usage. The E2E workflow adds another local production-style build on its own main/manual/scheduled executions; this is a separate GitHub cost layer, not a Vercel deployment.

## Git, branch, and worktree inventory

Counts were taken from `git worktree list --porcelain` and local/remote refs after fetch.

| Metric | Count / result |
|---|---:|
| Total worktree count | 140 |
| Active Securium worktree count | 140 repository worktrees; 126 paths contain the literal `securium` |
| Local branch count | 108 |
| Remote branch count | 76 (`origin/HEAD` excluded) |
| Local branches with unmerged tip relative to `origin/main` | 68 |
| Local branches whose tip is already an ancestor of `origin/main` | 39 |
| Local branches stale/behind or divergent relative to `origin/main` | 106 |

The branch counts use local refs and a conservative graph definition: “already merged” means the branch tip is an ancestor of fresh `origin/main`; “stale” means fresh `origin/main` is not an ancestor of the branch tip. The categories overlap in ordinary Git histories because a merged branch can also be behind main.

Relevant local branch classification by naming and repository role:

| Classification | Active relevant branch refs observed |
|---|---|
| `PRODUCT_FEATURE` | `feat/*`, `feature/*` product/content implementation branches; examples include `feat/uiux-*`, `feat/concept-*`, `feature/industrial-*`, `feature/sw-*`, `feature/isms-p-*` |
| `PERFORMANCE` | `perf/vercel-dynamic-boundary-p0`, `perf/vercel-force-dynamic-p1-audit`, `perf/vercel-progress-polling-p2-audit` |
| `GOVERNANCE` | `governance/cs1a-authority-establishment`, `infra/nonprod-governance-auth`, governance-named `feat/*` branches |
| `CONTENT` | `content/*` branches, including authoring and reconfirmation branches |
| `AUDIT_ONLY` | `audit/*`, including `audit/vercel-build-churn-p3`, `audit/vercel-usage-root-cause`, UI, provenance, migration, and governance audit branches |
| `QA_ONLY` | Detached QA/post-merge worktrees; no consistent QA-only branch prefix was found |
| `HOTFIX` | `hotfix/batch1-content-render-progress`, `hotfix/v2-mobile-accessibility` (remote refs are present; no corresponding active worktree was required for this audit) |
| `OTHER` | `chore/*`, `design/*`, and detached worktree heads |

The full active worktree list is Git-managed state and was not changed. Local worktrees themselves do not create Vercel builds. A build can occur only when a Git event reaches the integrated remote repository, or when an explicit deployment command/API is invoked.

## Git/Vercel trigger model

Repository evidence supports this model, with exact current Vercel project filters unverified:

| Git event | GitHub CI | Vercel Production | Vercel Preview |
|---|---|---|---|
| Push to `main` | `ci.yml`; E2E on main | Expected production deployment for the documented `main` connection | Usually no separate Preview for the production branch |
| Push to non-main branch | `ci.yml` does not run on push; filtered workflows may run only on named paths/branches | No | Plausibly yes under normal Vercel Git integration; exact branch filters unknown |
| PR opened | `ci.yml` | No | Plausibly yes for a PR Preview; exact integration setting unknown |
| New commit pushed to open PR | `ci.yml` | No | Plausibly another Preview for the new commit |
| Merge to `main` | `ci.yml` and main E2E behavior | Expected production deployment | Prior Preview remains historical; no new distinct Preview is proven |
| Manual Vercel CLI/API deployment | No | Only if explicitly requested with production target | Only if explicitly requested without production target |
| Schedule | E2E workflow only | No direct repository evidence | No direct repository evidence |

The production path is distinct from Preview churn: the documented production connection is `main`, while non-main branch/PR activity is the plausible source of Preview volume. The repository contains no direct evidence that GitHub Actions deploys to Vercel.

PR churn structural model:

`branch push -> Preview candidate`; `PR open/update -> Preview candidate`; `subsequent push -> additional Preview candidate`.

Whether the exact same commit receives two separate Vercel deployments at branch-push and PR-open time depends on the live Git integration behavior and cannot be established from this repository. Repeated diagnostic commits on a remote temporary branch can each generate additional Preview candidates. A local worktree checkout or local commit that is never pushed cannot.

## Audit-only and content-only eligibility

| Question | Result |
|---|---|
| Audit-only Preview avoidable | YES in principle, if changed-file classifier is proven and Vercel ignored-build mechanism is enabled; current project behavior UNKNOWN |
| Docs-only Preview avoidable | YES in principle for docs proven outside runtime/build inputs; current project behavior UNKNOWN |
| Report-only Preview avoidable | YES in principle for reports proven outside runtime/build inputs; current project behavior UNKNOWN |
| Test-only Preview classification | `SAFE_TO_SKIP_IF_GUARDED` only if policy confirms tests are not build inputs; default recommendation is BUILD because tests can read fixtures and validate build assumptions |
| Content/governance branch requirement | `PREVIEW_OPTIONAL` for proven non-runtime artifacts; `REQUIRES_PREVIEW` for runtime content/data/config changes; broad branch-only answer is unsafe |

The current repository has no ignored-build mechanism, so absent a future guard every pushed branch/PR that Vercel considers eligible is a Preview candidate. `docs/**`, `reports/**`, and governance evidence are not automatically safe merely because of their directory name.

## Runtime and build-time dependency analysis

No `app/**` import of `reports/**`, `docs/**`, or `source-evidence-original/**` was found in the repository-side import search. The production App Router build succeeded without a generated evidence/report step.

Exceptions and cautions:

- Tests read report fixtures and source files, including `reports/ai-search/*` and content-audit reports.
- Offline/content-generation scripts read `reports/source-text-extraction.json`, `data/normalized-knowledge-base.json`, migrations, and other evidence artifacts.
- `lib/data/security-content-intelligence-v3.mjs` contains report/source references and is imported by content-analysis scripts, not by the observed `app/**` runtime graph.
- A future build-time generation step could make a currently non-runtime path build-critical; unknown classification must therefore BUILD.

Non-runtime file class confidence is **MEDIUM-HIGH for the current native Next app graph**, not absolute. There are no current runtime import exceptions for the requested `docs/**` and `reports/**` classes, but test/offline-script exceptions exist and must be represented in a future allowlist.

## Build invalidation and cache

| Field | Result |
|---|---|
| Full build per Preview | YES, assuming a Preview is not skipped; Vercel receives a Git deployment candidate and invokes the project build for the repository root |
| Changed-file invalidation currently configured | NO; no `ignoreCommand`, branch filter, or diff check is present |
| Root directory | Repository root |
| App directory | `app/` |
| Unrelated files outside runtime root | With no ignored build step, they remain eligible to trigger the repository build |
| Build cache configured | UNKNOWN at Vercel control plane; no project metadata available |
| Next cache behavior | Next/Turbopack build cache is eligible locally; no Vercel cache hit rate is available |
| Dependency cache behavior | GitHub `setup-node` explicitly caches npm dependencies; Vercel dependency-cache status is UNKNOWN; `package-lock.json` enables deterministic install |

No cache hit rate or CPU reduction is claimed. Cache reuse reduces work per build but does not reduce the number of deployment/build events.

## Historical evidence and 574 estimate

Repository evidence can prove 559 reachable commits across local refs and 49 commits on fresh `origin/main`, but it cannot prove pushes, PR-head transitions, or Vercel deployment records. `vercel-runtime-logs.jsonl` contains runtime request logs and deployment IDs, not a complete deployment/build ledger. No GitHub event archive or Vercel deployment API result is available in this audit.

| Metric | Result |
|---|---|
| Exact historical build count | UNVERIFIED |
| Historical build count confidence | LOW/UNVERIFIED for exact count; MEDIUM for structural churn hypothesis |
| Prior estimate `574` independently revalidated | NO |
| Prior Build CPU | Approximately 39h 44m, supplied prior evidence |
| Build-churn contribution | MEDIUM |

The supplied CPU figure is structurally consistent with excessive Preview frequency because a full Next build can repeat for each eligible remote branch/PR commit, but the repository cannot attribute the CPU to Preview versus CI, E2E, production, or other external build sources. No monetary cost is derived.

## Churn classes

| Class | Assessment |
|---|---|
| `NECESSARY_PRODUCT_BUILD` | Runtime/UI/API/config/schema/content changes that need Preview or production validation |
| `NECESSARY_CI_VALIDATION` | PR CI build, unit/integration validation, migration proofs, and E2E validation |
| `REDUNDANT_PREVIEW_BUILD` | Plausible for repeated remote commits and PR/branch candidates after the useful Preview state is superseded |
| `AUDIT_ONLY_PREVIEW_BUILD` | Plausible and avoidable only after proven changed-file classification |
| `DOCS_ONLY_PREVIEW_BUILD` | Plausible and avoidable only when docs are not build/runtime inputs |
| `REPEATED_BRANCH_UPDATE_BUILD` | Structurally likely for every pushed update to an eligible temporary branch |
| `UNKNOWN` | Exact frequency, duplicate same-SHA behavior, deployment protection, and live branch filters |

Current architecture classification: **HIGH_BUILD_CHURN_RISK**. This is a risk classification, not proof of 574 builds.

## Remediation comparison

| Option | Assessment |
|---|---|
| A. Vercel ignored build step | Small control-plane change; can avoid non-runtime deployments; safe only with fail-safe classifier and live-project verification; false-negative risk is low if unknown/mixed/renamed/deleted paths BUILD; maintenance is moderate |
| B. Changed-file classification | Best safety/precision tradeoff; classify commit diff against an explicit runtime/build allowlist; feasible; requires deterministic tests and future review when build inputs change |
| C. Branch filter | Low implementation complexity but unsafe broadly; `perf/*` already includes runtime-impacting P2 work, and content/governance branches can alter runtime data/config; use only as an additional narrow policy, never as sole proof |
| D. Manual Preview for non-runtime changes | Reliable for special cases but workflow friction is higher and users may forget; useful as an exception/manual override, not the primary safety mechanism |
| E. Reduce worktree/branch push churn | Can reduce remote commits and candidate deployments; local worktrees are not the trigger; requires contributor discipline and does not solve legitimate runtime Preview needs |
| F. PR squash/push discipline | Consolidating diagnostic commits before remote push can reduce repeated Preview candidates while preserving review; do not squash away needed review history or runtime validation |
| G. CI/Preview division | Keep GitHub CI for code validation; allow proven evidence-only changes to rely on CI and skip Vercel Preview; preserve Preview for runtime/UI behavior and deployment artifact validation |

## Recommended bounded P3 design

Use Vercel’s ignored-build hook only after authorization and project-level confirmation, backed by a small repository classifier with this policy:

1. Examine the complete changed-file set for the deployment candidate, including renames and deletions.
2. BUILD if any path is runtime, build configuration, dependency, lockfile, migration/schema, public asset, generated runtime input, or unknown.
3. SKIP only when every changed path belongs to a reviewed non-runtime class and no build-time generator consumes it.
4. Preserve GitHub CI unchanged.
5. Do not use broad `audit/*`, `content/*`, `governance/*`, `infra/*`, or `perf/*` branch prefixes as the safety decision.
6. Keep a manual Preview override for special evidence/UI review cases.

Recommended fail-safe default: **BUILD**.

Proposed safe classes, subject to tests and review: docs-only, report-only, and selected governance reference artifacts that are not imported by runtime or build-time generation. Proposed unsafe classes: `app/**`, `components/**`, `lib/**`, `public/**`, `next.config.*`, `package.json`, lockfiles, `tsconfig*`, build scripts, database schema/migrations, generated runtime data, and any unknown path.

Expected impact is theoretical only:

| Measure | Assessment |
|---|---|
| Preview builds avoided | MEDIUM, potentially HIGH in an audit/content-heavy remote workflow; exact percentage UNKNOWN |
| Build CPU reduction | MEDIUM structurally; exact reduction UNKNOWN |
| False skip risk | LOW with strict allowlist and BUILD-on-unknown; HIGH if branch-prefix-only rules are used |

## Future candidate files (not implemented)

- `vercel.json` — only if the project-level ignored-build command must be declared in repository configuration.
- `scripts/vercel-ignore.mjs` — deterministic changed-file classifier returning the Vercel skip/build decision.
- `tests/vercel-ignore-classifier.test.mjs` — focused fail-safe matrix.
- `package.json` — only if a script entry is required by the chosen Vercel configuration; no package change is currently justified.
- `docs/vercel.md` or a new bounded P3 implementation note — policy, runtime-input allowlist, review/override procedure, and control-plane prerequisites.

## Deterministic future test strategy

| Fixture | Expected result |
|---|---|
| Runtime TS/TSX change | BUILD |
| API route change | BUILD |
| `package.json` | BUILD |
| Lockfile | BUILD |
| Migration | BUILD |
| Schema | BUILD |
| Public asset | BUILD |
| Next config | BUILD |
| Docs-only proven non-runtime | SKIP |
| Report-only proven non-runtime | SKIP |
| Test-only | BUILD by default; SKIP only if policy proves tests cannot affect build and the policy explicitly allows it |
| Mixed runtime + docs | BUILD |
| Unknown extension/path | BUILD |
| Rename into runtime class | BUILD |
| Delete runtime file | BUILD |
| Generated runtime artifact | BUILD |

Security requirements: normalize repository-relative paths, reject traversal/absolute paths, inspect both sides of renames, treat deletions as impactful, fail closed for mixed commits, and keep generated runtime artifacts in the BUILD set. A misclassified path must not be able to hide a runtime change behind a branch name or documentation/report directory.

## Required firewalls and mutation record

| Firewall / action | Result |
|---|---|
| P0 changed | NO |
| P1 changed | NO |
| P2 changed | NO |
| Auth changed | NO |
| CS1A changed | NO |
| Receipt changed | NO |
| Actor/audit changed | NO |
| Schema changed | NO |
| Migration changed | NO |
| Database write | 0 |
| Vercel config changed | NO |
| Deployment triggered | NO |
| Manual deployment | NO |
| Commit | NO |
| Push | NO |
| PR | NO |
| Merge | NO |
| Production connection | NO |

`npm ci --ignore-scripts` populated only ignored local dependencies needed for validation. No tracked source, package, workflow, Vercel, database, or deployment state was changed.

## Validation gates

| Gate | Result |
|---|---|
| Typecheck | PASS — `npm.cmd run typecheck` |
| Lint | PASS — `npm.cmd run lint` |
| Build | PASS — `npm.cmd run build`; Next.js 16.2.6 compiled and generated 63 static pages/routes successfully |
| Focused existing ignore-classifier tests | NOT APPLICABLE — no existing classifier found |

## Required final result fields

| Field | Result |
|---|---|
| Final Status | `SECURIUM_VERCEL_P3_BUILD_CHURN_AUDIT_PASS_ADDITIONAL_VERCEL_RUNTIME_EVIDENCE_REQUIRED` |
| Snapshot Date | 2026-08-28 |
| Worktree | `securium-vercel-build-p3` |
| Branch | `audit/vercel-build-churn-p3` |
| HEAD | `6ca3b0736dd8cef7b1d3ba3fd228c6d1689a8095` |
| Fresh origin/main | `6ca3b0736dd8cef7b1d3ba3fd228c6d1689a8095` |
| Main Match | YES |
| Total Worktree Count | 140 |
| Active Securium Worktree Count | 140 repository worktrees; 126 literal-name matches |
| Local Branch Count | 108 |
| Remote Branch Count | 76 |
| GitHub Workflow Count | 4 |
| Build-Producing Workflow Count | 2 |
| Deploy-Producing Workflow Count | 0 |
| Vercel Config Paths | `vercel.json`, `.vercel/`, `.vercelignore`, `now.json`, Vercel `project.json`: absent; `next.config.ts` present; `docs/vercel.md` and `.openai/hosting.json` are evidence/other-provider metadata |
| Vercel CLI Reference Count | 0 executable references; historical CLI text exists in `vercel-runtime-logs.jsonl` |
| Production Deployment Trigger | Expected push/merge to `main` through documented Vercel Git integration; exact live setting UNKNOWN |
| Preview Deployment Trigger | Plausibly eligible non-main branch pushes and PR open/update commits; exact live setting UNKNOWN |
| Duplicate Build Layers | YES: GitHub CI build and Vercel Preview build have distinct validation/artifact purposes; E2E adds another GitHub build on its own triggers |
| Historical Build Count | UNVERIFIED |
| Historical Build Count Confidence | LOW/UNVERIFIED exact; MEDIUM structural |
| Prior 574 Estimate Revalidated | NO |
| Prior Build CPU | Approximately 39h 44m |
| Build-Churn Contribution | MEDIUM |
| Audit-Only Preview Avoidable | YES, if guarded; current live behavior UNKNOWN |
| Docs-Only Preview Avoidable | YES, if proven non-runtime; current live behavior UNKNOWN |
| Report-Only Preview Avoidable | YES, if proven non-runtime; current live behavior UNKNOWN |
| Test-Only Preview Classification | BUILD by default; policy-gated SKIP only if proven non-runtime |
| Runtime Import Exceptions | No current `app/**` import of requested report/docs classes; tests and offline scripts read reports/source evidence |
| Ignored Build Step Present | NO in repository evidence; Vercel control plane UNKNOWN |
| Option A Ignored Build Step | Feasible; moderate maintenance; safe only with fail-safe classifier |
| Option B Changed-File Classification | RECOMMENDED; best safety/precision |
| Option C Branch Filter | Unsafe as sole rule; narrow supplemental use only |
| Option D Manual Preview | Useful exception; higher workflow complexity |
| Option E Push-Churn Reduction | Helpful but cannot replace classifier; worktrees alone do not deploy |
| Option F PR/Push Discipline | Can reduce diagnostic-commit churn; preserve review safety |
| Option G CI/Preview Division | Preserve CI; skip only proven non-runtime Preview candidates |
| Recommended P3 Architecture | Vercel ignored-build hook backed by changed-file classification and explicit non-runtime allowlist |
| Recommended Fail-Safe Default | BUILD |
| Exact Future Candidate Files | `vercel.json`; `scripts/vercel-ignore.mjs`; `tests/vercel-ignore-classifier.test.mjs`; optional `package.json`; `docs/vercel.md` |
| Expected Preview Build Reduction | MEDIUM potentially HIGH; exact UNKNOWN |
| Expected Build CPU Reduction | MEDIUM; exact UNKNOWN |
| False Skip Risk | LOW with fail-safe allowlist; HIGH for broad branch filters |
| Security Critical | Never skip runtime-impacting, unknown, mixed, renamed, deleted, generated, dependency, schema, migration, or public-asset changes |
| Security High | Path normalization/traversal, branch spoofing, generated runtime inputs, and PR diff completeness |
| Data Trust Critical | Preserve GitHub CI; database write count remains 0; no migration/schema bypass |
| Data Trust High | Do not classify content/governance by branch name alone; retain review and manual override |
| P0 Changed | NO |
| P1 Changed | NO |
| P2 Changed | NO |
| Auth Changed | NO |
| Governance Changed | NO |
| Schema Changed | NO |
| Migration Changed | NO |
| Vercel Config Changed | NO |
| Typecheck | PASS |
| Lint | PASS |
| Build | PASS |
| Commit | NO |
| Push | NO |
| PR | NO |
| Merge | NO |
| Deployment | NO |
| Production Connection | NO |
| Ready For Bounded P3 Implementation | YES for bounded design authorization after additional Vercel runtime evidence; NO implementation performed |
| Ready For P4 Observability Design | YES as a follow-up design track; implementation remains outside this audit |
| Remaining Preconditions | Obtain read-only Vercel project settings/deployment history; verify Preview branch/PR triggers, ignored-build support, protection, cache state, and deployment records; then authorize bounded implementation |
| Recommended Next Step | Acquire additional read-only Vercel runtime/control-plane evidence, then authorize the tested changed-file fail-safe implementation |
| Reports Written | `reports/securium-vercel-p3-build-churn-audit-2026-08-28.md` |

## BUILD TRIGGER MODEL

Current repository evidence shows GitHub PR CI runs on every PR update and pushes to `main`; main E2E runs on main pushes, manual dispatch, and a weekly schedule. The documented Vercel Git integration uses `main` for Production. Normal Vercel behavior makes non-main branch pushes and PR open/update commits Preview candidates, but live branch filters and exact duplicate behavior are not available. No GitHub workflow invokes Vercel separately.

## WORKTREES VS DEPLOYMENTS

There are 140 active repository worktrees. Local worktree count itself does not create Vercel builds. Only remote Git events that reach the integrated repository, or explicit deployment commands/API calls, can create Vercel deployment work.

## BUILD CHURN

Excessive Preview churn is structurally plausible and the repository has no skip mechanism. It is not historically proven at 574 builds because deployment/push/PR telemetry is unavailable. Repeated remote diagnostic commits and PR updates are the clearest plausible churn sources.

## DUPLICATE BUILD LAYERS

GitHub CI builds for code validation. Vercel Preview builds create a deployable Preview artifact and provide Preview UX validation. Both can be necessary. The separate E2E workflow also invokes `npm run build` on its own triggers.

## SAFE SKIP CLASSES

Only proven docs-only, report-only, or explicitly reviewed non-runtime governance evidence changes are candidates for SKIP. Current tests and offline scripts read evidence files, so test/build-time dependencies must remain guarded.

## FAIL-SAFE

Unknown, mixed, runtime, dependency, configuration, schema, migration, public-asset, rename, deletion, and generated-runtime changes always BUILD.

## RECOMMENDED REMEDIATION

The smallest safe P3 design is a Vercel ignored-build hook backed by deterministic changed-file classification, an explicit non-runtime allowlist, complete diff/rename handling, and BUILD as the default. Preserve GitHub CI and avoid broad branch-name shortcuts.

## EXPECTED EFFECT

Theoretical Preview reduction is MEDIUM potentially HIGH, and theoretical build CPU reduction is MEDIUM. No measured cost or production savings are claimed.

## NOT ADDRESSED

Vercel external account block; unknown historical runtime traffic source; P2 production savings measurement; P4 observability implementation.

## NEXT GATE

`ADDITIONAL_VERCEL_RUNTIME_EVIDENCE_REQUIRED`

---

# VERCEL DEPLOYMENT EVIDENCE CLOSURE

Closure snapshot: **2026-08-28**  
Authorization: `P3_VERCEL_DEPLOYMENT_EVIDENCE_CLOSURE_READ_ONLY`

This section preserves the prior uncertainty and adds the connected Vercel deployment evidence. The Vercel project was read through the connected read-only project/deployment metadata for project `securium` (`prj_mJ8mv1QykgzTgGvzSM0FWQNASrAT`) in the GitHub repository `namola78-svg/securium`. No deployment, project setting, or account mutation was performed.

## Exact 40-record deployment result

The connector returned the two newest pages, 20 records each. Records are ordered newest first. Vercel records with `target: null` are classified as `PREVIEW` because their Git branch is non-`main`; `target: production` is classified as `PRODUCTION`.

| Metric | Exact result |
|---|---:|
| Deployment evidence record count | 40 |
| Preview count | 26 |
| Production count | 14 |
| Error count | 1 |
| Distinct Preview branch count | 20 |
| Preview records in `ERROR` state | 1; dependency-update Preview |
| All Production records | `main` branch |

The one error is still a Preview deployment for classification purposes; `ERROR` is a state, not a third target. All other returned records were `READY`.

## Deployment metadata

Creator identity and email fields were intentionally omitted. The commit message is reduced to its first line for safe classification.

| Created UTC | Deployment ID | Classification/state | Branch | Commit SHA | PR | Commit message classification |
|---|---|---|---|---|---|---|
| 2026-08-26 11:18:28.466 | `dpl_88rHXwaA9pCuyCB4HReFYR9UsAim` | PREVIEW/READY | `feat/uiux-phase3-batch-g-assessment-experience-final` | `5bfae43f2cfb9eca52d076736749121e68c71ac2` | 78 | product UI |
| 2026-08-26 10:05:51.166 | `dpl_C5H9vixB7Lww1D1xisSxiDG2byGp` | PREVIEW/READY | `fix/postgres-baseline-status-classifier` | `f21e30b235b730f2c003a3766d91399689d0ba6b` | 77 | database/test classifier |
| 2026-08-26 09:29:55.289 | `dpl_BceRp93afxQxwY4kRHXQuhSDhvks` | PRODUCTION/READY | `main` | `b185ad21766c29d84ce403f3fc49606ad6919bad` | — | product UI |
| 2026-08-26 09:02:05.626 | `dpl_4qbroRRrwmCqvgjjkKVZQQoe3Kyb` | PREVIEW/READY | `feat/uiux-phase3-batch-f-learn-course-lesson-final` | `e4c86f84d30b2da1d10919f453a3c677345923b2` | 76 | product UI |
| 2026-08-26 08:13:50.739 | `dpl_Akzoho4KCL7LdPU6iJFrJFvy5oFm` | PRODUCTION/READY | `main` | `d54154d8c9b97738d85b748d4ab6bc298a7fb1c8` | — | governance/runtime |
| 2026-08-26 08:03:47.642 | `dpl_14i28KDrn9kRbkrHdV2fVxkUdctF` | PREVIEW/READY | `feat/cs1a-actor-audit-adapter-final` | `5d1ce87f2dcb6572e7a8b314ee677b29af4d369c` | 75 | governance/runtime |
| 2026-08-26 07:40:58.006 | `dpl_6kgddXsiAMxCMABvNDmTFsi3N6wv` | PRODUCTION/READY | `main` | `4988ebbf6674b51191f5689d51dabb4387e3b86f` | — | docs/governance |
| 2026-08-26 07:16:22.799 | `dpl_DEaRvGUmNiNrgCtVG5aFTVVhdvvM` | PREVIEW/READY | `docs/typecheck-gate-authority` | `0ab06de8c8097e8ab13b6c9b7ececfd9c312e616` | 74 | docs/governance |
| 2026-08-26 06:48:51.381 | `dpl_D7ZSPr1HndaX5QvWtvaSnzxouTRR` | PRODUCTION/READY | `main` | `da167a214e003284c41b6cda804bfcde41e9da9e` | — | product UI |
| 2026-08-26 06:38:48.169 | `dpl_Gcj5YcVNbwEZUrcR4wHDKF4AqWpz` | PREVIEW/READY | `feat/uiux-phase3-batch-e-shell-dashboard-final` | `01a4742c8d3d2f893862985806eb1cb9cf184de7` | 73 | product UI |
| 2026-08-26 05:07:29.552 | `dpl_DbYqCiv6RzXdPamdqEWzDhGdjNgY` | PRODUCTION/READY | `main` | `c80d81363ee65feadf17e2b7e5d8efe61351a964` | — | governance/runtime |
| 2026-08-26 04:54:48.027 | `dpl_5RYWRNw8NwtEHVKHG8AvJxiQoP3G` | PREVIEW/READY | `feat/cs1a-r2-r3-receipt-persistence` | `2e898886bce099c779399c02e1a4f25f9597ae8b` | 72 | governance/schema |
| 2026-08-26 04:34:48.527 | `dpl_DzVpsfSXJgTKDuocMpRi2Bi8bWns` | PRODUCTION/READY | `main` | `706063031b31459a2a0e16ce25da7b227b5bd309` | — | product UI |
| 2026-08-26 04:24:12.548 | `dpl_Av4Rj7BRfuznHvcznC3NA3NdoKbs` | PREVIEW/READY | `feat/hallmark-batch1-foundation` | `6ab770decb2eabb498b3d966061c928c67985818` | 71 | product UI |
| 2026-08-26 01:58:28.807 | `dpl_Dy5QKQ9ieAh1VS94yLeKZhxT3zNF` | PRODUCTION/READY | `main` | `5a3f715d904841692bb80bc2f94aa07838ca7112` | — | product/schema |
| 2026-08-26 01:48:35.923 | `dpl_DTFi39QqsshKMbXNeaa6nBPizKN6` | PREVIEW/READY | `feat/concept-persistence-cpa-rebind` | `ec9df9329a31565dab3160212d2f46b0b28ff661` | 69 | CI/schema |
| 2026-08-26 01:42:19.358 | `dpl_U1GV7dKp1qfpJE9sosi1Q2ZuZiT6` | PRODUCTION/READY | `main` | `3a0b773c58898bd5a9666c70c6081014b8821495` | — | product UI |
| 2026-08-26 01:28:57.439 | `dpl_2SpxReoBmgNipta5hF24qebPSPDo` | PREVIEW/READY | `fix/batch-d-mobile-table-overflow` | `ae436852f04b47c6a9f854cfe3f8a95d978d6bd5` | 70 | product UI |
| 2026-08-26 01:24:30.071 | `dpl_7uTCnf4E8uK9HGojUxNZ2rzsjvGL` | PREVIEW/READY | `feat/concept-persistence-cpa-rebind` | `4b2b6b45e9235af81657a2d835b3df94643a0f67` | 69 | CI/schema |
| 2026-08-26 01:17:19.593 | `dpl_9YSbE6ukdaNPukm6UJu1LXJvLS9n` | PREVIEW/READY | `feat/concept-persistence-cpa-rebind` | `3ea447d8628f0fad25f5a8dc6ed6e191da6a42cd` | 69 | product/schema |
| 2026-08-26 01:06:39.147 | `dpl_Dj4TQpdimRSuPW9t55jJi2oGkbcz` | PRODUCTION/READY | `main` | `8c223f8969b5ee71560d8a54474cd5cf951098f0` | — | product/AI search |
| 2026-08-26 00:54:41.732 | `dpl_EkT7txQhCvaovEbf8VwEw3zdks43` | PREVIEW/READY | `feat/ai-search-baseline-v1-freeze` | `b4e95b835aa1047461faea81356cfeffd493c00e` | 68 | product/AI search |
| 2026-08-25 23:53:54.007 | `dpl_cehfo8nzoHLoi5KWgfT1rELdK49o` | PRODUCTION/READY | `main` | `41faf755ce5f4ce3c6233d9f90ff94755008f0d2` | — | governance |
| 2026-08-25 23:22:51.669 | `dpl_D5a5LxFRRS5ZJuxCDafseiJAW3na` | PREVIEW/READY | `audit/cs1a-receipt-contract-discovery` | `8441f2748ba169c6dbe0fa283ce78c3e24bf8afa` | 67 | audit/governance |
| 2026-08-25 23:19:01.705 | `dpl_319r1nSMgS7QUPhCDjbSjcP5g8Cz` | PRODUCTION/READY | `main` | `9f8eb384f1dd859cfbd22ed384cfa94a7630c23a` | — | test/database |
| 2026-08-25 23:07:01.480 | `dpl_3RUzpSY7qdZ5WxirZziynFcvG4cW` | PREVIEW/READY | `fix/pr59-base01-clean-mainline` | `f2078fb32919aff36264eab4950b08b5286c33c1` | 66 | test/database |
| 2026-08-25 22:27:05.367 | `dpl_4b6NwpcWzcPPfHsYXY545awRDbrF` | PREVIEW/ERROR | `dependabot/npm_and_yarn/npm-minor-and-patch-422023fff8` | `ff7c5ad616bee9e11ff5779e22682a8a8a88d384` | 28 | dependency update |
| 2026-08-25 08:54:50.208 | `dpl_JBaSUuqdbDxA1nACuFCTBNCVHjpo` | PREVIEW/READY | `fix/pr59-base01-host-port-transient` | `01f6adeacc200696e600a8174612f41dfa12168d` | 65 | test |
| 2026-08-25 08:47:48.908 | `dpl_Mpkuw7Mtk9P3b6jcEBzHXkE3anJX` | PREVIEW/READY | `fix/pr59-base01-host-port-transient` | `818e7cf96bad07e450d27cd21a2bb32da97126b2` | 65 | test |
| 2026-08-25 08:43:44.559 | `dpl_HDeSWxk4ZCpLaRu5uTZ4VTp99gSR` | PREVIEW/READY | `fix/pr59-base01-host-port-transient` | `78217fd0c4b6667c4ee595a5c006ddfdc8a711fb` | 65 | test |
| 2026-08-25 08:20:15.105 | `dpl_GbHvMTXSw7iPwd92oCBH2oa2hubd` | PREVIEW/READY | `diag/pr59-base01-hosted-observability` | `809bc970591d1d005eb11ab0db3b55d0c81f4bc1` | — | diagnostic/test |
| 2026-08-25 08:17:35.101 | `dpl_C8598P2Zhmry5LVKBBeCQTfZzJR3` | PREVIEW/READY | `diag/pr59-base01-hosted-observability` | `4441c9752f83f1c978afb03b481a1ea2c6e0934d` | — | diagnostic/test |
| 2026-08-25 07:42:59.289 | `dpl_8qdqcHKYpsE8K9KnhkiLjeViHadi` | PRODUCTION/READY | `main` | `f85f8cac5560c0d86c9549ec41cadd64ab461a24` | — | test/database |
| 2026-08-25 07:33:47.209 | `dpl_6SkHpR4J1Zkv5HXmvtGprHAyw6Lo` | PREVIEW/READY | `fix/postgres-baseline-crossplatform-ci` | `2a2416272b4d925cfe5bc45ea3e2be343fee71e2` | 59 | CI/database |
| 2026-08-25 07:28:37.494 | `dpl_6X59sPrT9vvkRJzEWgsdfx9FfT1T` | PRODUCTION/READY | `main` | `084f1869aaceadbca7f9118d4a8a41091138389a` | — | product UI |
| 2026-08-25 07:27:44.910 | `dpl_5QsW9J6kH8LopoVxpXzd1rwJJAw5` | PREVIEW/READY | `fix/postgres-baseline-crossplatform-ci` | `430a19dddd8c1843d754f96896df9529718628d7` | 59 | test/database |
| 2026-08-25 06:59:14.488 | `dpl_6UXPRQ2BA8ceas4EZQt9sFJMmLp1` | PREVIEW/READY | `audit/uiux-phase3-batch-c-publication` | `0090220f771237735389cf68cb5a6723c1156396` | 64 | audit/UI |
| 2026-08-25 06:56:56.388 | `dpl_5XfVPnLbjMv9w8V4WHqNPcEGYh8L` | PREVIEW/READY | `audit/uiux-phase3-whole-system` | `be1e4e694c51329449252511d8e3ef61770593d9` | 63 | audit/UI |
| 2026-08-25 06:52:12.194 | `dpl_3xuiqoGmovBxPoDEAz19JWfW9vWM` | PRODUCTION/READY | `main` | `6517e6c35d182784720d55f223d64b7a835d63d6` | — | test/AI search |
| 2026-08-25 06:40:16.155 | `dpl_9NgESDZwesTPKw2F5bwERrEfWeNw` | PREVIEW/READY | `design/ai-search-evaluation` | `5653d7e3c4cac130573a17ac0f3f59e7700c176b` | 62 | test/AI search |

## Direct churn findings

### Branch push and repeated push evidence

The data proves that non-main branch commits create Preview deployments and that repeated commits on the same branch create repeated Preview deployments.

| Branch | Preview deployment count | Distinct commit count |
|---|---:|---:|
| `feat/concept-persistence-cpa-rebind` | 3 | 3 |
| `fix/pr59-base01-host-port-transient` | 3 | 3 |
| `diag/pr59-base01-hosted-observability` | 2 | 2 |
| `fix/postgres-baseline-crossplatform-ci` | 2 | 2 |

Repeated Preview branch count: **4**. Repeated Preview deployment count: **10 records across those branches**, or **6 deployments beyond the first deployment per repeated branch**. This directly proves push-driven churn; it does not prove that every local worktree was pushed.

### Production and Preview mapping

All 14 Production records in the window are on `main`, proving the main→Production connection for this project. Preview records include product, feature, audit, docs, diagnostic, test-oriented, dependency, and schema/governance branches.

Strong Preview→Production conceptual pair count: **11**, based on PR metadata, matching first-line commit messages, and chronological order. One additional **MEDIUM** correlation exists for PR 59’s test/database branch family and later main production commit, yielding **12 candidate conceptual pairs** if medium-confidence family correlation is included. Two audit/publication Preview records (PRs 63 and 64) converge on one related main UI production commit, so candidate-pair count is not a unique-production-deployment count.

High-confidence examples include:

- PR 76: `feat/uiux-phase3-batch-f-learn-course-lesson-final` Preview → `main` production with matching Learn UI message.
- PR 75: `feat/cs1a-actor-audit-adapter-final` Preview → `main` production with matching CS1A message.
- PR 74: `docs/typecheck-gate-authority` Preview → `main` production with matching docs message.
- PR 71: `feat/hallmark-batch1-foundation` Preview → `main` production with matching Hallmark message.
- PR 69: three Preview commits on `feat/concept-persistence-cpa-rebind` → later CP-A `main` production.
- PRs 63/64: audit UI Preview records → related main UI production; the two Preview records are not counted as two unique production releases.

### Evidence-only and diagnostic Preview proof

| Question | Direct result |
|---|---|
| Audit Preview Proven | YES — `audit/cs1a-receipt-contract-discovery`, `audit/uiux-phase3-batch-c-publication`, `audit/uiux-phase3-whole-system` |
| Docs Preview Proven | YES — `docs/typecheck-gate-authority` |
| Diagnostic Preview Proven | YES — two records on `diag/pr59-base01-hosted-observability` |
| Test-only Preview Proven | YES for test-oriented commits; three `fix/pr59-base01-host-port-transient`, two `diag/*`, two `fix/postgres-baseline-crossplatform-ci`, and `design/ai-search-evaluation` records are test/diagnostic-oriented. No literal `test/**` branch was needed to prove the behavior. |

These records prove that evidence-only-looking branch names do not automatically avoid Preview deployments. They do not by themselves prove that every such change is safe to skip.

## GitHub CI duplication assessment

The repository workflow evidence remains unchanged: `.github/workflows/ci.yml` runs on every PR and on pushes to `main`, and runs `npm run build` after typecheck-adjacent schema/test validation; `.github/workflows/e2e.yml` invokes another `npm run build` through `npm run test:e2e` on main/manual/schedule triggers. The Vercel records contain no GitHub Actions run IDs, so exact same-commit CI-run confirmation is not available from the deployment connector.

Classification: **MIXED**.

- Vercel Preview has runtime Preview value for UI/API behavior and deployable-artifact validation.
- Vercel Preview overlaps GitHub CI on compilation/build validation.
- GitHub CI remains necessary for code validation, migration proofs, unit/integration tests, and repository trust.
- No recommendation is made to remove CI or weaken runtime validation.

## Local worktree firewall

**Local Worktree Direct Deployment Contribution = 0.**

The 140 local worktrees do not create Vercel deployments by themselves. The direct deployment records are caused by remote Git events integrated with Vercel. Worktrees can indirectly contribute only when their commits are pushed to an eligible remote branch.

## Historical 574 claim

Prior 574 estimate: **UNVERIFIED**. The 40-record Vercel window proves churn, but it is not a full retained history and cannot be promoted to an exact historical count. The connector returned pagination beyond this window; no claim is made about records outside the requested 40.

## Churn classification

| Dimension | Classification |
|---|---|
| Preview build churn | HIGH |
| Repeated branch push churn | HIGH |
| Evidence-only Preview churn | HIGH — audit/docs/diagnostic/test-oriented records are directly observed |
| Feature Preview + main Production duplication | HIGH as a recurring workflow pattern; 11 high-confidence conceptual pairings in the window, plus one medium family correlation |

Overall build-churn conclusion: **HIGH**. This is now directly supported for the observed 40-record window, while the exact 574 historical total remains unverified.

## Safe-skip revalidation

The deployment evidence strengthens the case for a changed-file classifier because docs, audit, diagnostic, and test-oriented branches did receive Preview deployments. It does not expand the safe class automatically.

Candidate SKIP classes remain:

- `docs/**` only, when proven absent from runtime/build-time inputs.
- `reports/**` only, when proven absent from runtime/build-time inputs.
- Approved governance reference/evidence-only files, when proven absent from runtime/build-time inputs.
- Approved non-runtime diagnostics, with the same proof requirement.

The prior runtime analysis remains applicable: current `app/**` does not import the requested docs/report classes, but tests and offline/content-generation scripts do read evidence artifacts. Therefore these classes are **conditionally safe**, not unconditionally safe.

Always BUILD:

- `app/**`, `components/**`, runtime `lib/**`, `public/**`.
- `package.json`, lockfiles, `next.config.*`, `tsconfig*`, build scripts.
- API routes, schema, migrations, generated runtime inputs, assets, and dependency changes.
- Mixed runtime plus docs/report/evidence commits.
- Renames into runtime paths, deleted runtime files, unknown paths, parser errors, diff failures, and missing base SHA.

Explicit test-only policy: **SKIP_PREVIEW_BUT_KEEP_GITHUB_CI** is allowable only for a future proven test-only classifier policy with zero production runtime/build dependency on those test files. Until that policy is implemented and proven, operational default is **BUILD**. This preserves the required fail-safe behavior.

## Recommended P3 architecture and expected impact

The recommended architecture remains:

`Vercel Ignored Build Step + deterministic changed-file classifier + fail-safe BUILD default`.

Do not use broad branch-name skips. Observed `perf`, `content`, `governance`, `audit`, `docs`, diagnostic, and test-oriented work can represent materially different runtime or validation risk.

| Expected effect | Qualitative result |
|---|---|
| Preview deployments avoided | HIGH potential in this observed evidence-heavy workflow |
| Build CPU reduction | MEDIUM; exact CPU attribution and savings are unavailable |
| Duplicate validation reduction | MEDIUM; CI remains, but non-runtime Preview work can be removed |
| False-skip risk | LOW with strict allowlist and fail-safe BUILD; HIGH with branch filters |

## Exact future implementation scope

Likely bounded files, not implemented:

- `scripts/vercel-ignore-build.mjs` (or repository-equivalent deterministic classifier).
- `vercel.json` only if required to connect the ignored-build command.
- `tests/vercel-ignore-build.test.mjs` with the required matrix.
- `docs/vercel.md` or a dedicated report/policy update documenting reviewed runtime inputs and override rules.
- `package.json` only if a script entry is necessary; no package change is currently justified.

Required security behavior:

- Unknown, parser error, git diff failure, missing base SHA, and mixed commit → BUILD.
- Normalize repository-relative paths and reject absolute/traversal paths.
- Inspect both sides of renames and treat deleted runtime files as BUILD.
- Treat generated runtime artifacts, dependencies, public assets, schema, and migrations as BUILD.

## Closure final result

| Field | Result |
|---|---|
| Final Status | `SECURIUM_VERCEL_P3_BUILD_CHURN_EVIDENCE_CLOSURE_PASS_READY_FOR_BOUNDED_IMPLEMENTATION_AUTHORIZATION` |
| Deployment Evidence Record Count | 40 |
| Preview Count | 26 |
| Production Count | 14 |
| Error Count | 1 |
| Distinct Preview Branch Count | 20 |
| Repeated Preview Branch Count | 4 |
| Repeated Preview Deployment Count | 10 records across repeated branches; 6 repeat-after-first deployments |
| Feature Preview/Main Production Pair Count | 11 high-confidence; 12 including one medium PR-59 family correlation |
| Audit Preview Proven | YES |
| Docs Preview Proven | YES |
| Diagnostic Preview Proven | YES |
| Test-Only Preview Proven | YES, test-oriented commits; default policy remains BUILD until classifier proof |
| GitHub CI + Vercel Duplicate Build Layers | YES, distinct purposes; classification MIXED |
| Local Worktree Direct Deployment Contribution | 0 |
| Prior 574 Estimate Status | UNVERIFIED |
| Preview Build Churn | HIGH |
| Repeated Push Churn | HIGH |
| Evidence-Only Preview Churn | HIGH |
| Preview/Production Duplication | HIGH recurring pattern |
| Safe Skip Classes | Proven docs-only, reports-only, approved governance evidence-only, approved diagnostics only after runtime/build import proof |
| Unsafe Build Classes | Runtime, API, components, runtime lib, public, package/lock/config, schema/migration, generated inputs, mixed, unknown, rename/delete edge cases |
| Test-Only Policy | Default BUILD; future guarded SKIP_PREVIEW_BUT_KEEP_GITHUB_CI only after zero-dependency proof |
| Recommended P3 Architecture | Vercel ignored-build hook plus changed-file classifier |
| Fail-Safe Default | BUILD |
| Expected Preview Reduction | HIGH potential |
| Expected Build CPU Reduction | MEDIUM |
| Exact Future Candidate Files | `scripts/vercel-ignore-build.mjs`, optional `vercel.json`, `tests/vercel-ignore-build.test.mjs`, `docs/vercel.md`/report policy |
| Security Critical | Fail closed for unknown/mixed/parser/diff/base-SHA/rename/delete/generated-runtime cases |
| Security High | Path traversal, branch-name bypass, incomplete diff, dependency/config omission |
| Data Trust Critical | Preserve GitHub CI; no schema/migration bypass; database write 0 |
| Data Trust High | Evidence-only allowlist requires runtime/build import proof and review |
| P0 Changed | NO |
| P1 Changed | NO |
| P2 Changed | NO |
| Auth Changed | NO |
| Governance Changed | NO |
| Schema Changed | NO |
| Migration Changed | NO |
| Vercel Changed | NO |
| Commit | NO |
| Push | NO |
| PR | NO |
| Merge | NO |
| Deployment | NO |
| Production Connection | NO; production metadata was read only |
| Ready For Bounded P3 Implementation | YES — authorization gate now ready; implementation not performed |
| Ready For P4 | YES for separate observability design |
| Recommended Next Step | Authorize the bounded classifier implementation, then validate it against the deterministic matrix before enabling it in Vercel |

## Closure gate

`SECURIUM_VERCEL_P3_BUILD_CHURN_EVIDENCE_CLOSURE_PASS_READY_FOR_BOUNDED_IMPLEMENTATION_AUTHORIZATION`

The evidence gap is closed for mechanism understanding and bounded design authorization. The 574 total remains unverified, and no measured cost reduction is claimed.

---

# P3 BOUNDED IMPLEMENTATION

Implementation authorization: `AUTHORIZE_P3_BUILD_CHURN_BOUNDED_IMPLEMENTATION`  
Snapshot date: **2026-08-28**

## Implementation result

`SECURIUM_VERCEL_P3_BUILD_CHURN_BOUNDED_IMPLEMENTATION_PASS_READY_FOR_REVIEW`

The implementation is limited to the classifier, its deterministic tests, the minimum Vercel hook configuration, and this report update. No application/runtime, database, workflow, auth, content, governance runtime, or P0/P1/P2 files were modified.

## Classifier contract

Implemented at `scripts/vercel-ignore-build.mjs` and wired by `vercel.json`:

- Vercel `ignoreCommand` invokes `node scripts/vercel-ignore-build.mjs`.
- `VERCEL_GIT_PREVIOUS_SHA` is the comparison base and `VERCEL_GIT_COMMIT_SHA` is the current deployment commit.
- Both SHAs must be present, 40-hex commit SHAs, present in the Git object database, and the current checkout `HEAD` must equal the Vercel commit SHA.
- The classifier obtains a NUL-delimited `git diff --name-status --find-renames -z BASE HEAD --` path set.
- Vercel Preview is eligible for classification; `VERCEL_ENV=production` or `VERCEL_TARGET_ENV=production` always returns BUILD.
- A non-empty diff is SKIP only when every changed path is within the explicit safe path classes and approved text/evidence extensions.
- Vercel exit semantics are documented in code: exit `0` means ignore/skip the build; exit `1` means continue the build.
- Output is concise and non-secret: `VERCEL_BUILD_DECISION=BUILD|SKIP` plus a reason.

Safe classes implemented:

- `docs/` with approved evidence/document extensions: `.md`, `.json`, `.csv`, `.pdf`, `.png`, `.txt`.
- `reports/` with the same approved evidence/document extensions.
- `governance/reference/` and `governance/evidence/` with the same extensions.

The safe governance paths are explicit reference/evidence subtrees only. `lib/policy/**`, `lib/services/**`, `app/admin/**`, and other runtime governance paths are not safe classes.

Test-only policy: **BUILD by default**. `tests/**` is not in the safe allowlist because tests may encode build/runtime contracts and Preview validation value is not a sufficient reason to bypass fail-safe behavior. A future explicitly proven policy could skip Preview while retaining GitHub CI, but this V1 does not.

Always-BUILD classes include `app/**`, `components/**`, runtime `lib/**`, `public/**`, package and lockfiles, `next.config.*`, TypeScript/build configuration, API routes, database schema, migrations, runtime adapters, auth, middleware/proxy, generated runtime data, source evidence, tests, mixed diffs, unknown files, renames involving runtime/unknown paths, and deleted runtime files.

## Fail-safe rules

The implementation returns BUILD for missing or invalid SHAs, unavailable Git objects, unexpected checkout state, Git command failure, empty/unexpected diff output, path traversal/absolute paths, parser errors, unknown extensions/classes, mixed changes, renames with either unsafe side, deleted runtime files, and production environment detection. No exception path returns SKIP.

Path normalization converts backslashes to POSIX separators and rejects absolute paths, drive-qualified paths, `.` segments, `..` traversal, empty paths, and malformed Git status records. Rename/copy statuses add both old and new paths to the decision set.

## Deterministic tests

Added `tests/vercel-ignore-build.test.mjs` with 8 passing tests covering:

- docs-only → SKIP;
- reports-only → SKIP;
- approved governance evidence-only → SKIP;
- app/component/lib/API/package/lockfile/schema/migration/public/config/auth/proxy/source-evidence/test paths → BUILD;
- mixed, unknown, traversal-like, malformed, rename, and deletion cases → BUILD;
- missing SHA, invalid SHA/object, HEAD mismatch, Git diff failure, and parser error → BUILD;
- production → BUILD;
- explicit test-only policy → BUILD;
- actual subprocess exit semantics: SKIP exit `0`, BUILD exit `1`.

## Historical sample validation

Seven read-only branch-diff samples were classified using the implemented classifier:

| Sample | Changed-file result | Classifier decision |
|---|---|---|
| `docs/typecheck-gate-authority` | one docs Markdown path | SKIP |
| `audit/cs1a-receipt-contract-discovery` | `lib/policy/*` runtime governance code | BUILD |
| `audit/uiux-phase3-whole-system` | `app/**`, `components/**` | BUILD |
| `diag/pr59-base01-hosted-observability` | `tests/**` | BUILD |
| `fix/batch-d-mobile-table-overflow` | component CSS | BUILD |
| `perf/vercel-progress-polling-p2-audit` | components, reports, tests | BUILD |
| `feat/concept-persistence-cpa-rebind` | schema, migrations, runtime adapters, workflow/tests | BUILD |

Historical sample count: **7**. Historical sample SKIP count: **1**. Historical sample BUILD count: **6**. Historical misclassification count: **0**. These are theoretical classifier decisions over recovered Git diffs, not measured avoided deployments or savings.

## Validation

| Gate | Result |
|---|---|
| Focused classifier tests | PASS — 8 tests |
| Classifier tests passed | 8 |
| Typecheck | PASS |
| Lint | PASS |
| Unit | PASS — 59 tests |
| Integration | PASS |
| Migration guard | PASS — 10 tests |
| DB check | PASS — Drizzle reports everything fine |
| Build | PASS — Next.js 16.2.6, 63 generated pages/routes |

All database activity during tests was local/temporary fixture activity required by existing tests. No production connection or remote database write was used; P3 database write remains **0**.

## File and firewall result

| Classification | Exact paths |
|---|---|
| `P3_CLASSIFIER` | `scripts/vercel-ignore-build.mjs` |
| `P3_TEST` | `tests/vercel-ignore-build.test.mjs` |
| `P3_VERCEL_CONFIG` | `vercel.json` |
| `P3_REPORT` | `reports/securium-vercel-p3-build-churn-audit-2026-08-28.md` |
| `OTHER` | 0 |

New implementation/config/test lines: **222**. Append-only implementation report lines: **257**. Total lines added this turn: **479**. Lines removed: **0**. The report was already an untracked audit artifact from the prior authorized task; its earlier content was preserved.

| Firewall | Result |
|---|---|
| P0 changed | NO |
| P1 changed | NO |
| P2 changed | NO |
| Auth changed | NO |
| Governance runtime changed | NO |
| Schema changed | NO |
| Migration changed | NO |
| DB write | 0 |
| Vercel Dashboard changed | NO |
| Deployment triggered | NO |
| Commit / push / PR / merge | NO / NO / NO / NO |
| Production connection | NO |
| Security Critical | 0 |
| Security High | 0 |
| Data Trust Critical | 0 |
| Data Trust High | 0 |

## Implementation final result

| Field | Result |
|---|---|
| Final Status | `SECURIUM_VERCEL_P3_BUILD_CHURN_BOUNDED_IMPLEMENTATION_PASS_READY_FOR_REVIEW` |
| Snapshot Date | 2026-08-28 |
| Worktree | `securium-vercel-build-p3` |
| Branch | `audit/vercel-build-churn-p3` |
| HEAD | `6ca3b0736dd8cef7b1d3ba3fd228c6d1689a8095` |
| Fresh origin/main | `6ca3b0736dd8cef7b1d3ba3fd228c6d1689a8095` |
| Main Match | YES |
| Ignored Build Mechanism | `vercel.json` `ignoreCommand` invoking `scripts/vercel-ignore-build.mjs` |
| Vercel Exit Semantics | exit 0 SKIP; exit 1 BUILD/continue |
| Exact Added Files | `scripts/vercel-ignore-build.mjs`; `tests/vercel-ignore-build.test.mjs`; `vercel.json` |
| Exact Modified Files | report append only; no tracked files modified |
| Exact Deleted Files | none |
| Exact Untracked Files | report, classifier, test, `vercel.json` |
| Lines Added | 479 this turn |
| Lines Removed | 0 |
| P3 Classifier Path | `scripts/vercel-ignore-build.mjs` |
| P3 Test Path | `tests/vercel-ignore-build.test.mjs` |
| P3 Vercel Config Path | `vercel.json` |
| P3 Report Path | `reports/securium-vercel-p3-build-churn-audit-2026-08-28.md` |
| Safe Skip Classes | Explicit docs/report evidence extensions; approved governance reference/evidence subtrees |
| Test-Only Policy | BUILD in V1; future guarded skip may retain GitHub CI |
| Always Build Classes | Runtime, auth, API, schema, migrations, dependencies, config, public, tests, source evidence, mixed, unknown, unsafe rename/delete |
| Unknown Default | BUILD |
| Production Policy | Always BUILD |
| Preview Policy | Classify only with trusted Vercel SHA inputs; SKIP proven safe non-runtime-only diff; otherwise BUILD |
| Missing SHA Result | BUILD / `missing_comparison_sha` |
| Invalid SHA Result | BUILD / `invalid_comparison_sha` |
| Git Failure Result | BUILD / `git_diff_failure` |
| Parser Failure Result | BUILD / parser/classifier error |
| Mixed Diff Result | BUILD / `runtime_or_unknown_change` |
| Rename Runtime Result | BUILD |
| Delete Runtime Result | BUILD |
| Focused Tests | PASS |
| Classifier Test Count | 8 |
| Classifier PASS Count | 8 |
| Historical Sample Count | 7 |
| Historical Sample SKIP Count | 1 |
| Historical Sample BUILD Count | 6 |
| Historical Misclassification Count | 0 |
| Typecheck | PASS |
| Lint | PASS |
| Unit | PASS |
| Integration | PASS |
| Migration Guard | PASS |
| DB Check | PASS |
| Build | PASS |
| Security Critical | 0 |
| Security High | 0 |
| Data Trust Critical | 0 |
| Data Trust High | 0 |
| P0 Changed | NO |
| P1 Changed | NO |
| P2 Changed | NO |
| Auth Changed | NO |
| Governance Runtime Changed | NO |
| Schema Changed | NO |
| Migration Changed | NO |
| DB Write | 0 |
| Vercel Dashboard Changed | NO |
| Deployment Triggered | NO |
| Commit | NO |
| Push | NO |
| PR | NO |
| Merge | NO |
| Production Connection | NO |
| Ready For Review | YES |
| Ready For Commit Authorization | YES, after review |
| Ready For P4 Observability Design | YES |
| Remaining Preconditions | Review classifier policy and diff semantics; authorize commit; later enable/verify Vercel control-plane behavior separately |
| Recommended Next Step | Review the four untracked files, then authorize commit if accepted |

## CLASSIFIER CONTRACT

SKIP is allowed only for a Preview environment with trusted, valid Vercel base/current commit SHAs, a trustworthy checkout and Git diff, a non-empty complete diff, and every changed path inside the explicit proven non-runtime allowlist. Production always BUILD.

## FAIL-SAFE

Unknown, error, parser failure, Git failure, missing/invalid SHA, missing base, mixed change, unsafe rename, or deleted runtime path always BUILD.

## PRODUCTION

Production/main is never skipped in this V1. `VERCEL_ENV=production` or `VERCEL_TARGET_ENV=production` returns BUILD.

## PREVIEW

Preview deployments are optimized only when the complete changed-file set is proven non-runtime. Branch names are ignored as a safety decision.

## SAFE SKIPS

The exact eligible classes are docs/report evidence files with approved extensions and governance reference/evidence subtrees. Source evidence, tests, policy/services code, and runtime-generated data are not safe skips.

## RUNTIME FIREWALL

Runtime, auth, schema, migration, API, public asset, dependency/configuration, governance runtime, mixed, unknown, rename, and deletion changes always BUILD.

## VALIDATION

Focused classifier tests passed 8/8. Typecheck, lint, unit, integration, migration guard, DB check, and build all passed.

## HISTORICAL SAMPLE

Seven recovered branch diffs produced one theoretical SKIP and six BUILD decisions with zero misclassifications. This is classifier validation only, not measured deployment avoidance or cost savings.

## VERCEL

The Vercel `ignoreCommand` configuration was prepared locally. No manual deployment, Dashboard mutation, project setting change, environment change, production connection, commit, push, PR, or merge occurred.

## NEXT GATE

`REVIEW_AND_COMMIT_P3_BUILD_CHURN_BOUNDED_IMPLEMENTATION`

---

# P3 FINAL REVIEW

Review date: **2026-08-28**

The final review confirmed that the implementation remains within the approved four-file scope. A fail-safe ancestry check was added after implementation review: `VERCEL_GIT_PREVIOUS_SHA` must be an ancestor of `VERCEL_GIT_COMMIT_SHA`; otherwise the result is BUILD with `no_trustworthy_merge_base`. This prevents a valid but unrelated Git object from becoming a skip comparison base.

The Vercel contract was independently reconfirmed against the current Vercel documentation: `vercel.json.ignoreCommand` exit `0` skips the build and exit `1` continues the build. The configured command is exactly `node scripts/vercel-ignore-build.mjs` and has no shell-specific quoting or Windows-only assumption.

Final review gates: focused classifier **8/8 PASS**; historical samples **7 total, 1 SKIP, 6 BUILD, 0 misclassification**; typecheck **PASS**; lint **PASS**; unit **448 PASS**; integration **PASS**; migration guard **PASS**; `db:check` **PASS**; build **PASS**. No new skip, only, todo, assertion weakening, or unrelated file was introduced.

The repository remains at fresh main authority `6ca3b0736dd8cef7b1d3ba3fd228c6d1689a8095` before commit. P0/P1/P2, auth, governance runtime, schema, migrations, evidence, MCP, workflows, database state, and Vercel Dashboard remain unchanged. No deployment or production connection occurred.
