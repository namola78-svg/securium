# M05 Human Re-verification Record

Complete this record after reading the requirement, reviewing the supplied
draft, applying or comparing the reference repair, and running the tests.
Replace every bracketed value with evidence. A checked box alone is not an
acceptance decision.

## Scope and requirement

- Requirement revision or prompt used: `[text]`
- Intended output context and sink: `[file/function/line and context]`
- State-changing method and route: `[method/path]`
- Allowed normal state transition: `[before -> after]`
- Browser/session assumption: `[text]`

## Source / Validation / Sink trace

| Value | Source location | Validation/control | Sink location | Remaining limit |
|---|---|---|---|---|
| comment text | `[path:line]` | `[HTML text encoding]` | `[path:line]` | `[context limit]` |
| session cookie | `[path:line]` | `[server session lookup]` | `[path:line]` | `[fixture limit]` |
| Origin/token | `[path:line]` | `[same-session token + Origin]` | `[path:line]` | `[browser limit]` |
| exception | `[path:line]` | `[redaction/correlation]` | `[response/log]` | `[telemetry limit]` |

## Evidence

- Vulnerable implementation location: `[path/function]`
- Secure implementation location: `[path/function]`
- Normal request status/body and state before/after: `[output]`
- XSS-context attack status/body comparison: `[output]`
- Cross-site request status/body and state before/after: `[output]`
- Missing-token status and state delta: `[output]`
- Wrong-token status and state delta: `[output]`
- Other-session-token status and state delta: `[output]`
- No-session / wrong-method / invalid-input statuses: `[output]`
- Safe failure response and correlation ID: `[output]`
- Redacted log evidence: `[output without secrets]`
- Commands and test results: `[commands/output]`

## Human decision

- [ ] Accept the secure result for this bounded fixture.
- [ ] Reject it and record the blocking finding below.

Decision rationale with code locations and observed results: `[text]`

Residual risks and unverified browser/platform assumptions: `[text]`
