# Python 8H learner environment preflight

This is a read-only environment diagnostic for the local Python labs in
`examples/python-secure-coding-8h-priority-labs/`. It uses only Python's
standard library and performs bounded probes. It does not install Python or
packages, change `PATH` or other environment variables, contact the internet,
inspect the user's home directory, or modify firewall, hosts, trust-store, or
browser-profile settings.

## Run

From the repository root:

```powershell
python verification/python-8h-learner-preflight/preflight.py
```

For machine-readable output:

```powershell
python verification/python-8h-learner-preflight/preflight.py --json
```

To save a diagnostic for an instructor, provide a new output path. The tool
refuses to overwrite an existing file and does not include the user name,
personal absolute paths, credentials, or a full environment-variable dump:

```powershell
python verification/python-8h-learner-preflight/preflight.py `
  --report 'C:\temp\securium\learner preflight.json'
```

The output is a diagnostic, not a learner success record. A report with
`PASS` means the local probes succeeded. It does not certify the full lab
suite or classroom delivery.

## What is checked

- Python meets the lab's `requires-python >= 3.11` requirement.
- The standard-library modules actually used by M01-M08 import successfully.
- An in-memory SQLite create/insert/select round trip works.
- An owned temporary directory can read and write a filename containing spaces
  and non-ASCII characters, and the directory is removed afterward.
- A child process owned by this diagnostic can run and finishes within a
  bounded timeout.
- `127.0.0.1` accepts an OS-assigned ephemeral listener, which this process
  closes.

The loopback probe is not evidence that every lab server, host firewall, or
real browser flow will work. No external network request is made.

## Status meanings and actions

- `PASS`: this specific local probe succeeded.
- `FAIL`: a required local capability failed. Read the message, install or
  repair the prerequisite yourself, then run the diagnostic again. The tool
  never installs or changes it for you.
- `UNVERIFIED_ENVIRONMENT`: the probes ran, but the OS/Python pair is outside
  the recorded Windows/Linux × Python 3.11/3.14 matrix. This is not an
  automatic compatibility failure; full lab compatibility remains unverified.
- `NOT_CHECKED`: deliberately outside this diagnostic, such as the 50-test
  suite, browser harness, or human rehearsal.

The recorded matrix is evidence for Windows/Linux with Python 3.11 and 3.14.
For example, a macOS or Python 3.13 probe may be locally `PASS` while its
matrix scope is `UNVERIFIED_ENVIRONMENT`.

## What to run separately

For learner-facing explanations of actual preflight messages, exit statuses,
path quoting, and safe next steps, see the repository-only
[Python 8H offline learner troubleshooting guide](../../docs/content/python-8h-offline-troubleshooting.md).
The guide is not included in the learner ZIP; the package's own README.md
remains the package entry point.

This tool does not run the 50 lab tests. From the lab directory, use the
focused command in the relevant learner handout or run:

```powershell
python -m unittest discover -s . -p "test_*.py" -v
```

The M05 browser harness is a separate Node/Playwright environment. Its
recorded boundary remains HTTP `BROWSER_VERIFICATION_PARTIAL` and HTTPS
`NOT_RUN`; this Python preflight does not change that status. It also does not
perform instructor/learner rehearsal, classroom delivery readiness, Q36
Runtime authority, canonical registration, or publication.

## Packaging boundary

The offline package includes only `preflight/preflight.py`, copied from this
directory as one separately provenance-bound support entry. The package keeps
the existing 61-file lab/instructor allowlist; this support entry is recorded
separately in the manifest and is not counted as a lab file. The packaged
command is run from the extracted package root:

```text
python preflight/preflight.py
```

`test_preflight.py` remains a repository verification file and is not included
in the learner ZIP. The package does not include this directory's README or
the generated probe report. Its preflight result is separate from the M05 7
focused tests, aggregate 50 lab tests, browser verification, and classroom
rehearsal.
