# Module 12 — Dependency / Supply-Chain Security

Time: 25 minutes

## Concept → Role → Skill → Tool/Technology

Dependency risk management → developer/maintainer → inventory, pin, review, update, and respond → package lockfile, SBOM tooling, CI scanner. Related certification: secure SDLC domain (conceptual only).

## Lesson

Runtime direct and transitive dependencies generally execute with the application’s privileges; build-only tools have a different execution context but can still affect artifacts and CI. Maintain a reproducible lockfile, review changes, monitor advisories, remove unused packages, and assign owners. A scanner result is a triage input, not proof that a vulnerability is exploitable or harmless. Verify provenance and protect CI credentials.

## Exercise

Write a dependency review note covering direct/transitive status, affected path, exploitability questions, upgrade plan, and compensating control.

## Instructor notes

Distinguish a known vulnerable version from reachable vulnerable behavior without weakening urgent patch response.

## Learner takeaway

Supply-chain security is a shared operating habit across code, build, and release owners.
