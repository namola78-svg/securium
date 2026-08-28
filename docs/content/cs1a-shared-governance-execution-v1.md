# CS1A Shared Governance Execution V1

This layer verifies a supplied `CS1A_HUMAN_DECISION_ARTIFACT_V1` without
creating governance state. It accepts an artifact and an exact expected
decision set, reconstructs the canonical projection, recomputes
`CS1A_HUMAN_DECISION_HASH_V1`, and returns an immutable verified execution
context only after server-side identity and role checks succeed.

## Trust boundary

```text
ARTIFACT_SUPPLIED
  -> RECOMPUTED / VERIFIED
  -> SERVER_AUTHENTICATED
  -> SERVER_AUTHORIZED
  -> VERIFIED EXECUTION CONTEXT
```

Artifact data establishes no actor, role, session, audit ID, receipt UUID, or
publication grant. Client actor, role, email, and audit fields are not accepted
by the execution input. The default identity resolver uses the existing server
authentication authority; application-user lookup is read-only and does not
provision users.

## Verification boundary

The generic policy rejects unsupported artifact versions, malformed artifacts,
hash mismatches, non-canonical projections, missing/extra/duplicate subjects,
scope/resource/revision substitution, decision or publication substitution,
and any V1 semantic mismatch. It preserves rights, currentness, source,
manifest, policy, authoring, and content-class facts from the verified
projection without re-evaluating policy.

The service then resolves the authenticated external identity, finds the
existing active application user, and authorizes one of the existing generic
roles: `CONTENT_REVIEWER`, `ADMIN`, or `SUPER_ADMIN`. No user, role, role
binding, audit event, receipt, content, or publication write occurs.

## Downstream boundary

The context is prepared by `verifyCs1aGovernanceExecution`. The generic
server-only `executeCs1aGovernanceAudit` service then requires an explicit
confirmation bound to the verified HumanDecisionHash, requires the audit
expectation from a server-owned resource/revision builder, performs an exact
duplicate precheck, calls the existing server-generated audit adapter, and
returns only after read-back validation has succeeded. The returned
`actorAuditLogId` is therefore server-generated and read-back validated. No
receipt or canonical persistence is reachable from this service.

The byte-preserved `tests/fixtures/cs1a-pia-first-clean-human-decision-v1.json`
is retained as a transferred first-clean V1 reference fixture only. It is not
production runtime input, canonical database state, publication authority,
audit evidence, or receipt evidence. The PIA compatibility test uses the same
generic artifact verifier, canonical serializer, and HumanDecisionHash
constructor as every other scope.
