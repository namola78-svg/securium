# Public search runtime parity

This DB-free runner checks the merged public search comparison helper against a
manually fixed golden vector set. It is intended to expose normalization,
projection, query-byte, and UTF-16 ID order-key behavior as runtime evidence
for a future stored-projection producer.

The runner imports the file
lib/services/public-course-search-comparison.ts; it does not copy the
implementation into the verification code. The oracle values in vectors.ts
are fixed independently of that helper. The vector set is
public-search-runtime-parity.v1.

Run from the repository root with an explicitly selected Node executable:

~~~
<node-executable> --import tsx verification/public-search-runtime-parity/run.ts
~~~

The runner writes JSON to stdout and diagnostics to stderr. To retain a local
result file without overwriting an existing file:

~~~
<node-executable> --import tsx verification/public-search-runtime-parity/run.ts --output verification/public-search-runtime-parity/runtime-result.json
~~~

An existing result can be compared with a second runtime using
--compare <json-file>. The comparison excludes runtime metadata but includes
the source commit, comparison-module blob, vector binding, contract oracle,
and all per-vector results.

## Vector coverage

- NFKC, trim, Korean-locale lowercase, ASCII/Korean, fullwidth and
  compatibility characters, composed/decomposed é, Unicode spaces, internal
  spacing, literal %, _, and backslash.
- Omitted and empty query, exact 48-byte and over-limit queries, normalization
  before the byte limit, UTF-8/UTF-16 length differences, and case expansion.
- The five stored projection fields in contract order, explicit field
  boundaries, empty middle fields, internal field spacing, query containment,
  and a stored value above the query byte limit.
- ASCII, Korean, BMP-boundary, valid non-BMP, prefix/length, NUL, empty,
  non-string, and malformed-surrogate IDs.
- Comparison, normalizer, ID-order-key, and query-limit version values.

The runner reports the source commit and blobs, vector blob and SHA-256,
runtime version/ICU/Unicode/V8/platform/architecture, locale support, each
vector's escaped value or error classification, oracle result, and totals.
Runtime metadata is kept separate from semantic output comparison.

## Runtime provenance and limits

The merged CI workflow uses Node 22.13.0; its setup-node log was inspected
from the exact merge-SHA Code CI run. This worktree has one executable local
runtime, Node 24.19.0, with ICU 78.3, Unicode 17.0, V8
13.6.233.17-node.51, and ko-KR locale support. No alternate local Node
runtime was installed or downloaded, so one-runtime golden validation does not
establish cross-runtime parity.

This verification does not prove all-Unicode equivalence, database collation
parity, PostgreSQL or D1 NUL storage support, runtime pinning, backfill
compatibility, provider parity, or writer integration. It does not modify
the product helper, adapter, schema, provider, cursor, package scripts, or
workflow registration.
