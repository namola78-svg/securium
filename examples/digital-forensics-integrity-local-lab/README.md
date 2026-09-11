# Synthetic Forensics Integrity Local Lab

This directory is an independent executable local-lab draft for practicing
bounded evidence copying, byte hashing, integrity comparison, and handoff
recording. It creates only synthetic files in a new temporary workspace. No
fixture data is committed to the repository.

## Relationship to the existing course draft

The current Digital Forensics 8H foundation at
[`content-drafts/digital-forensics-8h-foundation/`](../../content-drafts/digital-forensics-8h-foundation/)
is `DRAFT_UNPUBLISHED`. Its manifest declares `executableLabs: 0`, and the
related `DF-H02-P01` practical is `SYNTHETIC_SPEC_ONLY` with no device access,
image mounting, command execution, or real evidence handling. This package is
therefore an independent draft aligned to those integrity concepts; it does
not bind to a new canonical course/module/objective/question ID, change the
foundation manifest, or register a runtime practical.

## Use order

1. Read [`learner-guide.md`](learner-guide.md) and record the caller-supplied
   time before creating a workspace.
2. Run `prepare` to create a fresh workspace under the operating system's
   temporary directory. The command prints the path; keep it for the rest of
   the exercise.
3. Run `verify` without changing anything. Record the actual JSON output,
   file locations, observed sizes/digests, and exit code in the learner guide.
4. Run the explicit `tamper` and `remove` commands against the working copy,
   verifying after each change with a new report path.
5. Use the negative tests for path escape, symlink rejection, missing custody
   fields, and report overwrite protection. Do not use real files as targets.
6. Run `cleanup` and confirm that the marked temporary workspace is gone.
7. Instructors should use [`instructor-guide.md`](instructor-guide.md) for
   expected observations and discussion; it is intentionally separate from
   the learner record.

## Commands

From the repository root in PowerShell:

```powershell
$prepared = python .\examples\digital-forensics-integrity-local-lab\cli.py `
  prepare --recorded-at "2026-09-11T09:00:00+09:00" | ConvertFrom-Json
$workspace = $prepared.workspace

python .\examples\digital-forensics-integrity-local-lab\cli.py `
  verify --workspace $workspace --report reports\normal.json

python .\examples\digital-forensics-integrity-local-lab\cli.py `
  tamper --workspace $workspace `
  --path working-copy/host-alpha/events/authentication.log
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  verify --workspace $workspace --report reports\tampered.json

python .\examples\digital-forensics-integrity-local-lab\cli.py `
  cleanup --workspace $workspace
```

The tampered verification is supposed to be a negative case; record its
observed exit code and output rather than treating a non-zero exit as a tool
crash. The `remove` command has the same working-copy-only boundary:

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  remove --workspace $workspace `
  --path working-copy/host-beta/network/network-summary.txt
```

`verify` writes no report unless `--report` is supplied. A report path must be
new and under `reports/`; an existing path is rejected instead of silently
overwritten. `cleanup` removes only a workspace carrying this lab's marker.

## Implementation and test commands

The implementation uses only the Python standard library:

- `lab.py`: fixture generation, streaming SHA-256, safe path handling,
  verification, mutation controls, report writing, and marked cleanup.
- `cli.py`: `prepare`, `verify`, `tamper`, `remove`, and `cleanup` commands.
- `test_lab.py`: normal, tamper, missing, size mismatch, custody omission,
  path escape, symlink, original immutability, overwrite, and cleanup tests.

```powershell
python -m py_compile `
  examples/digital-forensics-integrity-local-lab/lab.py `
  examples/digital-forensics-integrity-local-lab/cli.py `
  examples/digital-forensics-integrity-local-lab/test_lab.py
python -m unittest discover `
  -s examples/digital-forensics-integrity-local-lab -p "test_*.py" -v
```

Verified in this worktree on Windows 11 Pro build 26200, PowerShell 5.1, and
64-bit Python 3.14.5. Python 3.11, Linux, macOS, and other filesystem policy
configurations are not verified by this draft. The test suite creates and
cleans its own temporary workspaces.

## Safety and interpretation boundary

- The inputs are synthetic training bytes only. No disk image, user file,
  browser history, credential, account, live endpoint, network target, or
  real incident material is used.
- A hash match means that the compared bytes matched under the stated
  algorithm and scope. It does not prove source authenticity, provenance,
  lawful collection, prior integrity, authorship, or the meaning of a record.
- A normal file copy is not forensic acquisition. The read-only behavior of
  this exercise is not a hardware write blocker.
- The JSON handoff record is an educational format, not a signature,
  identity-authentication mechanism, or legal chain-of-custody determination.
- `recorded_at` is supplied by the caller. `verified_at` is generated when
  verification observes the workspace; they must not be silently conflated.
- This lab is not connected to Securium's Evidence projection, recompute,
  learner-skill, or scoring systems. It makes no legal, certification, or
  delivery-readiness claim.
