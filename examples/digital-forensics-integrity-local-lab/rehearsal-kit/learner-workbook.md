# Learner Workbook: Integrity Lab Rehearsal

Use this workbook with the [existing learner guide](../learner-guide.md). The
existing guide explains the complete lab contract; this workbook is the place
to record what you actually ran and observed. Do not copy digest values,
status values, paths, or explanations from an example. Blank cells are
intentional.

This is one independent synthetic local lab. It is not a new canonical
practical, an Evidence record, a legal evidence procedure, or a claim that
the Foundation is executable. The Foundation is `DRAFT_UNPUBLISHED`,
`DF-H02-P01` is `SYNTHETIC_SPEC_ONLY`, and `executableLabs: 0` remains in
force.

## Safety and scope record

Use only a fresh workspace printed by `prepare`. Do not use a disk image,
user file, browser profile, credential, account, real incident, network
target, or personal data. Do not edit `original/`. Do not use a broad delete,
process termination, external service, or OS security-setting change.

| Field | Your record |
|---|---|
| Learner | |
| Facilitator | |
| Date/time and timezone | |
| Repository revision | |
| Operating system and version | |
| Shell | |
| Python version and executable | |
| Is symlink creation permitted? How was this checked? | |
| Synthetic-only boundary confirmed? Explain how. | |
| Any path or data that caused a stop? | |

## Code and contract map

Read the [lab README](../README.md), [CLI](../cli.py), and [test
module](../test_lab.py) before starting. Inspect the implementation only as
needed to support your explanation. Record the locations you actually used;
the names below are prompts, not completed evidence.

| Concern | File and symbol/line you inspected | What the code appears to enforce |
|---|---|---|
| Fixture generation | | |
| Streaming size/hash calculation | | |
| Relative-path and reparse-point check | | |
| Manifest/file/pair verification | | |
| Original/working-copy mutation boundary | | |
| Report no-overwrite behavior | | |
| Cleanup ownership/path check | | |
| Cleanup deletion call | | |

## 1. Prepare and identify the workspace

Run from the repository root. Record the caller time before running the
command. The command below is the existing lab command; use `python3` on a
Linux shell if that is the interpreter name in your environment.

```powershell
$prepared = python .\examples\digital-forensics-integrity-local-lab\cli.py `
  prepare --recorded-at "2026-09-11T09:00:00+09:00" | ConvertFrom-Json
$workspace = $prepared.workspace
```

| Observation | Your record |
|---|---|
| Exact command used | |
| `prepare` exit code | |
| Printed workspace path | |
| Manifest path | |
| Custody path | |
| File count reported | |
| Caller-supplied `recorded_at` | |
| Directory names observed under the workspace | |
| Anything unexpected | |

Describe the roles without treating the word `evidence` as a claim of legal
status:

| Question | Your answer and observed path |
|---|---|
| Which path is the generated original fixture? | |
| Which path is the working copy? | |
| Which files are records about the fixture rather than fixture bytes? | |
| Which path is outside the fixture root and prohibited? | |
| What is the intended cleanup target? | |

## 2. Normal verification

Run verification without changing the workspace and save a new report:

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  verify --workspace $workspace --report reports\normal.json
```

Record the actual output. Do not fill a blank with an expected hash.

| Field | Your observation |
|---|---|
| Exact command | |
| Exit code | |
| Top-level status | |
| Report path | |
| `recorded_at` | |
| `verified_at` | |
| Why those timestamps are different fields | |
| Manifest entry count | |
| File-check count | |
| Pair-check count | |
| Error count and exact errors | |

### Original and working-copy observations

| Role | Actual relative path | Observed size | Observed SHA-256 | File status | Evidence in output |
|---|---|---:|---|---|---|
| original | | | | | |
| working copy | | | | | |
| original | | | | | |
| working copy | | | | | |
| original | | | | | |
| working copy | | | | | |

| Check | Actual observation | Reasoning |
|---|---|---|
| Original and working-copy pair comparison | | |
| Manifest and custody validation | | |
| Original remained unchanged during verification | | |
| Report was created without overwriting another report | | |

## 3. Tamper case

Use only the working-copy path shown below. Record the output before and after
verification:

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  tamper --workspace $workspace `
  --path working-copy/host-alpha/events/authentication.log
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  verify --workspace $workspace --report reports\tampered.json
```

| Field | Your observation |
|---|---|
| Mutation command and exit code | |
| Mutated relative path | |
| Verification command and exit code | |
| Observed file status/size/hash | |
| Observed pair status | |
| Exact relevant error | |
| Original path checked after mutation | |
| Original size/hash after mutation | |
| Why the observation supports or does not support your conclusion | |

Explain the distinction:

| Prompt | Your answer |
|---|---|
| What changed? | |
| What did not change? | |
| What is the strongest byte-level conclusion? | |
| What actor, intent, provenance, or authenticity claim remains unsupported? | |

## 4. Missing-file case

Start a fresh workspace for this case. Do not reuse the tampered workspace.

```powershell
$missingPrepared = python .\examples\digital-forensics-integrity-local-lab\cli.py `
  prepare --recorded-at "2026-09-11T09:05:00+09:00" | ConvertFrom-Json
$missingWorkspace = $missingPrepared.workspace
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  remove --workspace $missingWorkspace `
  --path working-copy/host-beta/network/network-summary.txt
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  verify --workspace $missingWorkspace --report reports\missing.json
```

| Field | Your observation |
|---|---|
| Fresh workspace path | |
| `remove` exit code and output | |
| `verify` exit code | |
| Missing path/status in the report | |
| Pair status | |
| Exact error(s) | |
| Why missing differs from a present-but-mismatching file | |
| Original file and hash after this case | |

## 5. Boundary and record cases

Use a fresh synthetic workspace for each case. Make only synthetic manifest
or custody edits. The [existing tests](../test_lab.py) are the executable
reference for the boundary checks. Record commands or intentional edits and
actual output; do not convert a skipped or unavailable check into a success.

| Case | Exact command/edit | Actual path/status/size/hash/error | Exit code | Your reasoning |
|---|---|---|---:|---|
| Absolute manifest path | | | | |
| `../` traversal path | | | | |
| Duplicate manifest path/pair | | | | |
| Missing expected pair | | | | |
| Additional pair | | | | |
| Malformed JSON | | | | |
| Invalid manifest or custody field | | | | |
| Oversized input record | | | | |
| Missing custody field | | | | |
| Symlink inside workspace | | | | |
| Windows junction/reparse point | | | | |
| Existing report overwrite | | | | |
| Marker-only or forged cleanup target | | | | |
| Replaced root or root symlink | | | | |
| Partial prepare failure with outside sentinel | | | | |

For symlink/reparse cases, record the platform and permission outcome. A
symlink creation failure on a runner expected to test that boundary is not a
PASS. The Windows junction case is platform-specific on Linux; record that
fact rather than claiming that a junction was tested.

## 6. Custody and interpretation

Inspect the synthetic `chain-of-custody.json` and your verification report.
Record the actual fields and then answer in your own words.

| Custody item | Actual value or location |
|---|---|
| Custody file path | |
| Number of entries | |
| Event fields observed | |
| Time fields observed | |
| From/to fields observed | |
| Reason/location fields observed | |
| Any omitted or invalid field tested | |

| Prompt | Your answer and supporting observation |
|---|---|
| What bytes did the hash comparison cover? | |
| What does a hash match establish? | |
| Why does it not prove source authenticity or lawful collection? | |
| Why would changing both files and the manifest fail to prove provenance? | |
| Why is this copy not forensic acquisition? | |
| Why is this not a physical write blocker? | |
| Why is the custody record not a signature or identity proof? | |
| What does the cleanup owner/path check protect against in this exercise? | |
| What race between path validation and file opening is not defended? | |
| What limitation remains in this run? | |

## 7. Human judgment

Do not use a checkbox as the conclusion. Cite actual paths, output, exit
codes, or test evidence.

| Question | Your judgment and evidence |
|---|---|
| Is the synthetic original preserved? Why? | |
| Is the working copy suitable for this bounded comparison? Why? | |
| Which negative case was most informative? | |
| Which case was not run, and why? | |
| What would you not claim from this lab? | |
| Final human judgment for this run | |

## 8. Cleanup record

Clean only the generated paths printed by `prepare`:

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  cleanup --workspace $workspace
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  cleanup --workspace $missingWorkspace
```

| Workspace | Exact cleanup command | Exit code/output | Path still exists? | Outside sentinel/original observation |
|---|---|---:|---|---|
| normal/tamper workspace | | | | |
| missing-file workspace | | | | |

If cleanup rejects a target, do not substitute a recursive delete. Preserve
the path, record the error, and tell the facilitator.
