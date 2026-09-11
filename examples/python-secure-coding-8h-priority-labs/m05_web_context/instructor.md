# M05 Instructor Guide

## Suggested sequence

1. State the requirement: a browser with an ambient session cookie may change
   only its own theme, and a comment is rendered in an HTML text context.
2. Run the focused tests and open `vulnerable.py`. Ask learners to identify
   the HTML sink and the state-changing POST sink before discussing fixes.
3. Reproduce the local cross-site request with Alice's cookie and an attacker
   Origin. Point out that the vulnerable service changes real in-memory state.
4. Compare `secure.py`: HTML text encoding, exact Origin policy, constant-time
   session-token comparison, allowlisted theme input, and separate failures.
5. Re-run the tests and inspect state before/after each denied request. Show the
   safe internal error response beside the redacted correlated log entry.
6. Collect the verification record. The acceptance decision must cite file
   locations, status/body evidence, state evidence, and residual limits.

## Expected observations

- The vulnerable comment response contains the attacker-controlled script
  markup; the secure response contains HTML-escaped text for that exact sink.
- A vulnerable POST with `session_id=alice` and an attacker Origin succeeds
  without a CSRF token. The secure POST returns 403 and Alice remains `light`.
- Missing, random, and Bob's token are all rejected for Alice. A valid Alice
  token with the trusted Origin changes only Alice's theme.
- No-session, wrong-method, and invalid-theme requests return 401, 405, and
  400 respectively. None changes the stored theme.
- The vulnerable 500 response/log includes a fixture secret and traceback. The
  secure response contains only `internal_error` and a correlation ID; its log
  contains the ID, path, and exception type, not query data or traceback.

## Common wrong answers

- "A POST cannot be CSRF-ed." CSRF depends on ambient credentials and who can
  cause the browser to send the state-changing request, not only on the verb.
- "The presence of any CSRF token is enough." The token must be verified
  against the existing server-side session; Bob's token is not Alice's token.
- "HTML escaping is input validation for every sink." Encoding is selected for
  the actual context. URL, header, JSON, JavaScript, and raw HTML sinks have
  different rules.
- "SameSite makes server validation unnecessary." Browser cookie behavior is a
  separate control and is not established by this Python client fixture.
- "Return the exception so the client can debug." Client errors should be
  stable and safe; operators need controlled, redacted, correlated telemetry.
- "Reject every request to pass the security test." Valid authenticated theme
  changes must still work, and only rejected requests must have zero mutation.
- "A prompt or a green test run proves safety." The human must inspect the
  exact source, validation, sink, outputs, state transition, and limitations.

## Check questions

- Which value is the CSRF Source, where is its session-bound Validation, and
  which state-changing Sink would be reached without it?
- What evidence distinguishes a 401 from a 403 in this fixture?
- Why is the autoescaped comment safe only for the HTML text sink shown here?
- What does the local client test prove, and what browser behavior remains
  unverified?
- Where is the correlation ID generated, and which sensitive values are absent
  from both the client response and operator log?
