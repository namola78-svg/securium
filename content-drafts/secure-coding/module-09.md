# Module 09 — Sensitive Information Exposure

Time: 25 minutes

## Concept → Role → Skill → Tool/Technology

Data minimization and protection → developer → classify, limit, redact, and dispose of sensitive data → secret manager, TLS, structured logging. Related certification: information protection domain (conceptual only).

## Lesson

First ask whether a sensitive value must be collected or returned. Minimize it before adding encryption. Keep secrets out of source control and logs, use a managed secret store, protect transport, and define retention and deletion. Redaction must cover structured fields, traces, crash dumps, analytics, and support exports.

## Exercise

Design a response and log policy for a payment-profile endpoint. Mark fields return, internal-only, redact, or never collect.

## Instructor notes

Include observability and support systems in the data-flow discussion.

## Learner takeaway

The safest secret is one the system does not need to possess or expose.
