# Forensics timeline input-limit review

This review is anchored to main commit
`b1d767edb6cd017842059493f990406a133c422c`, fetched on 2026-09-14. PR #188's
merge commit `2c54a49dbef5919889514a05ac504d3ea3c48ef4` is an ancestor of that
review commit, so the fractional timestamp repair is included. The review does
not reopen or re-run PR #188 verification.

The implementation reviewed is
`examples/digital-forensics-timeline-local-lab/timeline_lab.py`. The new
boundary tests import and call that module through the repository's existing
`sys.path.insert(0, lab_directory)` test convention. No parser, existing test,
strict runner, package, workflow, or dependency file is changed.

## Environment

- OS: Windows 11 `10.0.26200` (`Windows-11-10.0.26200-SP0`)
- Shell: PowerShell `5.1.26100.9444`
- Python: `3.14.5` 64-bit
- `csv.field_size_limit()`: `131072` bytes
- `sys.getrecursionlimit()`: `1000`
- Review commit: `b1d767edb6cd017842059493f990406a133c422c`

## Contract and processing boundary

| Item | Product evidence | Boundary location | Review result |
| --- | --- | --- | --- |
| Raw input bytes | `MAX_INPUT_BYTES = 1024 * 1024` | `_read_input` calls `Path.read_bytes()`, then checks byte length before suffix validation, decoding, or JSON/CSV parsing | Exact 1 MiB accepted; 1 byte over rejected |
| JSON records | `MAX_RECORDS = 100` | `json.loads()` creates the root, then `_normalize_records()` checks the list length | 100 accepted; 101 rejected |
| CSV records | Same `MAX_RECORDS = 100` | `csv.DictReader` is fully materialized with `rows = list(reader)`, then converted to a root and normalized | 100 accepted; 101 rejected |
| Identifier/text fields | `MAX_FIELD_CHARS = 512` | `_validate_identifier()` and `_validate_text()` during record normalization | `event_type` 512 accepted; 513 rejected for JSON and CSV |
| `notes` | `MAX_NOTES_CHARS = 2_000` | Notes length is checked during record normalization | 2,000 accepted; the existing lab regression covers 2,001 rejection |
| JSON nesting depth | No product-specific constant or check found | Delegated to `json.loads()` and the Python runtime | Deep recursion boundary NOT_RUN; no unlimited-processing claim |
| Report size | No product-specific maximum found | Report is built in memory, canonical result is hashed, then `json.dumps()` and exclusive output create are used | A 100-record report was created; no maximum inferred |
| Execution time | No timeout in `timeline_lab.py` or `cli.py` | This test's CLI subprocess uses a 30-second test budget; the offline package runner's 120-second timeout is external | Product timeout NOT_FOUND; package runner NOT_RUN |

The input-size check is therefore a pre-parse file boundary. JSON is read as a
complete UTF-8 byte string and parsed as one complete object. CSV is also read
as a complete byte string, decoded into `StringIO`, and then all rows are
retained in a list before common record validation. Normalized records are
retained, sorted, reused for facts/conflicts, and serialized into the report;
streaming CSV tokenization does not make the overall operation streaming or
constant-memory.

The Python CSV module's observed 131,072-byte field limit is a standard-library
limit, not a Securium contract. The product's 512-character ordinary-field and
2,000-character notes limits are lower. The standard-library limit was recorded
but its own failure boundary was not exercised.

`analyze_file()` performs path validation, complete input read, parsing, and
analysis, returning a report object. The CLI first checks distinct input/output
paths, calls `analyze_file()`, and only then calls `write_report()`. Therefore a
size rejection occurs before report creation. `analyze_fixture()` accepts a
root and caller-supplied hash directly; it is not a substitute for file-size or
raw-byte validation and was not used to claim those boundaries.

## Executed boundary tests

Command:

```powershell
python tests/forensics-timeline-input-limits.test.py
```

The test file discovered and executed 4 tests, all passed:

- JSON record count: 100 accepted, 101 rejected, with raw bytes/hash preserved;
  the accepted 100-record report was written successfully.
- CSV record count: 100 accepted, 101 rejected, with raw bytes/hash preserved.
- JSON and CSV ordinary field length: 512 accepted, 513 rejected; notes at
  exactly 2,000 characters accepted.
- JSON input size: exactly 1,048,576 bytes accepted; 1,048,577 bytes rejected
  through the CLI within the 30-second subprocess budget.

The over-limit CLI case returned exit code 2, emitted the existing input-limit
error, left no partial report, preserved the rejected input bytes, and preserved
an external sentinel. The test fixture sizes stay below the 1 MiB per-fixture,
1,000-record, and 8 MiB simultaneous-input review budget. No fuzzing, stress
run, deep-recursion input, memory exhaustion, or disk exhaustion was attempted.

Existing malformed-input, overwrite, symlink, JSON/CSV parity, and report-write
failure regressions remain in the existing lab test file and were not duplicated
here.

## Not run and follow-up

The following remain outside this review: product parser changes, a selected
JSON recursion limit, a standard-library CSV failure boundary, a report-size
maximum, large-scale load testing, the full timeline/package suites, package
rebuilds, cross-platform CI, database/browser/runtime execution, and real
evidence handling.

No additional product change is required by the observed boundaries. If a
future product limit is proposed for JSON depth, report size, or execution time,
it should be selected from fixture-size requirements, deployment/runtime
resources, compatibility evidence, and an explicit error/cleanup contract; this
review does not choose those values.
