# Instructor Runbook: Integrity Lab Rehearsal

## Purpose and status

This runbook prepares a human-led rehearsal of one independent, synthetic
local lab: `examples/digital-forensics-integrity-local-lab/`. It is not a
new course objective or practical, and it is not a classroom delivery result.
The current Foundation remains [`DRAFT_UNPUBLISHED`](../../../content-drafts/digital-forensics-8h-foundation/manifest.json),
`DF-H02-P01` remains `SYNTHETIC_SPEC_ONLY`, and the Foundation still declares
`executableLabs: 0`.

Reuse the implementation and safety explanation in the [lab README](../README.md),
the [existing learner guide](../learner-guide.md), the [existing instructor
guide](../instructor-guide.md), the [CLI](../cli.py), and the [test
module](../test_lab.py). This runbook adds facilitation timing, observation
prompts, recovery boundaries, and a handoff routine; it does not duplicate
the lab contract.

The Foundation metadata gives the DF-H02 module 60 minutes, but it does not
assign an official execution time to this independent executable package.
The schedule below is therefore a rehearsal planning proposal, not a
validated learner-duration claim. It excludes breaks, lunch, room setup,
account setup, and other administration; those are planned separately.
It is a separate facilitator-led rehearsal allocation that includes instructor
checks, repetition of negative cases, feedback, and closeout; it is not a
75-minute learner class allocation and does not change the 60-minute DF-H02
module value.

## Before learners arrive

Record the following in [`rehearsal-checklist.md`](rehearsal-checklist.md):

- rehearsal date, facilitator, cohort label, and room or meeting mode;
- operating system, shell, Python version, and whether symlink creation is
  permitted;
- the fresh repository revision used for the rehearsal; and
- the proposed schedule and any known accessibility or filesystem limits.

The previously verified local environment is Windows 11 Pro build 26200,
PowerShell 5.1, and Python 3.14.5. The lab CI also exercises Windows/Linux
with Python 3.11/3.14. Do not turn those automated results into a claim that
this classroom has been rehearsed. macOS and other filesystem policies are
not covered by the current evidence.

### Safety gate

Before running any command, say and confirm:

- Every workspace is a new temporary workspace created by `prepare`.
- Every byte is synthetic training content. No disk image, user file,
  browser data, credential, account, real incident, network target, or
  personal data is allowed.
- `original/` is not edited. Only the provided `working-copy` mutation and
  removal commands, or an intentional edit to a synthetic manifest/custody
  record for a negative case, are allowed.
- No command uses a pre-existing directory, broad recursive deletion, system
  security setting change, process termination, or external service.
- A non-zero exit in a negative case is recorded as an observation. It is not
  silently converted into a pass or replaced with a mock.

If a learner selects a real path or real data, pause immediately. Do not
continue, clean that path, or ask the learner to repair it with a broad
delete. Record the event and move to a fresh synthetic workspace.

## Proposed rehearsal schedule

| Stage | Proposed minutes | Facilitator focus | Learner artifact |
|---|---:|---|---|
| Environment and safety gate | 10 | Confirm versions, synthetic-only scope, and blank records | Setup fields |
| Boundary framing | 8 | Original vs working copy, trust boundary, time fields | Scope notes |
| Normal prepare and verify | 12 | Observe actual paths, sizes, hashes, report, and exit code | Normal run record |
| Tamper and missing-file cases | 15 | Compare mismatch with missing record; prove original preservation | Negative-case records |
| Manifest, custody, path, and cleanup boundaries | 18 | Exercise safe rejection and owner-bound cleanup | Boundary observations |
| Interpretation and limitation discussion | 7 | Hash scope, provenance, custody, acquisition, TOCTOU | Human conclusion |
| Cleanup and handoff review | 5 | Remove only the generated workspace; inspect records | Checklist and next actions |
| **Total proposed lab time** | **75** | Planning value only; not measured delivery time | — |

Do not add breaks or lunch to the 75-minute total. Record them as separate
administrative time in the checklist.

## Demonstration sequence

### 1. Prepare a fresh workspace

Use the same command contract as the [existing README](../README.md):

```powershell
$prepared = python .\examples\digital-forensics-integrity-local-lab\cli.py `
  prepare --recorded-at "2026-09-11T09:00:00+09:00" | ConvertFrom-Json
$workspace = $prepared.workspace
```

Ask learners to write down the printed workspace path, not a path invented
from memory. Inspect the directory names without opening any outside path:

- `original/` contains the generated source fixture;
- `working-copy/` contains the copy used for the exercise;
- `evidence-manifest.json` records the three expected pairs and their
  observed size/hash values at generation time;
- `chain-of-custody.json` records the educational handoff events;
- the marker and owner record bind cleanup to this generated workspace.

Do not reveal digest strings before learners record their own output.

### 2. Run the normal case

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  verify --workspace $workspace --report reports\normal.json
```

Have each learner record the complete relevant JSON fields, actual relative
paths, sizes, digests, report path, and process exit code in the workbook.
The instructor should look for evidence that the learner can distinguish:

- the caller-provided `recorded_at` from verifier-generated `verified_at`;
- a file record from a pair comparison; and
- a hash match from a claim about provenance or authenticity.

### 3. Run the tamper case

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  tamper --workspace $workspace `
  --path working-copy/host-alpha/events/authentication.log
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  verify --workspace $workspace --report reports\tampered.json
```

The learner must record the actual non-zero verification exit code, the
observed file/pair result, and the original's unchanged evidence. Ask what
changed in the working copy and which observation supports that conclusion.
Do not let a learner edit the original to create a more obvious mismatch.

### 4. Run the missing-file case from a fresh workspace

Use a new `$missingWorkspace` so the tamper case cannot contaminate the
missing case:

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

Ask learners to explain why a missing file is different from a present file
whose bytes do not match. Keep both workspace paths visible and clean both
with the exact `cleanup` command after their records are complete.

### 5. Exercise negative boundaries

Use only a fresh synthetic workspace per case. The existing [test
module](../test_lab.py) is the authoritative executable reference for the
negative cases; do not create new objectives or extra lab behavior during a
rehearsal.

| Case | What the learner does | Observation to request |
|---|---|---|
| Absolute or `../` path | Edit a synthetic manifest entry only | The verifier rejects the path without reading the outside sentinel |
| Duplicate manifest path/pair | Duplicate one synthetic entry | The inventory is rejected rather than counted twice |
| Missing or additional pair | Remove or replace one synthetic pair | The exact generated inventory is required |
| Bad JSON or field | Break a synthetic JSON record or field | The command reports an explicit rejection and exit code |
| Oversized input | Use the existing bounded test, not a real large file | The 4 MiB file / 1 MiB JSON limits reject the input |
| Missing custody field | Remove one required synthetic custody field | The named required field is reported |
| Symlink | Create a link only inside the synthetic workspace | The link is rejected and its path is observable |
| Windows junction/reparse point | Run the Windows-specific test on Windows | The junction is actually tested; Linux may record only this case as platform-specific `NOT_RUN` |
| Report overwrite | Reuse an existing `reports/` filename | Exclusive creation refuses the overwrite |
| Forged or replaced cleanup root | Use the disposable boundary test with an outside sentinel | Marker-only, copied-marker, replaced-root, root-link, and partial-root cases do not delete the sentinel or original |

A symlink creation permission failure on a runner that is meant to test the
boundary is not a PASS. Do not change OS security settings during class.
Record the environment limitation and arrange a supported verification
environment separately. Do not describe the Linux junction `NOT_RUN` as a
successful junction test.

### 6. Discuss the interpretation boundary

Ask before explaining:

1. Which exact bytes did the streaming SHA-256 cover?
2. What does equal size/hash establish, and what does it leave unknown?
3. If a file and its manifest are changed together, what authenticity claim
   remains unsupported?
4. Why is a normal copy not forensic acquisition, and why is this not a
   hardware write blocker?
5. Which fields make custody inspectable, and why are they not a signature or
   identity proof?
6. Where is the path-validation/file-open TOCTOU gap that this lab does not
   defend?

The intended teaching point is bounded reasoning, not a forensic conclusion.
Record the learner's words and evidence in the workbook before showing the
existing instructor guide's explanation.

## Step-by-step learner instructions

Give learners the [learner workbook](learner-workbook.md) and the [existing
learner guide](../learner-guide.md). Require the following sequence:

1. Record OS, shell, Python, caller time, and workspace path.
2. Prepare and inspect a fresh synthetic workspace.
3. Verify without mutation and record actual JSON observations.
4. Tamper only with the named working-copy file; verify and explain the
   mismatch.
5. Start fresh for the missing-file case; remove only the named working-copy
   file and verify.
6. Complete at least the path, custody, report-overwrite, and applicable
   symlink/reparse observations using synthetic inputs.
7. Record why each negative case is accepted or rejected, not only a checkbox.
8. State the hash, provenance, custody, acquisition, write-blocker, and TOCTOU
   limits in the human conclusion.
9. Clean only the generated workspaces and record whether they still exist.

## Common misconceptions and hints

| Misconception or blockage | Hint without giving the answer |
|---|---|
| A negative exit code means the program crashed. | Read `status`, pair/file result, `errors`, and exit code together. |
| The working copy is the evidence source. | Point to the two role roots and ask which one the mutation command permits. |
| Equal hashes prove the file is genuine. | Ask whether the manifest and both files were independently trusted before comparison. |
| The manifest is a signed authority. | Inspect its limitations and ask where a signature or identity verifier is implemented. |
| A complete custody JSON proves chain of custody. | Separate inspectable fields from identity authentication and legal sufficiency. |
| The timestamp says when collection happened. | Compare caller `recorded_at` with verifier `verified_at`. |
| A symlink target inside the workspace is safe. | The path boundary rejects the link itself; record the exact path/error. |
| A marker means any directory can be deleted. | Cleanup requires the matching path-bound owner record; use the sentinel case. |
| I can reuse the report filename. | Reports are new outputs; create a new name for each observation. |
| I can fix a broken workspace by editing `original/`. | Abandon it, start fresh, preserve the original, and record the recovery. |

## Stop, recover, and clean up

### Stop conditions

Stop the learner's run and record the reason if:

- a command would read, modify, or delete outside the generated workspace;
- a real file, credential, account, browser profile, disk image, or incident
  material appears;
- a learner proposes broad recursive deletion, process termination, or an OS
  security-setting change;
- the workspace root is a symlink/reparse point or the marker is not bound to
  the path being used; or
- a negative test cannot be reproduced without violating the synthetic-only
  boundary.

### Recovery sequence

1. Stop without attempting a broad cleanup.
2. Record the command, path, observed output, and whether any file was
   changed.
3. Preserve the synthetic original and any outside sentinel.
4. Start a new workspace with `prepare` for the next case.
5. Use only the exact `cleanup --workspace <printed-path>` command for a
   generated workspace. If it rejects the target, keep the path and report;
   do not substitute a recursive delete.

If `prepare` fails partway through, verify that the new workspace root is
removed while its parent sentinel remains. If a report write fails because a
name exists, retain the existing report and choose a new report filename.

### Closeout

For each generated workspace:

```powershell
python .\examples\digital-forensics-integrity-local-lab\cli.py `
  cleanup --workspace $workspace
```

Repeat for `$missingWorkspace`. Record the cleanup exit code and whether each
path still exists. The cleanup result is evidence about this synthetic
workspace only; it is not evidence of secure deletion, legal evidence
disposition, or system-wide cleanup.

## Instructor handoff

Before ending the rehearsal, collect:

- the learner workbook with actual paths, output, and reasoning;
- the assessment rubric with evidence citations, not only marks;
- the checklist's environment, timing, help, and recovery entries;
- any unverified OS/filesystem case and the reason it was not run; and
- any reproducible implementation defect as a separate engineering note.

Do not record CI results as a human rehearsal result. Do not promote this
package to classroom delivery readiness until a separate human rehearsal and
content review have actually occurred.
