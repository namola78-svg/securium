# CPPG atomic publication gate

`authorizeAndPublishCppgRegistration` is the dedicated server-side publication boundary. It accepts an exact registration semantic identity, the complete ordered content revision ID list, and a trusted actor. Catalog-manager role authorization and the canonical CPPG publication predicate are both required. The latter rebuilds and source-revalidates the server-owned projection, verifies the registration identity/snapshot, and replays the exact persisted Runtime Authority lifecycle. A current, active approval for the exact canonical subject is required; a caller supplied authority or legacy course flag is never accepted.

The service discovers and locks the registration's Runtime Authority root with `FOR UPDATE`, then reloads and locks the registration in that PostgreSQL transaction. This is the existing Runtime Authority root serialization primitive used by revocation and supersession. It holds that lock through authority replay, exact projection/revision validation, visibility writes, receipt append, success audit insert, and final readback. Concurrent revocation therefore waits until publication commits or rolls back.

The transaction changes only the projection IDs captured by the canonical registration:

- `courses.active` and `courses.published` become `1`.
- The canonical curriculum tree and nodes become `ACTIVE`.
- The canonical subjects and topics become active.
- The canonical learning units become active and published.
- The canonical contents become `PUBLISHED`.
- The canonical lessons become active and published.
- The canonical course lessons become `PUBLISHED`.
- The exact registered content revisions become `published` and `is_latest = 1`.
- One immutable `cppg_publication_receipts` row is appended and one `admin_audit_logs` success event is inserted.

Any write-count mismatch, receipt failure, audit failure, or final readback mismatch aborts the transaction. Exact receipt replay returns `ALREADY_PUBLISHED` after validating the registration and current authority snapshot. A conflicting receipt is rejected. Registration fields remain `REGISTERED_UNPUBLISHED` and `NOT_GRANTED`; receipts have no update/delete path.

## Visibility policy still open after publication

The current public catalog and lesson readers derive visibility from the course/content flags. They do not recheck Runtime Authority currentness or require a canonical receipt for every CPPG read. Therefore, after publication, a later authority revocation or supersession leaves the historical receipt immutable and the flags visible. A withdrawal/currentness policy is still required before relying on post-publication lifecycle changes to remove learner access. This work does not rewrite legacy seeds or make pre-existing `active`/`published` rows canonical receipts.

No production route invokes this service in this slice. Publication exercised by tests is confined to owned disposable PostgreSQL databases.
