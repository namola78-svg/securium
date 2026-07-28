# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private
security advisory feature for this repository and include:

- the affected route, component, or workflow;
- reproduction steps with secrets and personal data removed;
- the expected and observed security impact;
- a minimal proof of concept, if safe;
- any suggested mitigation.

Never include passwords, session or OAuth tokens, API keys, resident
registration numbers, answer contents, production database exports, or private
uploaded files.

Maintainers should acknowledge a complete report as soon as practical, assess
severity, prepare a private fix, run the security regression suite, and publish
only the minimum remediation detail necessary after affected deployments are
updated.

## Supported version

Only the current default branch is maintained. Development seed accounts,
Mock AI output, local D1 data, and LocalStorageProvider data are not production
services.

## Security boundaries

- Authentication and authorization must be enforced on the server.
- Production secrets belong in the hosting provider, never in Git.
- Database migrations and storage policy changes require review and explicit
  deployment approval.
- Do not weaken `.gitignore`, `.openai/hosting.json`, CSP, CSRF checks, audit
  logging, or user/course data isolation without a documented security review.
