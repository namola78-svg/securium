# Python 8H Offline Learner Troubleshooting

This repository-only guide explains actual messages from the Python 8H learner
preflight and offline-package verifier. It does not change the lab,
preflight, package builder, manifest, allowlist, workflow, or ZIP contents.

Reuse the existing guidance:

- [Learner preflight README](../../verification/python-8h-learner-preflight/README.md)
  defines the probes and status boundaries.
- [Offline package README](../../verification/python-8h-offline/README.md)
  defines the maintainer build/verify commands.
- [Package README source](../../verification/python-8h-offline/package-readme.md)
  is the README rendered inside the ZIP.
- [Lab README](../../examples/python-secure-coding-8h-priority-labs/README.md)
  defines module commands and delivery limits.

This file is not in the ZIP. A ZIP-only learner should use the included
README.md, not be told to open this repository file after extraction.

## First classify the result

From the repository root:

~~~powershell
python verification/python-8h-learner-preflight/preflight.py
~~~

From the extracted package root, where preflight/ and lab/ are siblings:

~~~text
python preflight/preflight.py
~~~

The preflight/preflight.py examples below assume that package root. From a
repository root, use verification/python-8h-learner-preflight/preflight.py
instead.

On Linux, use python3 when that is the installed Python 3.11-or-newer
command. The learner package needs Python and its standard library only; Git,
Node, Docker, and package-manager downloads are not learner prerequisites.

| Result | Meaning | Boundary |
|---|---|---|
| PASS | Required local probes succeeded. | Not a full lab, browser, rehearsal, or classroom result. |
| FAIL | A required local capability failed; CLI exit status is 1. | Does not by itself prove package or source damage. |
| UNVERIFIED_ENVIRONMENT | Probes ran outside the recorded Windows/Linux Python 3.11/3.14 matrix. | Distinct from a functional probe failure; CLI does not return 1 for this status alone. |
| NOT_CHECKED | Deliberately outside this diagnostic. | Not a negative test result. |

Use --json for probe names, details, and statuses:

~~~text
python preflight/preflight.py --json
~~~

The JSON reports safe exception class names, not a full environment dump.
Redact credentials and personal absolute paths before sharing it.

## Learner-side messages and symptoms

Each item is ordered as: visible message or symptom, meaning, safe check,
minimum resolution, and non-sensitive information to share.

### Python cannot be started

**Visible message or symptom**

PowerShell may say:

~~~text
The term 'python' is not recognized as the name of a cmdlet, function, script file, or operable program.
~~~

Linux commonly says:

~~~text
python: command not found
~~~

These are shell messages; preflight.py has not started.

**Meaning**

The requested command name is unavailable in this shell. This is not evidence
that the ZIP, manifest, or lab source is corrupt.

**Safe check**

Windows PowerShell:

~~~powershell
python --version
py --version
~~~

Linux shell:

~~~bash
python3 --version
command -v python
command -v python3
~~~

**Minimum resolution**

Use Python 3.11 or newer. On Windows, use py -3.11 if the launcher is
present; on Linux use python3 when that is the installed command. Do not
install Git, Node, Docker, or unrelated Python packages for this issue.

**Share if unresolved**

Share OS, shell, and redacted version/command output. Omit a full PATH when
it contains personal directories.

### The Python file cannot be found after extraction

**Visible message or symptom**

Python reports that it cannot open the requested file, commonly ending in
[Errno 2] No such file or directory.

**Meaning**

The command is being run from the directory above the package root or from
lab/. The expected layout is:

~~~text
<chosen extraction directory>/python-secure-coding-8h-offline/
  README.md
  preflight/preflight.py
  lab/
~~~

**Safe check**

Windows PowerShell:

~~~powershell
$packageRoot = 'C:/path/to/python-secure-coding-8h-offline'
Test-Path -LiteralPath (Join-Path $packageRoot 'preflight/preflight.py')
Set-Location -LiteralPath $packageRoot
python preflight/preflight.py
~~~

Linux shell:

~~~bash
package_root='/path/to/python-secure-coding-8h-offline'
test -f "$package_root/preflight/preflight.py"
cd -- "$package_root"
python3 preflight/preflight.py
~~~

Quotes preserve spaces and non-ASCII characters.

**Minimum resolution**

Use the directory that directly contains preflight/ and lab/, or extract again
into a new directory. Do not rearrange package files or delete an unknown
directory.

**Share if unresolved**

Share the checked relative path, redacted command, and shell. Replace a
personal parent path with <package-root>.

### Python is below the lab minimum

**Visible message or symptom**

~~~text
Overall: FAIL
- python_version: FAIL - Python 3.11 or newer is required by the lab project.
~~~

The CLI exits with status 1; JSON reports python_version as FAIL.

**Meaning**

The running interpreter is older than the implemented minimum of Python 3.11.

**Safe check**

~~~text
python --version
~~~

Use python3 --version when that is the Linux command name.

**Minimum resolution**

Run the preflight and labs with Python 3.11 or newer. If several interpreters
are installed, invoke the supported one explicitly. Do not change the lab or
manifest to accept an older interpreter.

**Share if unresolved**

Share version, OS, shell, and command form, without credentials or a full
environment dump.

### The environment is outside the recorded matrix

**Visible message or symptom**

~~~text
- recorded_matrix_scope: UNVERIFIED_ENVIRONMENT - Local probes can run, but this OS/Python pair is outside the recorded Windows/Linux 3.11/3.14 matrix.
Overall: UNVERIFIED_ENVIRONMENT
~~~

**Meaning**

Local probes ran, but the OS/Python pair is not one of the recorded
Windows/Linux Python 3.11 or 3.14 entries. Another OS or Python 3.12/3.13 can
be locally usable while remaining unverified.

**Safe check**

~~~text
python --version
python -c "import platform, sys; print(platform.system()); print(sys.version.split()[0])"
~~~

**Minimum resolution**

For local learning, keep the status as UNVERIFIED_ENVIRONMENT and stay within
the stated limits if required probes otherwise pass. For recorded matrix
evidence, use Windows or Linux with Python 3.11 or 3.14. Do not relabel this
status as PASS or as a functional failure.

**Share if unresolved**

Share only OS name, Python version, and overall/probe status.

### A standard-library import failed

**Visible message or symptom**

~~~text
- lab_stdlib_imports: FAIL - One or more standard-library imports used by M01-M08 failed.
~~~

--json adds details.failures with the module name and safe exception type.

**Meaning**

The diagnostic could not import a standard-library module used by M01-M08.
This is not a missing third-party package requirement.

**Safe check**

~~~text
python preflight/preflight.py --json
~~~

Inspect only lab_stdlib_imports.details.failures and interpreter details.

**Minimum resolution**

Retry with an intact, supported Python 3.11-or-newer installation. Repair or
reinstall that Python installation through the normal approved process if the
same module fails. Do not use pip to replace standard-library modules or edit
the preflight to skip the import.

**Share if unresolved**

Share module name, exception type, Python version, OS, and status. Omit paths,
credentials, and environment values.

### The SQLite probe failed

**Visible message or symptom**

~~~text
- sqlite_memory: FAIL - The in-memory SQLite probe failed (ExceptionType).
- sqlite_memory: FAIL - The in-memory SQLite round trip returned an unexpected value.
~~~

**Meaning**

The local in-memory SQLite create/insert/select probe did not complete. It
does not use a repository database, persistent file, or network service.

**Safe check**

~~~text
python -c "import sqlite3; print(sqlite3.sqlite_version)"
~~~

**Minimum resolution**

Use or repair a Python installation with normal sqlite3 standard-library
support, then retry. Do not add a database service or change a repository
schema.

**Share if unresolved**

Share the exception or unexpected-value message, Python version, OS, and the
sqlite3 check result. Do not share database files.

### Temporary file creation, storage, or cleanup failed

**Visible message or symptom**

~~~text
- temporary_file_io: FAIL - Temporary file creation or storage failed (ExceptionType).
- temporary_file_io: FAIL - The owned temporary directory could not be cleaned up (ExceptionType).
- temporary_file_io: FAIL - The owned temporary directory still exists after cleanup.
~~~

The probe owns its temporary directory, writes and reads a filename with a
space and non-ASCII characters, and removes the directory.

**Meaning**

The local temp area or a file lock prevented the operation or cleanup. This
does not by itself identify package damage or a code defect.

**Safe check**

Windows PowerShell (only this unique directory is created and removed):

~~~powershell
$probe = Join-Path ([IO.Path]::GetTempPath()) ('securium-python-8h-check-' + [guid]::NewGuid())
New-Item -ItemType Directory -LiteralPath $probe | Out-Null
$file = Join-Path $probe 'space and non-ascii.txt'
Set-Content -LiteralPath $file -Value 'check' -Encoding utf8
Get-Content -LiteralPath $file
Remove-Item -LiteralPath $probe -Recurse
~~~

Linux shell:

~~~bash
probe="$(mktemp -d /tmp/securium-python-8h-check-XXXXXX)"
printf '%s\n' check > "$probe/space and non-ascii.txt"
cat -- "$probe/space and non-ascii.txt"
rm "$probe/space and non-ascii.txt"
rmdir -- "$probe"
~~~

**Minimum resolution**

Close a program that may hold the exact test file and retry. Confirm the
normal user can write to the temp area. Do not disable antivirus/firewall or
use administrator rights by default. Remove only a directory created and
verified for this check; never issue a broad recursive delete.

**Share if unresolved**

Share status, exception type, creation-versus-cleanup, OS, Python version, and
whether the self-owned check reproduced it. Redact the temp parent path.

### The self-owned subprocess timed out or returned an unexpected result

**Visible message or symptom**

~~~text
- owned_subprocess: FAIL - The self-owned Python subprocess exceeded the 5s timeout.
- owned_subprocess: FAIL - The self-owned Python subprocess could not start (ExceptionType).
- owned_subprocess: FAIL - The self-owned Python subprocess returned a non-zero exit code.
- owned_subprocess: FAIL - The self-owned Python subprocess returned an unexpected marker.
~~~

**Meaning**

The bounded child-process check could not start, finish, or return its expected
marker. It is not a lab-test timeout or an internet check.

**Safe check**

~~~text
python -c "import subprocess, sys; r=subprocess.run([sys.executable, '-c', 'print(42)'], capture_output=True, text=True, timeout=5); print(r.returncode, r.stdout.strip())"
python preflight/preflight.py --json
~~~

**Minimum resolution**

Close resource-heavy local programs and retry. If endpoint control blocks or
delays child processes, use the organization's support route. Do not disable
security software or change the preflight timeout.

**Share if unresolved**

Share the probe message, return code if present, Python version, OS, shell,
and the small child-check result. Do not share secret-bearing process args.

### The loopback listener could not bind or close

**Visible message or symptom**

~~~text
- loopback_ephemeral_bind: FAIL - The 127.0.0.1 ephemeral bind failed (ExceptionType).
- loopback_ephemeral_bind: FAIL - The OS did not return a usable ephemeral loopback port.
- loopback_ephemeral_bind: FAIL - The owned loopback listener could not be closed (ExceptionType).
~~~

**Meaning**

The local process could not bind or close an OS-assigned TCP listener on
127.0.0.1. No external host is contacted.

**Safe check**

~~~text
python -c "import socket; s=socket.socket(); s.bind(('127.0.0.1', 0)); print(s.getsockname()); s.close()"
~~~

**Minimum resolution**

Retry after closing a local program that may hold local resources. If it is
repeatable, report it to the device/network administrator. Do not disable the
firewall globally, open an arbitrary inbound port, or use administrator rights
as the default fix.

**Share if unresolved**

Share exception type, address, Python version, OS, and whether the check
reproduced it. The ephemeral port is not a persistent service identifier.

### The requested report was rejected

**Visible message or symptom**

The CLI exits with status 2 and prints one of these to stderr:

~~~text
ERROR: the requested report already exists; choose a new output path
ERROR: the report parent directory does not exist; create it and retry
ERROR: the report parent is not a directory
ERROR: the report could not be written (ExceptionType); no existing file was replaced
~~~

**Meaning**

--report is create-only. The target must not exist and its parent must already
be a directory.

**Safe check**

Windows PowerShell:

~~~powershell
$report = 'C:/temp/securium/learner preflight.json'
Test-Path -LiteralPath $report
Test-Path -LiteralPath (Split-Path -Parent $report) -PathType Container
~~~

Linux shell:

~~~bash
report='/tmp/securium/learner preflight.json'
test -e "$report"; echo "existing=$?"
test -d "$(dirname -- "$report")"; echo "parent_directory=$?"
~~~

**Minimum resolution**

Choose a new report filename in an existing user-owned directory, or create
the intended parent normally. Quote spaces and non-ASCII characters. Do not
delete or overwrite the existing report to rerun the probe.

**Share if unresolved**

Share exit status, safe message, and whether the parent exists. Replace a
personal target with <report-path>.

## Administrator: build and verify messages

These are maintainer/instructor diagnostics, not learner steps. Use the
[offline builder README](../../verification/python-8h-offline/README.md) for
the command shape. Generated ZIPs, manifests, extraction directories, and
reports belong outside the worktree. A caught build/verify error is printed as
ERROR and the builder CLI exits with status 1.

### Build output path or overwrite refusal

**Visible message or symptom**

~~~text
ERROR: output directory must be outside the repository/worktree: <path>
ERROR: refusing to overwrite existing output: <path>
~~~

**Meaning**

Generated artifacts must be outside the repository, and the builder is
create-only.

**Safe check**

Windows PowerShell:

~~~powershell
$outputDir = 'C:/temp/securium-python-8h-offline-artifacts'
Resolve-Path -LiteralPath $outputDir -ErrorAction SilentlyContinue
Test-Path -LiteralPath $outputDir
~~~

Linux shell:

~~~bash
output_dir='/tmp/securium-python-8h-offline-artifacts'
printf '%s\n' "$output_dir"
test -e "$output_dir"
~~~

**Minimum resolution**

Use a new empty output directory outside the worktree or a new artifact name.
Preserve existing artifacts; do not delete them to force overwrite.

**Share if unresolved**

Share error category, outside/inside-worktree classification, and whether the
target existed. Redact personal parent paths.

### Source allowlist or dirty-source refusal

**Visible message or symptom**

~~~text
ERROR: source allowlist mismatch: missing=[...]; unexpected=[...]
ERROR: lab source has uncommitted changes; build from a committed source tree
ERROR: learner preflight source has uncommitted changes
ERROR: package README source has uncommitted changes
~~~

**Meaning**

The builder checks an exact 61-file lab allowlist, a separately bound
preflight support file, and the package README source. It will not silently
package a new file or dirty bytes.

**Safe check**

~~~text
git status --short -- examples/python-secure-coding-8h-priority-labs verification/python-8h-learner-preflight verification/python-8h-offline/package-readme.md
git diff --check -- examples/python-secure-coding-8h-priority-labs verification/python-8h-learner-preflight verification/python-8h-offline/package-readme.md
~~~

**Minimum resolution**

Build from the intended committed source tree. Preserve unrelated changes in
their own worktree. If a new file should be distributed, open a separate
allowlist/provenance review; do not add it ad hoc or skip the check.

**Share if unresolved**

Share exact error category, reported relative files, commit ID, and status
categories. Do not share a full private diff.

### Source-byte or line-ending verification failure

**Visible message or symptom**

~~~text
ERROR: working-tree bytes differ from the recorded Git blob; line-ending or checkout conversion detected: <relative-file>
ERROR: learner preflight bytes differ from the recorded Git blob; line-ending or checkout conversion detected
ERROR: package README bytes differ from the recorded Git blob; line-ending or checkout conversion detected
~~~

**Meaning**

The checked bytes differ from the committed bytes selected for provenance.
A SHA-256 match is an integrity comparison for reviewed bytes, not a
signature, publisher-authenticity proof, or use-rights approval.

**Safe check**

~~~text
git status --short -- examples/python-secure-coding-8h-priority-labs verification/python-8h-learner-preflight verification/python-8h-offline/package-readme.md
git diff --check -- examples/python-secure-coding-8h-priority-labs verification/python-8h-learner-preflight verification/python-8h-offline/package-readme.md
~~~

**Minimum resolution**

Use a new clean worktree at the intended commit while preserving the original
worktree. Do not edit a manifest/hash, convert bytes by hand, or disable
source verification.

**Share if unresolved**

Share relative file category, commit ID, checkout/OS family, and whether a
clean worktree reproduced it. Do not share absolute paths.

### Archive, manifest, or package-link verification failure

**Visible message or symptom**

~~~text
ERROR: archive size or SHA-256 does not match the manifest
ERROR: manifest source commit does not match the committed lab source: <commit> != <commit>
ERROR: manifest file records do not match the current lab source bytes
ERROR: manifest support-file records do not match current source bytes
ERROR: archive member list differs from manifest
ERROR: archive member hash mismatch: <archive-member>
ERROR: archive package README bytes do not match the committed README Git blob after marker substitution
ERROR: unresolved package-relative Markdown links: [...]
~~~

**Meaning**

The archive, adjacent manifest, committed source, or package-relative links do
not describe the same reviewed package. The verifier is supposed to reject
this before calling the extracted package verified.

**Safe check**

Windows PowerShell:

~~~powershell
Get-FileHash -LiteralPath 'C:/temp/securium/package.zip' -Algorithm SHA256
Get-Content -LiteralPath 'C:/temp/securium/package.manifest.json' -Raw | ConvertFrom-Json | Select-Object source_commit,archive_file_count
~~~

Linux shell:

~~~bash
sha256sum '/tmp/securium/package.zip'
python3 -c "import json; print(json.load(open('/tmp/securium/package.manifest.json', encoding='utf-8'))['source_commit'])"
~~~

Use the exact archive/manifest pair produced by one build.

**Minimum resolution**

Rebuild the ZIP and adjacent manifest together from intended clean, committed
source, or obtain the matching pair from the package owner. Do not edit the
manifest, regenerate hashes by hand, or remove the link check.

**Share if unresolved**

Share error category, source commit prefix, archive/manifest hash prefixes,
and the relative member or link named. Redact private artifact directories.

### Existing extraction directory or verifier timeout

**Visible message or symptom**

~~~text
ERROR: refusing to use existing extraction directory: <path>
ERROR: extracted learner preflight exceeded its 30 second timeout
~~~

The report can also contain:

~~~text
"error": "timeout after 180 seconds; child process was terminated"
~~~

**Meaning**

Verification requires a new extraction directory and bounded child processes.
The 30-second bound covers the packaged preflight wrapper; 180 seconds covers
each extracted lab command.

**Safe check**

Windows PowerShell:

~~~powershell
$extractDir = 'C:/temp/securium/new-package-extraction'
Test-Path -LiteralPath $extractDir
~~~

Linux shell:

~~~bash
extract_dir='/tmp/securium/new-package-extraction'
test -e "$extract_dir"; echo "existing=$?"
~~~

**Minimum resolution**

Use a new unused extraction path outside the worktree. Preserve existing
extractions/reports; do not recursively delete an unknown path. If a timeout
repeats, inspect the report and environment before calling it a package bug.

**Share if unresolved**

Share timeout category, command label, Python version, OS, and whether a new
extraction reproduced it. Redact absolute paths.

### Packaged preflight failed inside verification

**Visible message or symptom**

~~~text
ERROR: extracted learner preflight returned a failure exit code (1)
ERROR: extracted learner preflight did not produce valid JSON
ERROR: extracted learner preflight did not pass: FAIL
ERROR: extracted learner preflight did not pass: UNVERIFIED_ENVIRONMENT
ERROR: extracted learner preflight has a non-PASS required probe
~~~

**Meaning**

The verifier runs the packaged preflight before extracted lab commands and
requires overall_status: PASS. A learner can locally see
UNVERIFIED_ENVIRONMENT as distinct from a functional failure, while the
package verifier requires the recorded matrix scope.

**Safe check**

From the extracted package root, run only:

~~~text
python preflight/preflight.py --json
~~~

Inspect the first required probe with status FAIL or the matrix status.

**Minimum resolution**

Resolve the underlying learner probe or use the recorded Windows/Linux Python
3.11/3.14 scope for verification. If packaged bytes or support records differ,
rebuild from committed source; do not replace the script, modify its hash, or
skip preflight.

**Share if unresolved**

Share overall_status, failing probe name/status/message, Python version, OS,
and verifier category. Redact private platform details.

### Extracted lab command or test-accounting failure

**Visible message or symptom**

~~~text
ERROR: offline test verification failed: [...]
~~~

The report records each command, expected/actual test count, return code,
skipped count, failure count, error count, and status.

**Meaning**

An extracted focused or aggregate command did not meet the verifier's expected
result. This is separate from the learner preflight and does not establish
browser or classroom readiness.

**Safe check**

Read the explicit report path first. If a focused rerun is necessary, use the
existing command from the extracted lab/ directory, for example:

~~~text
python -m unittest m05_web_context.test_m05 -v
~~~

**Minimum resolution**

Compare command, return code, and test accounting with the lab README. Preserve
the report and source worktree. Do not weaken tests or package checks to obtain
a green result.

**Share if unresolved**

Share module label, command, return code, expected/actual count, and
failure/error category. Redact test data and absolute paths.

## Boundaries to retain

- Preflight PASS covers listed local probes only, not full lab, browser,
  rehearsal, or classroom-delivery readiness.
- UNVERIFIED_ENVIRONMENT remains distinct from a required probe FAIL.
- M05 remains HTTP BROWSER_VERIFICATION_PARTIAL; HTTPS remains NOT_RUN.
- Q36's canonical content answer is B/2 (answer: 1). The default mapping
  still requires QUESTION_REVISION_CONTEXT_REQUIRED; source/approval
  authority is UNKNOWN, candidate preflight is BLOCKED, persistence is
  NOT_READY, and no humanReviewHash or canonical receipt exists.
- Actual learner/instructor rehearsal and classroom delivery readiness remain
  incomplete.
- Source/archive SHA-256 supports integrity comparison for reviewed bytes; it
  is not a signature, source-authenticity decision, or use-rights approval.

## ZIP inclusion and follow-up

The current builder includes the package README, internal source manifest,
separately provenance-bound preflight/preflight.py, and the explicit 61-file
lab/instructor allowlist. It excludes this guide, the repository preflight and
builder READMEs/tests, reports, generated artifacts, extraction directories,
and browser-harness files.

This task intentionally changes no builder, allowlist, manifest, workflow, or
package-internal README. If this guide should enter a future ZIP, record that
as a separate follow-up requiring allowlist, manifest, provenance, package
README-link, and workflow review.
