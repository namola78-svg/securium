# Python Secure Coding × Vibe Coding: Priority Local Labs

This bundle implements the executable local-only labs for the existing
foundation practical specifications:

| Module | Existing spec/objectives/questions | Lab directory |
|---|---|---|
| M01 Secure Python and Vibe-Coding Foundations | P01 · O01–O04 · Q01–Q05 | `m01_trust_boundary/` |
| M02 Input Validation and Interpreter Boundaries | P02 · O05–O08 · Q06–Q11 | `m02_injection/` |
| M03 Data Access, Deserialization, and Code Execution | P03 · O09–O12 · Q12–Q17 | `m03_deserialization/` |
| M04 Files, Uploads, and SSRF | P04 · O13–O16 · Q18–Q23 | `m04_files_ssrf/` |
| M05 Web Output, CSRF, Exceptions, and Logging | P05 · O17–O20 · Q24–Q28 | `m05_web_context/` |
| M06 Authentication, Authorization, and BOLA/IDOR | P06 · O21–O24 · Q29–Q32 | `m06_authorization/` |
| M07 Secrets, Dependencies, and Supply-Chain Review | P07 · O25–O28 · Q33–Q36 | `m07_secrets_dependencies/` |
| M08 Vibe-Coding Capstone and Human Re-verification | P08 · O29–O32 · Q37–Q40 | `m08_capstone/` |

The course identity remains `developer-secure-coding-8h-python-vibe`. These
files are teaching fixtures, not application runtime code. They are not
imported by `app/`, `lib/`, `db/`, or `worker/`, and they do not register or
publish course content.

## Verification status and delivery boundary

- Verified locally: Windows PowerShell 5.1 with Python 3.14.5. Python 3.11,
  other operating systems, and a real browser flow remain unverified.
- M05's HTTP checks use a direct Python client against a loopback server. They
  do not prove browser cookie, SameSite, form, or Origin behavior.
- Q36's canonical answer binding remains under separate review. Do not use an
  unconfirmed answer as a grading or teaching authority.
- Canonical practical records P01-P08 remain `SPEC_ONLY`; this bundle does not
  perform runtime registration, provisioning, publication, or deployment.
- The manifest's 480-minute total and 350-minute Python / 130-minute AI split
  are planning values. The automated test duration is not learner or classroom
  rehearsal time.

## Compatibility matrix

The pull-request-only Python CI runs the same local-only bundle on both hosted
Windows and Linux runners:

| Runner | CI shell | Python target | Expected discovery baseline |
|---|---|---|---:|
| Windows | `pwsh` | 3.11 | 49 tests |
| Windows | `pwsh` | 3.14 | 49 tests |
| Linux | `bash` | 3.11 | 49 tests |
| Linux | `bash` | 3.14 | 49 tests |

Each matrix job records the actual Python patch version and platform. It fails
when discovery finds zero tests or when failures, import errors, or skips are
reported; a changed non-zero test count is recorded for review rather than
hard-coded as a failure, so future tests can be added normally. The local
baseline was Windows PowerShell 5.1 / Python 3.14.5; that is distinct from the
GitHub-hosted `pwsh` run. Results for Python 3.12, 3.13, macOS, real browsers,
and learner rehearsal are not inferred from this matrix.

## Safety and reproducibility

- Supported Python: **3.11 or newer**. Only the Python standard library is used.
- No `pip install` or external package is required.
- M03 uses JSON for request data and a harmless temporary-marker pickle payload
  only to demonstrate the unsafe path. It does not add PyYAML or treat pickle
  as a request parser. The trusted-artifact case is isolated, application-owned,
  and digest-checked before loading.
- Tests use temporary directories, in-memory SQLite, fake credentials, and a
  loopback-only HTTP server. No external host, cloud metadata endpoint,
  production database, or real secret is used.
- The M04 and M08 SSRF allow-path test uses an injected resolver and fake
  opener. That verifies destination policy and response limits; it does not
  prove a production network egress control. The vulnerable SSRF test uses a
  local loopback server only.
- Every test cleans its temporary resources and can be run repeatedly.

## Windows PowerShell execution

From this directory:

```powershell
py -3.11 -m venv .venv
& .\.venv\Scripts\python.exe -m unittest discover -s . -p "test_*.py" -v
```

If the launcher is not installed, use an installed `python` executable:

```powershell
python --version
python -m unittest discover -s . -p "test_*.py" -v
```

The expected final result is `Ran 49 tests ... OK` (the exact elapsed time is
environment-dependent). A failed test is a lab failure, not a successful
security result.

No persistent fixture state is created, so no reset command is required. If a
run is interrupted, remove only this lab's `.venv` or Python cache directories
and rerun the commands above.

## Vibe Coding learning loop

Every module contains a learner handout and instructor guide. The fixed prompt
in each handout can be given to any coding assistant, but the lab remains
fully completable without an LLM:

1. Read the requirement and constraints.
2. Ask for a bounded implementation using the supplied prompt.
3. Trace Source → Validation → Sink in the vulnerable and secure files.
4. Run the positive, attack, and regression tests.
5. Ask for a repair, or apply the reference repair manually.
6. Re-run the tests and inspect the diff as a human reviewer.
7. Record residual assumptions and explain why the secure result is bounded.

An AI response, confidence score, or green formatter is never a security
authority.
