# M05 real-browser verification harness

This harness is isolated under `verification/m05-browser/`. It runs the M05
Python services in a temporary in-memory fixture and drives an installed real
Chrome process through Playwright. It does not modify the product dependency
lockfile or the repository-wide README.

## Setup

From the repository root:

```powershell
npm install --prefix verification/m05-browser --ignore-scripts
```

The runner uses `C:\Program Files\Google\Chrome\Application\chrome.exe` by
default. Set `$env:M05_BROWSER_EXECUTABLE` to another installed browser when
needed. The in-app browser backend and `agent-browser` CLI are not required by
this standalone harness.

## HTTP browser run

```powershell
npm run --prefix verification/m05-browser verify
```

The default is `M05_BROWSER_MODE=http`. The service binds to loopback TCP 80
and the static attacker pages bind to TCP 8080. The browser reaches the
service as `http://app.local` and the fixture configures the secure service
with that explicit trusted origin. The attacker page uses
`http://app.local:8080`, `http://vuln.test:8080`, or
`http://attacker.test:8080` as appropriate. The service never copies the
request's Origin into its trust configuration, and no wildcard or reflected
Origin check is used.

This run is real browser coverage for the HTTP-compatible scenarios. It ends
with `BROWSER_VERIFICATION_PARTIAL`, because it does not prove Secure-cookie
or HTTPS cross-site behavior.

The controlled cleanup checks use only child fixtures and an ephemeral
loopback listener:

```powershell
npm run --prefix verification/m05-browser test:cleanup
```

They do not search for or terminate unrelated processes. The evidence records
whether the owned server exited gracefully or required a bounded fallback; a
forced child stop does not claim cleanup of unrelated processes or arbitrary
descendants.

## HTTPS browser run

HTTPS does not invoke `certutil`, change a trust store, or disable browser
certificate validation. It requires a certificate/key pair whose issuer is
already trusted by the selected browser and whose certificate covers the
fixture hosts:

```powershell
$env:M05_BROWSER_MODE = "https"
$env:M05_BROWSER_CERT_PATH = "C:\path\to\already-trusted-cert.pem"
$env:M05_BROWSER_KEY_PATH = "C:\path\to\private-key.pem"
npm run --prefix verification/m05-browser verify
```

Without those caller-supplied paths, HTTPS is `NOT_RUN`; do not replace it
with `ignoreHTTPSErrors`, `--ignore-certificate-errors`, a web-security
override, or forged Cookie/Origin headers. A complete HTTPS run is the only
run that may report
`SECURIUM_PYTHON_8H_M05_BROWSER_VERIFICATION_PASS`.

## Evidence

The runner writes sanitized JSON and screenshots under
`verification/m05-browser/evidence/`. It records request method, actual
Origin, content type, Cookie presence, preflight/POST reachability, response
status, safe error fields, and final in-memory state. It does not record raw
Cookie, CSRF token, fixture secret, query secret, or traceback values.
