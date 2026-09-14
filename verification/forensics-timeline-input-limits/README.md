# Forensics timeline input-limit review

This review is anchored to main commit
`b1d767edb6cd017842059493f990406a133c422c`, fetched on 2026-09-14. PR #188's
merge commit `2c54a49dbef5919889514a05ac504d3ea3c48ef4` is an ancestor of that
review commit, so the fractional timestamp repair is included. The review does
not reopen or re-run PR #188 verification.

The implementation repaired is
`examples/digital-forensics-timeline-local-lab/timeline_lab.py`. The boundary
tests import and call that module through the repository's existing
`sys.path.insert(0, lab_directory)` test convention. No parser design, strict
runner, package builder, workflow, dependency, or schema file is changed.

## Environment

- OS: Windows 11 `10.0.26200` (`Windows-11-10.0.26200-SP0`)
- Shell: PowerShell `5.1.26100.9444`
- Python: `3.14.5` 64-bit
- `csv.field_size_limit()`: `131072` (parser field-size value; unit below)
- `sys.getrecursionlimit()`: `1000`
- Review commit: `b1d767edb6cd017842059493f990406a133c422c`

## Contract and processing boundary

| Item | Product evidence | Boundary location | Review result |
| --- | --- | --- | --- |
| Raw input bytes | `MAX_INPUT_BYTES = 1024 * 1024` | `_read_input` opens a binary stream and reads `MAX_INPUT_BYTES + 1`; the existing length check then runs before suffix validation, decoding, or JSON/CSV parsing | Exact 1 MiB accepted; 1 byte over rejected |
| JSON records | `MAX_RECORDS = 100` | `json.loads()` creates the root, then `_normalize_records()` checks the list length | 100 accepted; 101 rejected |
| CSV records | Same `MAX_RECORDS = 100` | `csv.DictReader` is fully materialized with `rows = list(reader)`, then converted to a root and normalized | 100 accepted; 101 rejected |
| Identifier/text fields | `MAX_FIELD_CHARS = 512` | `_validate_identifier()` and `_validate_text()` during record normalization | `event_type` 512 accepted; 513 rejected for JSON and CSV |
| `notes` | `MAX_NOTES_CHARS = 2_000` | Notes length is checked during record normalization | 2,000 accepted; the existing lab regression covers 2,001 rejection |
| JSON nesting depth | No product-specific constant or check found | Delegated to `json.loads()` and the Python runtime | Deep recursion boundary NOT_RUN; no unlimited-processing claim |
| Report size | No product-specific maximum found | Report is built in memory, canonical result is hashed, then `json.dumps()` and exclusive output create are used | A 100-record report was created; no maximum inferred |
| Execution time | No timeout in `timeline_lab.py` or `cli.py` | This test's CLI subprocess uses a 30-second test budget; the offline package runner's 120-second timeout is external | Product timeout NOT_FOUND; package runner NOT_RUN |

Before this repair, `_read_input()` used `Path.read_bytes()` and checked the
length only after the complete file had been read. It now preserves the same
`MAX_INPUT_BYTES` value and uses a binary stream read limited to
`MAX_INPUT_BYTES + 1` bytes. Exactly 1 MiB remains accepted; observing the
extra byte produces the existing `input exceeds the 1048576-byte limit` error
before decode or parse. The `with` context closes the stream on success, size
rejection, and read error. A file-size `stat()` check was not substituted for
the read limit.

The existing input path validation, including symlink/reparse checks, still
runs first. This repair does not establish a path-replacement TOCTOU or
concurrent-file-change snapshot guarantee. It also does not claim a whole-
process memory bound. JSON is still decoded and parsed as one complete input;
CSV is still decoded into `StringIO`, parsed with `csv.DictReader`, and fully
materialized with `rows = list(reader)`. Normalized records are retained,
sorted, reused for facts/conflicts, and serialized into the report.

For accepted input, the bytes returned by the bounded read are the complete
raw input and are hashed exactly as before. An over-limit input is rejected
after only its `MAX_INPUT_BYTES + 1` prefix is read; the product does not use
that prefix as the file's full-input hash. The tests hash the original
over-limit file before and after the CLI rejection as preservation evidence.

The product's record and field limits are unchanged: `MAX_RECORDS = 100`,
`MAX_FIELD_CHARS = 512`, and `MAX_NOTES_CHARS = 2_000`. The pure
`analyze_fixture()` path accepts a caller-built root and caller-supplied hash;
it is not a file-read or raw-byte-size validation path.

### CSV field-size unit

Python 3.14's [official `csv.field_size_limit()` documentation](https://docs.python.org/3.14/library/csv.html#csv.field_size_limit)
defines the value as the maximum field size allowed by the parser, without
specifying raw-file bytes. The matching [CPython 3.14 `_csv.c` implementation](https://github.com/python/cpython/blob/3.14/Modules/_csv.c#L3411-L3435)
stores the field buffer as `Py_UCS4` values and increments `field_len` once per
decoded character. In the observed CPython 3.14.5 runtime, the default
`csv.field_size_limit()` is `131072`; a local probe accepted a field of
131,072 `é` characters (262,144 UTF-8 bytes) and rejected 131,073 characters.
Therefore `131072` is documented here as a decoded parser-character limit for
this CPython implementation, not as a raw file-byte limit and not as a
Securium contract. The product's raw input limit remains `MAX_INPUT_BYTES` in
bytes, and its lower product field limits remain authoritative.

## Executed boundary tests

Command:

```powershell
python tests/forensics-timeline-input-limits.test.py
```

The test file discovered and executed 5 tests, all passed:

- JSON record count: 100 accepted, 101 rejected, with raw bytes/hash preserved;
  the accepted 100-record report was written successfully.
- CSV record count: 100 accepted, 101 rejected, with raw bytes/hash preserved.
- JSON and CSV ordinary field length: 512 accepted, 513 rejected; notes at
  exactly 2,000 characters accepted.
- JSON input size: exactly 1,048,576 bytes accepted; 1,048,577 bytes rejected
  through the CLI within the 30-second subprocess budget.
- An instrumented binary stream used through the real `analyze_file()` verified
  bounded read requests, no more than `MAX_INPUT_BYTES + 1` consumed bytes,
  close on success/overflow/read error, and no decode/JSON/CSV parser call on
  overflow.

The over-limit CLI case returned exit code 2, emitted the existing input-limit
error, left no partial report, preserved the rejected input bytes, and preserved
an external sentinel. The boundary fixture allowance is at most 1,048,577 bytes
per fixture, with the simultaneous-input total kept below 8 MiB. No fuzzing,
stress run, deep-recursion input, memory exhaustion, or disk exhaustion was
attempted.

The prior 4-test run's 1,048,577-byte overflow fixture exceeded its then-stated
1 MiB per-fixture test budget by one byte. That historical execution condition
is recorded here; the previous report is intentionally not rewritten. This
repair's boundary test explicitly permits up to 1,048,577 bytes per fixture,
with at most 8 MiB of simultaneous input and a 30-second CLI subprocess limit.

The existing malformed-input, overwrite, symlink, JSON/CSV parity, timestamp
ordering, and report-write failure regressions remain in the existing lab test
file and were exercised by the strict runner below.

## Local validation

```powershell
python -m py_compile `
  examples/digital-forensics-timeline-local-lab/timeline_lab.py `
  examples/digital-forensics-timeline-local-lab/cli.py `
  tests/forensics-timeline-input-limits.test.py

python run_tests.py
```

The focused suite reported 5 discovered, 5 executed, 5 passed, 0 failed,
0 errors, and 0 skipped. The existing strict lab runner reported 16 discovered,
16 executed, 16 passed, 0 failed, 0 errors, and 0 skipped. `git diff --check`
also passed. The package-wide suite, ZIP regeneration, and cross-platform CI
were not run; package integration is follow-up scope because the package source
surface includes this changed product file.

## Not run and follow-up

The following remain outside this repair: product parser redesign, a selected
JSON recursion limit, a standard-library CSV failure boundary beyond the unit
probe above, a report-size maximum, large-scale load testing, the full
timeline/package suites, package rebuilds, cross-platform CI, database/browser/
runtime execution, and real evidence handling. No large file, sparse file,
fuzzing, memory-exhaustion, or deep-recursion input was created.

No additional product change is required by the observed boundaries. If a
future product limit is proposed for JSON depth, report size, or execution time,
it should be selected from fixture-size requirements, deployment/runtime
resources, compatibility evidence, and an explicit error/cleanup contract; this
review does not choose those values.
