# Extracted forensic timeline input-limit validation

This focused validation is anchored to the PR #194 source commit
`200e3db5a191eae2db82e8f4a426f0fcbf24f69e`. The worktree was created from
`c850db8e8cb18542993b3005c42200525cfcb6e2`, the fetched main at worktree
creation. A later required fetch observed `origin/main`
`00a467321b42e5cf86f7d83747e2f55949130fe0`; the intervening main delta has
no changes under the forensic timeline package, local lab, or its parser/
builder/verifier workflow paths. The relevant timeline package builder,
verifier, preflight, and timeline source were compared before execution; no
product, builder, allowlist, manifest, workflow, dependency, or existing test
file is changed by this validation.

## Coverage added beyond PR #194

PR #194's source-bound package contract already checks the exact source
allowlist, ZIP and manifest, trusted Git source bytes, safe extraction, and
the extracted preflight ordering. Its package runner did not execute the
input-size boundary against the extracted `timeline_lab.py`.

This focused runner uses the committed package builder and verifier, then
uses the existing package runner's extracted preflight helper. Only after
source verification and preflight does it invoke the extracted CLI by an
explicit absolute path. It does not import or fall back to the repository's
timeline module for the boundary cases.

## Commands

From this worktree:

```powershell
python tests/forensics-extracted-input-limits.test.py
```

The test invokes the dedicated runner with the fixed trusted source:

```powershell
python -B verification/forensics-extracted-input-limits/run.py `
  --source-commit 200e3db5a191eae2db82e8f4a426f0fcbf24f69e
```

The runner creates a task-owned temporary Git worktree at that exact commit,
builds the package outside the repository, and calls the existing builder
and verifier APIs with source-bound verification enabled. The source
allowlist and ZIP entry counts are read from the fixed package contract and
asserted as 13 source entries plus the internal manifest, 14 ZIP entries.
The temporary trusted worktree, artifact directory, extraction directory,
reports, fixtures, and subprocess workspace are removed after the run.

## Provenance and execution boundary

The runner records the trusted source commit, trusted source tree, package ZIP
size/hash, timeline source path and Git blob ID, manifest source entry, and
the extracted timeline bytes/hash. It requires the extracted bytes to equal
the trusted Git blob after the verifier reports `source_verification: PASS`.
The final output records the absolute extracted CLI/module paths and the
external working directory used for subprocesses.

Every subprocess uses an argument array with `shell=False`, a finite timeout,
and an environment with `PYTHONPATH` and `PYTHONHOME` removed. The extracted
module test double checks `module.__file__` and rejects a repository source
path. This validates source binding; it does not authenticate a validly
forged package whose trusted source and archive bytes have been replaced
together.

The existing extracted preflight is reported independently. Its required
probes and six documented `NOT_RUN` scopes are not changed into PASS by the
input-limit result; expected current output is 8 `PASS` and 6 `NOT_RUN` with
`lab_execution: PENDING` before this focused evaluation.

## Input fixtures and oracles

Fixtures are independently constructed synthetic JSON objects satisfying the
timeline parser's documented root and record fields. Byte sizes are measured
after UTF-8 encoding:

| Case | Input | Oracle |
| --- | ---: | --- |
| Normal | small valid JSON | CLI exit `0`, `ANALYZED`, one record, report created, raw bytes/hash unchanged |
| Exact boundary | exactly `1,048,576` bytes | CLI exit `0`, valid report, raw input hash matches |
| Overflow | exactly `1,048,577` bytes | CLI exit `2`, existing input-limit error, no report, input/hash and external sentinel unchanged |

The normal, exact-boundary, and overflow output paths are distinct. The
overflow case follows the normal and exact success cases without deleting or
overwriting their reports.

The actual CLI cases prove the extracted file is the execution target. A
separate standard-library test double loaded from that extracted absolute
path checks that success, overflow, and read-error paths request no more than
`MAX_INPUT_BYTES + 1`, close the handle, and do not decode or invoke JSON
parsing after overflow. The test double is not used as a substitute for the
three real CLI byte cases.

## Cleanup and limits

Cleanup is limited to the temporary Git worktree, artifact directory,
source-bound verification extraction, fixture/report directory, and child
workspace created by this run. The runner preserves a primary failure if
cleanup also fails and reports cleanup as a secondary result.

This validation does not establish a whole-process memory bound, a
path-replacement TOCTOU guarantee, coverage for every OS/Python/filesystem
combination, real-evidence validity, human rehearsal, package publication,
or deployment readiness. It does not run the full package regression, full
timeline matrix, Full E2E, audio E2E, database service, browser, API, LLM,
or cross-platform CI suites.
