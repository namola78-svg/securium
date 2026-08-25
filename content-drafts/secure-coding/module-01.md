# Module 01 — Secure Coding Foundations

Time: 25 minutes

## Concept → Role → Skill → Tool/Technology

Trust boundaries and secure defaults → backend/web developer → threat-aware design and defensive coding → Java, Servlet, HTTP, IDE tests. Related certification: application-security domain (conceptual only).

## Lesson

Security defects begin as incorrect assumptions about who controls a value, where it travels, and what a downstream component interprets. Draw a small data-flow map: request source → parsing/validation → business rule → persistence or response sink. Mark identity boundaries, network boundaries, and privileged operations. A secure default denies or safely limits behavior when a check fails or a dependency is unavailable.

## Example

```java
String displayName = request.getParameter("displayName");
// Unsafe assumption: a request parameter is harmless because it came from our form.
```

The browser is not a trust boundary. The server must treat the value as untrusted until its grammar and use are established.

## Exercise

Draw the flow for an avatar upload and label three sources, two sinks, and one authorization decision. Identify a failure-safe default.

## Instructor notes

Ask learners to distinguish “unexpected” from “malicious.” Both deserve deterministic handling. Do not begin with payloads; begin with assumptions.

## Learner takeaway

Security is a property of the whole data flow, not a regex placed on one field.
