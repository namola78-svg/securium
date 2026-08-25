# Module 14 — Practical Code Review

Time: 40 minutes

## Concept → Role → Skill → Tool/Technology

Risk-prioritized code review → developer/reviewer → trace data flow and propose testable fixes → Java/Servlet checklist, unit tests, static analysis. Related certification: practical application-security domain (conceptual only).

## Lesson

Review in order: security objective; inputs to interpreters and sensitive sinks; authorization; normalization, encoding, and parameterization; then error, logging, session, dependency, and test behavior. Describe impact and preconditions, not just a rule violation. Prefer a narrow fix that preserves legitimate behavior and add regression tests.

## Exercise

Review a synthetic upload-and-comment endpoint containing direct filename use, reflected model input, a string-built query, and a UI-only owner check. Produce four findings with severity rationale, fix, and test.

## Instructor notes

Require a distinction between confirmed issue, plausible concern, and missing evidence. This draft is not an activated practical assessment.

## Learner takeaway

A useful review connects a concrete data flow to a concrete control and a test.
