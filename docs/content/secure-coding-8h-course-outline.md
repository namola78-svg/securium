# Developer Secure Coding — 8-hour course outline

Status: authoring draft; content review required. This file is not a publication manifest and creates no canonical records.

## Audience and outcomes

Audience: software developers who build web services, APIs, and server-rendered applications. At the end of the course, learners can identify trust boundaries, choose allowlist validation, use parameterized data access, encode output for its context, constrain file operations, enforce authorization on the server, protect sessions and secrets, and review code for common weaknesses.

Delivery: 8 hours total, including 6 hours 45 minutes guided instruction and 1 hour 15 minutes exercises/review. Examples use Java-like syntax and are intentionally small enough to discuss in a code review.

## Schedule

| Module | Topic | Time | Applied outcome |
|---|---|---:|---|
| 01 | Secure Coding Foundations | 25 min | Draw trust boundaries and threat assumptions |
| 02 | Input Validation / Allowlist | 30 min | Validate structure, type, length, and range |
| 03 | Injection / Code Injection | 35 min | Separate data from instructions |
| 04 | SQL Injection | 35 min | Replace string-built queries with parameters |
| 05 | XSS / Output Encoding | 35 min | Encode at the output context |
| 06 | Path Traversal / File Handling | 35 min | Constrain and canonicalize file access |
| 07 | Authentication / Authorization | 35 min | Check identity and permission independently |
| 08 | Session / Cookie Security | 30 min | Configure session lifecycle and cookie flags |
| 09 | Sensitive Information Exposure | 25 min | Reduce, protect, and redact sensitive data |
| 10 | Error Handling / Logging | 25 min | Fail safely while preserving useful telemetry |
| 11 | Cryptography Basics | 35 min | Select primitives by purpose and key lifecycle |
| 12 | Dependency / Supply-Chain Security | 25 min | Make dependency risk visible and actionable |
| 13 | Secure API Coding | 35 min | Apply API-specific boundaries and abuse controls |
| 14 | Practical Code Review | 75 min | Produce a prioritized review with fixes and an integrated debrief |

The scheduled total is exactly 480 minutes. The additional 35 minutes in Module 14 are an integrated secure-coding review, exercise debrief, Q&A/checkpoint, and final code-review lab. Breaks are outside the instructional 8 hours and are not included in this total.

## Content model (design-only)

Concept → Role → Skill → Tool/Technology → Lesson → Exercise → Question → Related Certification → future Evidence mapping.

Examples: `output encoding → web developer → contextual output handling → Java Servlet/HTML → M05 → EX-05 → Q-05-01 → related certification: application-security domain → future evidence: reviewed code artifact (not created here)`.

## Assessment design

Fourteen short module checks, one practical review, and a final 20-question quiz bank. Questions are original drafts, not copied exam questions. Passing criteria for a future implementation should be decided during content review; this draft does not alter an evaluation model.

## Safety and scope notes

All examples are defensive teaching snippets. No exploit payload collection, real secrets, practical hashes, Evidence records, activation, or publication steps are included. External sources are not reproduced; terminology is common technical language and all explanatory prose is original to this draft.
