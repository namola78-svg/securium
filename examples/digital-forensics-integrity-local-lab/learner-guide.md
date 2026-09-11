# Learner Guide: Synthetic Evidence Integrity

## What this draft lets you practice

This independent local exercise lets you create a small synthetic evidence
set, separate an `original` from a `working-copy`, calculate size and
streaming SHA-256 values, and record what the verifier actually observed.
It also lets you demonstrate rejection of tampering, missing files, unsafe
paths, symlinks/reparse points, incomplete handoff records, oversized or
malformed records, manifest duplicate/missing/additional entries, and report
overwrites.

It is conceptually aligned with the existing foundation's preservation and
integrity discussion, especially the `DF-H02-P01` specification, but it is not
that canonical practical and does not change its `SYNTHETIC_SPEC_ONLY` or
`executableLabs: 0` status.

## Boundaries before you start

- Use only the temporary workspace created by `prepare`.
- Do not point any command at a real file, disk, browser profile, account,
  credential, or incident record.
- Do not edit anything under `original/`. The only intentional mutations are
  the provided working-copy `tamper` and `remove` actions, or an explicit
  negative-test edit to the synthetic manifest/custody record.
- Treat a non-zero verification exit code as an observation to record. Do not
  replace it with a mock or manually change the report to make it pass.
- The manifest is part of the exercise input. A matching file and manifest
  does not independently prove that either was authentic before the run.
- The workspace marker is not a general deletion permission. `cleanup` also
  checks the path-bound owner record and rejects a copied marker, replaced
  root, root symlink, or Windows reparse-point path.

## Procedure

Run from the repository root. Enter a caller-provided time with a timezone;
this is a record about the exercise, not a claim about when evidence was
collected.

```powershell
$prepared = python .\examples\digital-forensics-integrity-local-lab\cli.py `
  prepare --recorded-at "2026-09-11T09:00:00+09:00" | ConvertFrom-Json
$workspace = $prepared.workspace
```

Inspect the printed workspace path and directory layout. Then verify an
untouched workspace and save a new report path:

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  verify --workspace $workspace --report reports\normal.json
```

Record the complete observed output needed to support your conclusion. Do not
copy an expected digest from this guide.

### Tamper case

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  tamper --workspace $workspace `
  --path working-copy/host-alpha/events/authentication.log
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  verify --workspace $workspace --report reports\tampered.json
```

Explain which file changed, which comparison detected it, and how you know
the original was not changed.

### Missing-file case

Start with a fresh workspace so the case has a clean baseline, then run:

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  remove --workspace $workspace `
  --path working-copy/host-beta/network/network-summary.txt
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  verify --workspace $workspace --report reports\missing.json
```

Record whether the failure is a missing file, a byte mismatch, or both, and
why the distinction matters.

### Boundary and record cases

Use a fresh workspace for each case. For a path-boundary case, make an
intentional edit to a synthetic manifest entry so a path contains `../`; do
not create or read a real outside file. For a symlink case, create a symlink
inside the synthetic `working-copy` that points at another synthetic file, if
your OS policy permits it. Run `verify` and record the exact rejection. A
symlink creation failure on a target compatibility runner is a failed check,
not a PASS; do not substitute a regular file. On Linux, the Windows junction
case is platform-specific and may be recorded as the one explicit `NOT_RUN`
case. Input files are bounded to 4 MiB and JSON records to 1 MiB; malformed
JSON and invalid fields must fail explicitly.

Remove one required field from a synthetic custody entry and verify again.
Finally write one report, run the same report command a second time, and
record the overwrite refusal. Use a new report filename for every verification
observation you want to keep.

## Learner record

Complete the fields with your own paths, output, and reasoning. Blank cells
are intentional: this is a record sheet, not a pre-filled answer.

### Run identity and time separation

| Field | Your record |
|---|---|
| Operating system and shell | |
| Python version | |
| Workspace path printed by `prepare` | |
| Caller-supplied `recorded_at` | |
| `verified_at` observed in the report | |
| Why those two times are different fields | |

### Evidence and protection scope

| Question | Your record |
|---|---|
| What synthetic bytes are in scope? | |
| What is protected as the original? Give path. | |
| What is the working copy? Give path. | |
| What is outside the fixture root or prohibited? | |
| What trust boundary does the verifier enforce? | |

### Normal verification observations

| File role | Actual relative path | Observed size | Observed SHA-256 | Command/report | Observed result and evidence |
|---|---|---|---|---|---|
| original | | | | | |
| working copy | | | | | |
| original | | | | | |
| working copy | | | | | |
| original | | | | | |
| working copy | | | | | |

| Check | Your observed output/exit code | Reasoning |
|---|---|---|
| Original-to-copy comparison | | |
| Manifest and custody record | | |
| Original remained unchanged | | |

### Negative-case observations

| Case | Exact command or intentional change | Observed path/status/size/hash/error | Exit code | Why the verifier should accept or reject |
|---|---|---|---|---|
| tampered working copy | | | | |
| missing working-copy file | | | | |
| manifest size mismatch | | | | |
| missing custody field | | | | |
| path outside fixture root | | | | |
| unapproved symlink | | | | |
| report overwrite attempt | | | | |
| forged marker or replaced/root-link cleanup | | | | |

### Human conclusion

| Prompt | Your answer and evidence |
|---|---|
| What exactly did the hash comparison establish? | |
| What did it not establish? | |
| Why does changing both the files and manifest fail to prove provenance? | |
| Why is a working copy not the same as forensic acquisition? | |
| Why is the handoff JSON not identity or signature verification? | |
| Which exact code paths enforce the workspace and file boundaries? | |
| What race between path validation and file opening is not defended? | |
| What limitation remains in this run? | |
| Final human judgment, with the observed paths/output supporting it | |

## Closeout

After preserving any notes you need, remove only the marked temporary
workspace:

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  cleanup --workspace $workspace
```

Record whether cleanup completed and whether the workspace path still exists.
This exercise has no Securium Evidence record, score, mastery state, or
publication step. It also does not implement legal evidence handling,
forensic acquisition, or hardware write-blocking.
