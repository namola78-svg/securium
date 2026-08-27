# CS1A HumanDecisionHash V1 Contract

## Purpose

`CS1A_HUMAN_DECISION_HASH_V1` is a pure, domain-neutral identity for one
exact non-empty governed Human Governance Decision set. It is created before
authenticated reconfirmation and is independent of actors, sessions, audit
IDs, receipts, timestamps, Git, and filesystem metadata.

## Projection

The hashed projection is:

```json
{
  "contractVersion": "CS1A_HUMAN_DECISION_HASH_V1",
  "subjects": [{
    "governanceScope": "...",
    "resourceType": "...",
    "resourceId": "...",
    "resourceRevisionId": "...",
    "contentHash": "...",
    "revisionHash": "...",
    "policyVersion": "CS1A_POLICY_V1",
    "decision": "...",
    "reasonCode": "...",
    "rightsDisposition": "...",
    "currentnessDisposition": "...",
    "authoringOrigin": "...",
    "contentClass": "...",
    "sourceOrigin": "...",
    "publicationAuthority": "..."
  }]
}
```

`sourceAuthority`, `sourceManifestRef`, `sourceSetHash`,
`parentRevisionId`, and `immutableProvenanceIdentity` are included when
provided by the applicable generic source/revision contract. Source fields
are required or rejected according to `sourceOrigin`; no domain name is
special-cased.

Subjects are ordered lexically by `governanceScope`, `resourceType`,
`resourceId`, and `resourceRevisionId`. Empty sets, duplicates, ambiguous
scope, missing fields, invalid hashes, unsupported vocabulary, and
unsupported versions fail closed.

## Serialization and hash

Objects use recursive lexical key ordering. Arrays are ordered by the
projection builder. Strings are preserved as raw Unicode code points and
encoded as UTF-8; no NFC normalization is applied. `null` is explicit,
undefined/missing semantic fields are not silently accepted, and numbers must
be finite. SHA-256 is emitted as 64 lowercase hexadecimal characters.

## Artifact and replay

The replayable artifact envelope is `CS1A_HUMAN_DECISION_ARTIFACT_V1` and
contains the complete projection, its HumanDecisionHash, and subject count.
`generatedAt` and `legacyDecisionRef` may be present as non-hashed metadata.
The projection must be available before authenticated reconfirmation.

## Separation

HumanDecisionHash excludes actor identity, actor role, session, audit IDs,
actorAuditLogId, receipt UUID, timestamps, and legacy lineage references.
The generic actor/audit and receipt contracts consume the resulting hash later;
they are not changed by this contract.

Legacy ISE and ISIE hashes remain historical evidence. They are never silently
promoted to V1. Explicit revalidation creates a new V1 projection and hash.
