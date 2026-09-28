# CPPG publication receipt schema

Migration `0055_cppg_publication_receipts` adds an append-only PostgreSQL receipt table. It does not insert receipts, update course visibility, or change `cppg_runtime_registrations`. The registration remains `REGISTERED_UNPUBLISHED` with `publication_authority = NOT_GRANTED`.

## Identity and snapshot

One receipt is allowed per `registration_semantic_identity`. The receipt copies the course, package key, runtime revision, exact content revision ID array, source manifest and package hash, Foundation ID and hash, approval subject hash, and authority ID and sequence. A composite foreign key requires every copied value to match the immutable registration row. That prevents a receipt from silently drifting when any source, revision, Foundation, or authority binding differs.

`publication_semantic_identity` is SHA-256 over the repository canonical JSON encoding of:

```json
{"contractVersion":"CPPG_PUBLICATION_RECEIPT_V1","registrationSemanticIdentity":"<registration identity>"}
```

The `registration_semantic_identity` uniqueness constraint gives each approved registration one publication outcome; the unique publication semantic identity makes its logical receipt identity addressable and deterministic. A later service can treat an insert conflict as a replay only after reading the existing receipt and confirming the complete snapshot. A different snapshot cannot satisfy the composite foreign key and cannot create a second receipt for that registration.

## State and lifecycle policy

Only `PUBLISHED` is stored. No receipt means `NOT_PUBLISHED`. The receipt is immutable; updates and deletes are ignored. Registration state is not advanced by publication.

Revocation and supersession of a Runtime Authority currently affect authority currentness, but repository policy does not define whether an already published course should immediately disappear from public visibility. The receipt therefore stays historical and this schema does not make that visibility decision. A future withdrawal policy should use a separate append-only withdrawal record/state so the publication receipt remains historical. A successor authority likewise does not implicitly supersede an existing receipt; which receipt is visible after successor approval remains an explicit policy decision.

Legacy `courses.active` / `courses.published` flags are not referenced by this table and do not establish canonical publication. Readers must require the canonical receipt for CPPG publication. This migration performs no legacy seed rewrite and creates no receipt rows.

Publication remains unauthorized. This schema is groundwork only; the next implementation slice is `CPPG_ATOMIC_PUBLICATION_GATE_SERVICE_REQUIRED` after post-merge CI closure and an explicit publication authorization policy.
