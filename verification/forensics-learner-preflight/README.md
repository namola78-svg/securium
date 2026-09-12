# Forensics Learner Preflight

This is a standalone, learner-facing environment preflight for the existing
synthetic digital-forensics integrity and timeline local labs. It uses only the
Python standard library and can run from outside this repository. It does not
require Node, Docker, Git, administrator rights, credentials, or external
services.

## Requirement basis and support boundary

The existing integrity and timeline lab implementations and learner/instructor
guidance were read to extract the common execution requirements:

- Python command-line execution with the standard library only.
- Small synthetic bytes and SHA-256 hashing.
- JSON and CSV records.
- Timezone-aware timestamps with explicit UTC conversion.
- A new temporary workspace, including a filename with spaces and non-ASCII
  characters, followed by byte-for-byte read-back and cleanup.

The existing lab guidance records Python 3.11 as the minimum and a configured
Windows/Linux Python 3.11/3.14 CI matrix. That matrix is configuration read
from the existing project material, not evidence that CI succeeded. This tool
reports exact membership in that recorded scope, but it does not claim support
for other OS/Python/filesystem combinations. It reports those combinations as
`UNVERIFIED_ENVIRONMENT` rather than as supported or failed.

The two labs' broader filesystem boundary, full lab behavior, classroom
rehearsal, and real-evidence limitations are not promoted into this tool's
environment claim. This preflight reads and writes only the synthetic files in
the unique directory it creates for the current run.

## Checks performed

The run performs these checks:

- Python implementation and version against the 3.11 minimum.
- Recorded OS/Python scope classification for CPython on Windows/Linux 3.11
  or 3.14.
- The standard-library import union needed by the two lab implementations and
  their command-line paths: `argparse`, `csv`, `datetime`, `hashlib`, `json`,
  `os`, `pathlib`, `shutil`, `stat`, `tempfile`, and `zoneinfo`.
- SHA-256 of the synthetic bytes `abc`.
- Synthetic JSON serialization/read-back and CSV parsing.
- Conversion of `2026-09-12T09:00:00+09:00` to UTC while retaining timezone
  awareness.
- Creation of a unique owned temporary directory, writing and reading
  `space and 한글.bin`, and checking byte equality.
- Cleanup of only that run-owned directory, with symbolic-link and Windows
  reparse-point refusal in the cleanup walk.

Network, loopback, SQLite, subprocess, browser, package, Git, disk-image,
MFT/USN, OS-evidence, and user-file probes are deliberately absent because the
two labs do not require them for this preflight.

## CLI contract

Run from any current directory:

```text
python C:\path\to\preflight.py
python C:\path\to\preflight.py --json
python C:\path\to\preflight.py --report C:\path\to\new-report.json
python C:\path\to\preflight.py --temp-root C:\path\to\existing-temp-parent
```

The adopted options are:

- `--json` prints the same structured result shape used by the report. JSON is
  emitted with ASCII escapes so a Windows non-UTF-8 console cannot corrupt it.
- `--report PATH` writes a new JSON file using exclusive creation. The parent
  directory must already exist. An existing file, including a race detected by
  exclusive creation, is refused and never overwritten.
- `--temp-root PATH` selects an existing directory as the parent only. The
  tool creates a fresh uniquely named child and never reuses or removes the
  parent. Without it, the operating system temporary directory is used.

Exit codes are:

- `0`: `PASS`; all required probes run in this execution succeeded and the
  observed OS/Python pair is in the recorded scope.
- `1`: `FAIL`; at least one probe or cleanup operation failed.
- `2`: usage or report-output failure; a result is not treated as PASS when the
  requested report cannot be written.
- `3`: `UNVERIFIED_ENVIRONMENT`; probes ran, but the OS/Python implementation
  pair is outside the recorded scope. This is neither support confirmation nor
  a probe failure.

Each JSON result includes minimal environment information, every probe's
status/message and safe error type, cleanup status, overall status, and
`NOT_RUN` boundaries. It does not print credentials, all environment
variables, user-file contents, or unnecessary personal absolute paths.

## Filesystem safety

The tool creates a new child directory with exclusive directory creation under
the selected temporary parent. Existing files and directories are not reused
or deleted. Cleanup enumerates only that owned root, refuses symbolic links,
Windows reparse points, and non-regular entries, and removes no parent or
outside target. If cleanup fails, the result is `FAIL` and the message limits
manual inspection to that owned directory; broad deletion and privilege
changes are not solutions.

This is intentionally not a claim of protection against concurrent path
replacement between validation and later filesystem operations. It does not
change system settings or relax permissions.

## Local verification record

The following record is for the current worktree and is not a CI result:

- OS: Microsoft Windows 11 Pro, build 26200.
- Shell: Windows PowerShell 5.1.26100.9444.
- Python: CPython 3.14.5, 64-bit.
- Preflight checks: 8 executed checks, with the explicit CI/full-lab/
  filesystem-matrix/evidence/rehearsal/publication scopes marked `NOT_RUN`.
- Regression tests: 13 `unittest` tests.
- Syntax check: `py_compile` for `preflight.py` and `test_preflight.py`.
- Diff hygiene: `git diff --check`.
- Not run: the full integrity lab, the full timeline lab, browser checks,
  package build, ZIP/matrix workflows, or CI.

`PASS` here means only that the probes executed at this location succeeded. It
does not mean that the labs or assignments were completed, that all platform
filesystem policies are compatible, that evidence was collected or
authenticated, that a learner/instructor rehearsal occurred, or that anything
is canonically registered, published, delivered, or deployment-ready.

## Existing package separation

The existing integrity/timeline lab code and rehearsal kit, the existing
Python preflight, package builder, allowlist, manifest, ZIP, workflow,
Foundation, canonical registry, schema/migration, and dependency were not
changed. This new verification path is not included in the existing ZIP by
this worktree. Any future package integration requires a separate
allowlist/source/manifest/CI review.
