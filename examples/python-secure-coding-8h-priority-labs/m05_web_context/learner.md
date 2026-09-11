# M05 Lab: Web Context, CSRF, and Safe Failure

Canonical authority: `P05` / objectives `O17`–`O20` / questions
`Q24`–`Q28`.

## Goal

Review a small Flask-style Python service without requiring Flask. The service
renders a comment, changes a real in-memory session preference, and handles an
intentional internal failure. You will identify the output sink, reproduce a
cross-site state change, repair the code, and prove that rejected requests do
not mutate state.

The HTTP server is a teaching fixture, not a production-ready web framework or
session implementation. It binds only to `127.0.0.1` on an ephemeral port.

## Requirement and fixed AI prompt

The service may render a user comment as HTML text and let an authenticated
browser change its own theme between `light` and `dark`. State-changing browser
requests must use the existing server-side session and a session-bound CSRF
token. The service must distinguish authentication, CSRF, input, method, and
internal failures. Client errors must be stable and safe; operator logs may be
correlated but must not contain tokens, secrets, request query data, or
tracebacks.

> Review and repair the supplied standard-library-only Python service. Name
> the exact output context and sink before choosing encoding. Trace the session
> cookie, Origin, and CSRF token from Source through server-side validation to
> the state-changing Sink. Require a token bound to the existing session and a
> trusted browser Origin for POST /settings/theme. Preserve valid light/dark
> changes, reject missing/wrong/other-session tokens without changing state,
> distinguish 401/403/400/405/500, and return a stable redacted internal error
> with a correlation ID. Add normal, XSS-context, CSRF, method/auth/input, and
> safe-failure tests. Use only loopback and fake sessions; do not call an
> external LLM or network.

The prompt is a review aid, not evidence that generated code is safe. The
provided `vulnerable.py` is a teaching draft, not claimed to be AI-generated.

## Learner activities

1. Run the focused tests once and read both implementations before editing.
2. Map each value to Source / Validation / Sink:
   - `text` query value → HTML text encoding → comment HTML response.
   - `session_id` cookie → server-side session lookup → theme state mutation.
   - `Origin` and `X-CSRF-Token` → trusted-origin and same-session token checks
     → the POST state-change sink.
   - exception → redacted operator record and stable JSON error response.
3. Run the vulnerable tests and explain why the attacker-origin request can
   change Alice's theme when the ambient cookie is present.
4. Inspect `secure.py` and state the distinct meaning of 401 authentication,
   403 CSRF, 400 input, 405 method, and 500 internal failure responses.
5. Run the secure tests. Record the state before and after every rejected
   request; the expected mutation count for rejected theme requests is zero.
6. Complete `verification-record.md` with file locations, response status and
   body evidence, session/token relationship, log evidence, and residual
   assumptions. A checkbox without evidence is not a completed review.

## Run and reset

From this lab bundle directory in Windows PowerShell:

```powershell
python -m unittest m05_web_context.test_m05 -v
python -m unittest discover -s . -p "test_*.py" -v
python -m compileall -q .
```

Expected focused result: `Ran 6 tests ... OK`. After integrating M07 into the
bundle, the aggregate result is `Ran 49 tests ... OK`. Every test creates a fresh fake
state and shuts down its loopback server. No reset command or persistent data
is required.

## Scope limits

The Python client in the tests directly sends a `Cookie` header and request
headers. That verifies server behavior, not a browser's cookie, SameSite,
Origin, or form-submission implementation. The secure fixture's token and
Origin checks are necessary controls for this contract, but this lab does not
claim production framework hardening, TLS, real browser behavior, or a full
session/authentication system.

## Official Python references

- [`html.escape`](https://docs.python.org/3/library/html.html#html.escape)
  documents HTML text/attribute character escaping; it is not a universal
  sanitizer for other output contexts.
- [`hmac.compare_digest`](https://docs.python.org/3/library/hmac.html#hmac.compare_digest)
  documents same-type comparisons designed to reduce content-based timing
  differences. It does not create or bind a CSRF token to a session by itself.
- [`http.server.ThreadingHTTPServer`](https://docs.python.org/3/library/http.server.html#http.server.ThreadingHTTPServer)
  documents the local threaded server used by this fixture. The lab still does
  not claim that `http.server` is production web-server hardening.
