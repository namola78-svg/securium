# Module 10 — Error Handling / Logging

Time: 25 minutes

## Concept → Role → Skill → Tool/Technology

Safe failure and useful telemetry → developer → separate user messages from operator diagnostics → Servlet error handling, structured logger, correlation IDs. Related certification: operations/application security domain (conceptual only).

## Lesson

Protected actions should fail closed, user responses should avoid stack traces and secrets, and operators should receive safe, correlated context. Do not log passwords, session tokens, raw authorization headers, or complete request bodies by default. Strip or reject CR/LF before constructing a redirect or header value; ideally allow only an approved relative route. An `@ModelAttribute` value reflected into a response remains untrusted; the annotation does not encode it.

## Exercise

Rewrite an exception handler that returns `exception.getMessage()` and logs a request body. Keep a correlation ID and safe client error.

The template’s auto-escaping may make a specific HTML text sink safer, while raw output or the wrong context remains unsafe.

## Instructor notes

Discuss both information disclosure and log injection. More logs are not automatically better.

## Learner takeaway

Fail safely for users, diagnose safely for operators, and treat reflected model data as untrusted.
