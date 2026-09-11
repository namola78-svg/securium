# Instructor Guide: Synthetic Evidence Integrity

## Status and relationship

This is an independent executable local-lab draft, not a new canonical
course/module/objective/practical record. The existing Digital Forensics 8H
foundation is unpublished, declares zero executable labs, and describes the
related `DF-H02-P01` practical as a synthetic specification without command
execution or real evidence handling. Use this guide to facilitate a bounded
pilot only; do not present it as a published course lab, legal evidence
procedure, official examination, or completed delivery.

The package does not import Securium application code and does not create
Evidence projection, recompute, learner-skill, mastery, or confidence state.

## Draft learning aims (no canonical IDs)

By the end of this exercise, a learner should be able to:

- distinguish a synthetic original fixture from its explicitly named working
  copy;
- explain what a streaming size/SHA-256 comparison does and does not show;
- produce and inspect a bounded manifest and handoff record;
- reproduce detection of a copy mutation, missing file, size mismatch, unsafe
  path, unapproved symlink, incomplete custody record, and output overwrite;
- separate a caller's recorded time from the verifier's observation time; and
- state the remaining provenance, collection, legal, and interpretation
  limits in human language.

These are package-level teaching aims, not additions to the canonical
foundation objective set.

## Prerequisites and safety briefing

Learners need basic Python command-line and filesystem knowledge. Before
starting, confirm that every path is inside a new temporary workspace and that
the class will use synthetic bytes only. Explicitly prohibit real disk images,
user files, browser data, credentials, accounts, live endpoints, incident
records, and external network targets.

Explain that the code's `tamper` and `remove` operations are deliberately
limited to `working-copy/`. The verifier rejects traversal and symlinks, and
the report writer uses exclusive creation. It also requires an owner record
bound to the marked workspace path, rejects Windows reparse points, and does
not treat a marker copied into another directory as cleanup authority. No
command should be pointed at a pre-existing user directory.

## Suggested facilitation sequence

The sequence below is a planning aid, not a measured learner-duration claim:

1. Introduce the boundary and ask learners to name what is and is not evidence
   in this exercise.
2. Run `prepare`, inspect `original/`, `working-copy/`, the manifest, and the
   custody record.
3. Run the untouched verification. Ask learners to record actual paths,
   sizes, hashes, report output, and exit code.
4. Run the tamper case. Require a before/after observation and a separate
   statement that the original was checked again.
5. Run the missing-file case from a fresh workspace. Compare a missing record
   with a present-but-mismatching file.
6. Demonstrate manifest path escape, custody omission, symlink rejection, and
   report overwrite protection. Let learners explain the relevant boundary.
7. Collect the learner conclusion before showing this guide's observations.
8. Demonstrate duplicate, missing, and additional manifest pairs; malformed
   JSON/fields; and the 4 MiB file / 1 MiB JSON record limits.
9. Demonstrate a forged marker, replaced workspace marker, root symlink, and
   partial prepare failure with an outside sentinel. Confirm the sentinel and
   original remain untouched.
10. Run `cleanup` and inspect that only the marked, owner-bound temporary
    workspace was removed.

## Commands used in the demonstration

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

The verifier itself performs streaming reads through `streaming_sha256`; it
does not replace the real file with a mock or rely on a prewritten PASS. The
test module also exercises the negative cases without external services.

## Expected observations and troubleshooting

Do not give learners the actual digest strings in advance. Confirm their
observations against the following behavior:

| Demonstration | Expected observation | Common cause if it differs | Hint |
|---|---|---|---|
| `prepare` | A new marked temporary workspace contains original/copy files and two JSON records. | Workspace already exists or timestamp has no timezone. | Use a new path and a timezone-qualified caller value. |
| Untouched `verify` | The manifest-listed original and working-copy files are readable, their size/hash records agree, and custody fields are complete. | Wrong workspace, edited manifest, or incomplete JSON. | Check the printed workspace and record paths exactly. |
| `tamper` then `verify` | The working-copy file's observed size/hash differs and the original/working-copy pair is rejected. | The command targeted `original/` or a different file. | The mutation command accepts working-copy paths only. |
| `remove` then `verify` | The listed working-copy file is missing and its pair is incomplete. | A new workspace was not used or the path was mistyped. | Compare the manifest path with the command path. |
| Manifest size mutation | A size mismatch is reported even if the bytes were not changed. | Learner changed the file instead of the expected record. | Explain expected metadata versus observed bytes. |
| Missing custody field | Verification is rejected for the named required handoff field. | JSON syntax was broken or the wrong record was edited. | Keep the edit synthetic and use a fresh workspace afterward. |
| `../` or absolute manifest path | The path is rejected before anything outside the fixture root is read. | Path was changed in an unlisted record. | The verifier only trusts safe relative paths under the role root. |
| Symlink under workspace | Verification is rejected and the symlink path is listed. | Symlink creation failed on a runner that is meant to verify this boundary. | Treat permission failure as a failed check; do not replace it with a regular file. |
| Windows junction/reparse point | On Windows, verification is rejected and the path is listed; Linux records this platform-specific test as the one expected skip. | `mklink /J` failed on Windows. | Fail the Windows job; an unavailable junction check is not PASS. |
| Duplicate/missing/additional manifest pair | Verification rejects the inventory instead of accepting a partial or repeated record. | `file_count` was edited without preserving the exact synthetic inventory. | Compare both original and working-copy paths to the three generated pairs. |
| Malformed/oversized record | Verification fails explicitly for bad JSON/fields or over-limit input. | The wrong JSON file was edited or the limit was misunderstood. | Preserve the error and exit code as an observation. |
| Existing report path | Exclusive report creation refuses to overwrite it. | Learner reused a report filename. | Use a new path under `reports/`. |
| `cleanup` | Only the owner-bound workspace with the matching marker/path is eligible for removal. | Marker copied, root replaced, root symlinked, or owner record missing. | Keep an outside sentinel and original file to prove they survive. |

The local verified environment for this draft is Windows 11 Pro build 26200,
PowerShell 5.1, Python 3.14.5. The lab-specific CI is the source of evidence
for the Windows/Linux × Python 3.11/3.14 matrix; Python 3.11 and Linux are
not local results, and macOS/other filesystem policies remain unverified.
The Windows symlink and junction/reparse checks must execute successfully;
the Linux job may report only the explicitly platform-specific junction skip.

## Discussion and answer points

Use questions before revealing the explanation:

1. Which bytes did the hash comparison cover, and where is that scope written?
2. Why are the original and working-copy records separate even when their
   hashes match?
3. What does a changed copy hash tell us, and what does it not tell us about
   who changed it or why?
4. Why should a caller's `recorded_at` not be replaced by the verifier's
   `verified_at`?
5. Which trust boundary blocks an absolute or parent path? Why are symlinks
   rejected even when a symlink target is inside the workspace?
6. Why is this copy operation not a forensic acquisition, and why is the
   read-only code path not a hardware write blocker?
7. Which custody fields are needed to make the handoff record inspectable, and
   why is that still not a signature or identity proof?
8. What source, authorization, provenance, collection, or interpretation
   question remains unanswered after every local check passes?
9. Why would changing both a file and its manifest fail to establish
   provenance or original authenticity?
10. Where is the time-of-check/time-of-use boundary between path validation
    and opening a file, and what does this lab deliberately not guarantee?

The key teaching point is bounded reasoning: a matching digest supports byte
identity for the compared objects under the stated algorithm and scope. It
does not establish provenance, lawful collection, previous integrity, actor,
intent, meaning, legal admissibility, or certification readiness. A complete
handoff format improves reviewability but is not identity authentication.

## Closeout and escalation

Require each learner to submit the completed record with actual observations,
not only check marks. Confirm the workspace was cleaned and no real data was
used. Do not mark an unavailable symlink/junction boundary as PASS. Record an
OS-policy limitation only for the explicitly platform-specific case, and
record a failure when the target matrix runner cannot create the symlink it is
expected to check.

If the package is later proposed for canonical course integration, perform a
separate content review and approval process. This draft does not change the
existing foundation manifest, runtime registration, schema, database, or
publication state.
