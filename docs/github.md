# GitHub repository and CI preparation

> Status: repository files are prepared locally. No GitHub repository was
> created, no remote was added, and no commit or push was performed.

## Package and source-control policy

- Package manager: npm
- Reproducible install: `npm ci`
- Lockfile: `package-lock.json`
- Required Node.js version in CI: `22.13.0`
- Application runtime requirement: `package.json` specifies Node.js 22.13 or
  newer.

`.gitignore` excludes dependencies, framework/build output, Wrangler state,
environment files, local databases, uploads, imports, and temporary working
directories. `.env.example` is the only environment file explicitly allowed.

Before the first push, inspect the complete Git history as well as the working
tree for secrets. `.gitignore` does not remove a secret that was committed
earlier.

## Pull request CI

`.github/workflows/ci.yml` runs for pull requests and pushes to `main`:

1. checkout with read-only repository permission;
2. locked dependency installation;
3. Drizzle migration metadata generation and drift detection;
4. Drizzle schema/migration validation;
5. isolated local D1 migration and seed;
6. TypeScript typecheck;
7. lint;
8. unit tests;
9. integration smoke tests;
10. production build.

The workflow has `contents: read`, cancels superseded runs, uses npm caching,
has a job timeout, references no repository secret, and uses only the local
Wrangler D1 database. It never runs a migration against a remote identifier.

The workflow uses the `pull_request` event, not `pull_request_target`. Fork pull
requests therefore receive no configured secrets and only a read-only token.
Repository administrators should keep GitHub's “send secrets to fork pull
requests” and “send write tokens” settings disabled.

## Full E2E

The full suite is intentionally separated in `.github/workflows/e2e.yml`
because it starts the application repeatedly and takes materially longer.
It runs manually, after a push to `main`, and weekly at a fixed UTC time.

It also creates only an isolated local D1 database and has no deployment step.
Pull requests still receive the representative integration smoke suite in the
required CI workflow.

## Dependency and code security

- Dependabot npm updates are already configured weekly.
- GitHub Dependency Review is recommended only when the destination repository
  has Dependency Graph and the required GitHub Code Security entitlement. It
  was not made a required workflow because repository visibility and licensing
  are not yet known.
- CodeQL is recommended after the repository is created. Enable GitHub default
  setup first to avoid maintaining a duplicate custom workflow.
- Protect `main` and require Pull request CI, at least one review, resolved
  conversations, and dismissal of stale approvals.
- Restrict workflow changes through CODEOWNERS when maintainers are known.

## Repository creation checklist

1. Choose the owner, visibility, licensing, and retention policy.
2. Create the repository manually after approval.
3. Review issue and security instructions for the selected organization.
4. Run a secret-history scan.
5. Add the remote without embedding a token in its URL.
6. Push only after reviewing the initial commit.
7. Configure branch protection and Actions fork policy.
8. Enable private vulnerability reporting.

Relevant GitHub documentation:

- [Building and testing Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [Workflow permissions and fork settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
- [Workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
