# SECURIUM Python 8h M05 browser verification report

## 1. Final Status

`BROWSER_VERIFICATION_PARTIAL`

The HTTP-compatible scenarios completed in an actual local Chrome process.
The HTTPS Secure-cookie and HTTPS cross-site scenarios remain `NOT_RUN`:
the earlier certificate preparation blocked at `certutil.exe -user -f
-addstore Root` with `spawnSync certutil.exe ETIMEDOUT`, and this recovery did
not change a system or current-user trust store. A full browser PASS is not
claimed from the HTTP run.

The fixture integration gap was repaired in the source commit `18b6aa1`
(`fix(m05): allow explicit trusted origin for browser fixture`) and carried
onto this latest-main branch as `37e3de2`.
The default product behavior remains the exact `https://app.local` trusted
Origin required by the existing secure tests. The repair adds only an
explicit service configuration parameter so the isolated HTTP browser
fixture can use its actual server-owned `http://app.local` Origin.

This follow-up also bounds cleanup to the harness processes and runtime
directory owned by the current run, and repairs current M05/instructor test
count wording. The historical 6/49 results remain provenance rather than the
current expectation.

## 2. Worktree, branch, and source scope

- Worktree:
  `C:\Users\user\Documents\Codex\2026-07-24\securium-python-8h-m05-browser-publish`
- Branch: `fix/python-8h-m05-browser-fixture`
- Existing harness checkpoint: `1500f48`
- Source M05 fixture repair commit: `18b6aa1`
- Latest-main M05 repair commit: `37e3de2`
- Latest-main harness commit: `69ec964` plus isolated dependency commits
  `b0ec63f` and `a730ee5`
- Latest `origin/main` at publication: `c3c1220c4e2e7bdce8e8d99e057536c3c0f1a9bc`
- Fresh `origin/main` checked for this cleanup follow-up:
  `455bafc9323b67c1e3eda031603b22d78ae49049`
- PR #143 merge / publish base: `8e7baf8a3e156f7dc3666313fb7c88d7e6e7d8df`
- Cleanup and documentation repair commit: `1381ac9` (local candidate before
  publication)

The M05 source blobs from merged #143 are recorded in `source-metadata.md`.
This candidate retains the explicit `trusted_origin` fixture configuration,
focused regression test, and isolated browser harness, and adds only bounded
harness cleanup regression coverage plus current M05/instructor test-count
wording. No Q36/Foundation content, runtime/schema, Python CI workflow, or
root dependency/lockfile was changed. The existing parallel Q36 and
instructor-kit changes were not merged wholesale.

## 3. Browser, version, OS, and execution method

- Browser: installed Google Chrome, version `152.0.7977.84`
- Executable:
  `C:\Program Files\Google\Chrome\Application\chrome.exe`
- OS: Windows 11 Pro 64-bit, build `26200` (`10.0.26200`)
- Playwright: `1.63.0`, installed only under this harness directory
- Browser mode: HTTP, service `127.0.0.1:80`, attacker/static server
  `127.0.0.1:8080`
- Browser context: `ignoreHTTPSErrors: false`; no web-security override
- Host mapping: only `app.local`, `vuln.test`, and `attacker.test` mapped to
  loopback by Chrome's host resolver rules

The in-app browser backend list was empty and the `agent-browser` CLI was not
installed. The standalone harness therefore used the available installed
Chrome through Playwright. Chrome launch/version detection was independent of
certificate preparation.

Run used:

```powershell
npm install --prefix verification/m05-browser --ignore-scripts
npm run --prefix verification/m05-browser test:cleanup
npm run --prefix verification/m05-browser verify
```

The cleanup command uses only controlled child fixtures and an ephemeral
loopback listener; it does not search for or terminate unrelated processes.

## 4. Failure recovery and fixture shape

The prior run reached the Python TLS server's `READY` line on port 443 and
then timed out while importing its temporary certificate with `certutil`;
Chrome was never launched. Read-only checks for the prior temporary
thumbprints `FAB2EBEAEECB679514BFC59B79675A9C06A9625C` and
`B61FC65DF9E27F59F26E7C11C0F0E8DCDA51FEDB` found neither in the queried
current-user store. No certificate deletion or trust-store cleanup was
performed by this recovery.

The recovered HTTP fixture uses:

- service: `http://app.local` on port 80;
- same-site but cross-origin attacker pages: `http://app.local:8080` and
  `http://vuln.test:8080`;
- cross-site attacker page: `http://attacker.test:8080`;
- browser-set temporary cookie: `SameSite=Lax`, with `Secure` omitted because
  this is HTTP;
- secure service trusted origin: explicit `http://app.local`, configured by
  the fixture rather than derived from each request.

The service still validates each request's actual Origin against its
server-owned configured value. Different ports are different Origins but,
for these hostnames and scheme, are same-site. `attacker.test` is treated as
cross-site. Chrome did not provide `Sec-Fetch-Site` in the observed local
events, so site classification is based on actual URL scheme/host/port and
the observed browser Cookie behavior, not on a guessed header.

## 5. Scenario results

| Scenario | Result | Browser/server evidence |
|---|---|---|
| Normal page, session setup, valid token | PASS | Same-origin `POST` to `http://app.local/settings/theme`; actual Origin `http://app.local`; Cookie present; JSON body and CSRF header; server `200`; Alice changed `light -> dark`. |
| Same-site different-port form | PASS | Source `http://app.local:8080`, target `http://app.local`; form `POST` reached server with actual Origin and Cookie; `application/x-www-form-urlencoded`; secure server `403 csrf_failed`; state unchanged. |
| Same-site different-port simple `no-cors` POST | PASS | `POST` reached server with Cookie and `text/plain;charset=UTF-8`; server `403 csrf_failed`; browser saw opaque response status `0`; state unchanged. This distinguishes an opaque browser response from server rejection. |
| Cross-site form | PASS | Source `http://attacker.test:8080`, target `http://app.local`; form `POST` reached server without Cookie due `SameSite=Lax`; server `401 authentication_required`; state unchanged. |
| Custom-header request | PASS | Browser issued `OPTIONS` preflight with actual attacker Origin; server returned `405 method_not_allowed`; no actual `POST` arrived; browser fetch rejected with `TypeError: Failed to fetch`. This is CORS/preflight behavior, not proof that all CSRF forms are blocked. |
| Missing token | PASS | Same-origin browser request with Cookie but no CSRF token; `403`; state unchanged. |
| Wrong token | PASS | Same-origin browser request with invalid token; `403`; state unchanged. |
| Other-session token | PASS | Same-origin browser request with another session's token; `403`; state unchanged. |
| Wrong method / invalid input | PASS | `GET` returned `405`; invalid theme returned `400`; state unchanged. |
| Unauthenticated request | PASS | No session Cookie; server `401`; state unchanged. |
| Vulnerable cross-origin form | PASS | Same-site/cross-origin form reached vulnerable server with URL-encoded content; fixture JSON endpoint returned `400`, with no mutation. |
| Vulnerable simple `no-cors` POST | PASS | Source `http://vuln.test:8080`, target `http://vuln.test`; Cookie present; `text/plain;charset=UTF-8` simple `POST` reached vulnerable server and returned `200`; Alice changed `light -> dark`; browser response was opaque status `0`. |
| HTML text output | PASS | Vulnerable sink produced a real script node; secure sink produced no script node and displayed the attack string as text after escaping. This claim is limited to the HTML text context implemented by M05. |
| Internal failure response/logs | PASS | Vulnerable fixture response/log flags showed the intentional fake secret/traceback leak; secure response was `500` with `error=internal_error` and a request-id shape, with no secret or traceback flags in response/log state. Evidence stores flags only, not raw values. |
| HTTPS Secure cookie / HTTPS cross-site | NOT_RUN | No already-trusted caller-supplied certificate/key was available. The harness refuses to alter trust stores or disable certificate validation. |

The HTTP scenarios all passed their functional assertions. Because the
required HTTPS coverage is not run, the overall result remains partial.

The same run recorded `browser_closed: true`, `server_stop.terminated: true`,
`runtime_dir_removed: true`, and no cleanup errors. The controlled cleanup
regression suite also passed, including missing-Python, browser-start failure,
port-conflict listener preservation, and bounded fallback for an owned child.

## 6. Origin, site, Cookie, SameSite, and CORS scope

The evidence records actual server-observed method, Origin, content type,
Cookie presence, CSRF-header presence, response status, and final state. It
does not inject Cookie or Origin headers from the test client.

The HTTP run establishes that:

- same-site is not the same as same-origin: port 8080 versus port 80 changed
  Origin and caused CSRF validation, while the browser still sent the Lax
  Cookie;
- the cross-site form did not receive the Lax Cookie and was rejected as
  unauthenticated;
- a simple `no-cors` request can reach the server even though its response is
  opaque to JavaScript;
- the custom-header request was stopped at the preflight (`OPTIONS` 405), so
  no POST was received. That observation is not generalized to form/simple
  CSRF protection;
- HTTPS `Secure` and cross-site `SameSite=None` behavior remains NOT_RUN.

## 7. Output, errors, and logs

The vulnerable browser response rendered raw `<script>` markup into the
vulnerable HTML sink. The secure browser response serialized escaped markup
and displayed the attack string as text. No conclusion is made for other HTML,
JavaScript, or URL contexts.

For the failure endpoint, the sanitized evidence confirms:

- vulnerable response: `500`, secret/traceback flags true;
- secure response: `500`, `error=internal_error`, request-id shape present,
  secret/query-secret/traceback flags false;
- secure in-memory logs: no fixture secret, query secret, or traceback flags.

The evidence file was checked after the run: raw fixture secret and raw
client token/secret values were absent. Only redacted URLs and boolean
presence flags are retained.

## 8. Difference from the existing HTTP client result

The pre-repair focused Python result was `6/6`; this candidate adds one
explicit trusted-origin regression and passes `7/7`. Neither result is
counted as browser verification. The tests directly supply Cookie, Origin, and
CSRF headers, so it cannot establish browser Cookie policy, SameSite behavior,
form encoding, CORS preflight, opaque responses, or whether a browser request
actually reached the server. The HTTP browser run added those observations;
the HTTPS portion is still outstanding.

The candidate-wide Python labs regression ran `50` tests and completed `OK`.

## 9. Defect and minimum repair

The initial browser fixture had a real execution defect: the product secure
service required `https://app.local`, while the available HTTP server exposed
an ephemeral loopback address. A browser request cannot honestly satisfy that
contract by putting a forged Origin/Host header on the client request.

The minimum applied repair is the keyword-only `trusted_origin` parameter in
`m05_web_context/secure.py`, defaulting to the original exact
`https://app.local`. The isolated HTTP fixture passes `http://app.local` and
serves the browser on port 80; request Origin validation remains exact. No
wildcard, reflected Origin, disabled validation, or product-wide dependency
change was introduced.

The remaining environment condition is an already-trusted certificate/key
pair for the HTTPS fixture. With it, set `M05_BROWSER_MODE=https`,
`M05_BROWSER_CERT_PATH`, and `M05_BROWSER_KEY_PATH`; the harness will run the
HTTPS scenarios without importing or deleting certificates.

The follow-up cleanup repair is in `1381ac9`: the run-owned runtime directory
is removed on normal and failure paths, child-process errors become explicit
failure results, server stop has bounded graceful and forced phases, and
cleanup errors are retained without replacing the original failure. Forced
termination is limited to the directly owned child; the harness does not claim
to clean arbitrary descendants.

## 10. Report, harness, and screenshot locations

- Harness: `verification/m05-browser/`
- Run instructions: `verification/m05-browser/README.md`
- Source lock: `verification/m05-browser/source-metadata.md`
- Sanitized evidence: `verification/m05-browser/evidence/browser-verification-result.json`
- Screenshots: `verification/m05-browser/evidence/attacker-page.png`,
  `secure-xss.png`, and `vulnerable-xss.png`
- Cleanup regression: `verification/m05-browser/cleanup-regression.mjs`
- Owned-child stop helper: `verification/m05-browser/lifecycle.mjs`

## 11. Exact README text for the published harness path

```markdown
### M05 real-browser verification

The focused Python tests cover the service contract with direct HTTP requests;
they do not establish browser Cookie, SameSite, Origin, form-submission,
CORS/preflight, or opaque-response behavior. The separate reviewer harness is
under `verification/m05-browser/`. Install it with
`npm install --prefix verification/m05-browser --ignore-scripts`, then run
`npm run --prefix verification/m05-browser verify` for the HTTP-compatible
browser scenarios. A complete browser claim requires an HTTPS run with an
already-trusted certificate/key pair, `ignoreHTTPSErrors` disabled, browser-set
fake cookies, and no forged Cookie/Origin headers. Report
`SECURIUM_PYTHON_8H_M05_BROWSER_VERIFICATION_PASS` only after all HTTPS and
HTTP scenarios pass; otherwise report `BROWSER_VERIFICATION_PARTIAL` or
`BROWSER_VERIFICATION_NOT_RUN` with the missing environment condition.
```

The common README guidance is present in the candidate under review; the
instructor-kit documents additionally distinguish the current 7/50 expected
counts from the historical 6/49 provenance. Neither change removes the Q36
caveat or the HTTPS `NOT_RUN` limitation.

## 12. Remaining classroom-delivery work

- Provide a browser-trusted certificate/key pair and run the HTTPS mode to
  cover `Secure` and real HTTPS cross-site `SameSite` behavior.
- Keep the classroom claim bounded to the observed HTML text context for
  `html.escape`; do not extend it to JavaScript, URL, or other sinks.
- The classroom delivery claim remains incomplete until HTTPS Secure-cookie
  and cross-site `SameSite=None; Secure` behavior is run with a trusted
  certificate/key pair and the actual rehearsal requirements are completed.

## 13. Runtime DB I/O and remote mutation

- Runtime DB I/O: none. The fixture used temporary in-memory demo state only.
- Remote mutation for this follow-up is limited to the authorized normal push
  of the existing Draft PR branch and its PR-body update. No merge,
  auto-merge, deployment, publication, or external-service write is part of
  the work.
- Local temporary resources: isolated Playwright installation, short-lived
  Python/browser fixture processes, temporary runtime data, and screenshot /
  sanitized evidence files. The HTTPS trust-store operation that timed out in
  the earlier run was not retried.
