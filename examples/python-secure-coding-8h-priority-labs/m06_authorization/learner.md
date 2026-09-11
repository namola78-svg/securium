# M06 Lab: Authentication, Authorization, and BOLA/IDOR

Existing authority: `P06` · objectives `O21–O24` · questions `Q29–Q32`.

## Goal

Prove that authentication, object authorization, and session lifecycle are
different controls. Build a subject–object–action decision matrix, deny
cross-user object substitution, preserve an explicit same-tenant admin rule,
and rotate the session identifier after login.

## Requirement and fixed AI prompt

An authenticated principal may read or update only objects allowed by a
server-side policy. Owners may read/update their own document; same-tenant
members may read; same-tenant admins may read/update; other tenants, unknown
actions, and unauthenticated requests are denied by default. Login must rotate
the pre-authentication session ID.

> Implement a standard-library-only repair for this local in-memory API. Keep
> the principal source server-owned, evaluate subject + object + action + tenant
> policy before the sink, use default deny, and rotate the session identifier
> on login. Add owner, member, unrelated, admin, other-tenant, unauthenticated,
> IDOR, and session-fixation tests. Do not treat a client role, URL ID, or AI
> response as authorization evidence.

## Learner task

1. Fill a matrix for owner, same-tenant member, unrelated user, admin, other
   tenant, and unauthenticated caller.
2. Run the vulnerable test and explain why the authenticated bob can retrieve
   Alice's object.
3. Compare the secure decision point with the object lookup.
4. Verify the pre-login session identifier is not accepted as the post-login
   credential.
5. Explain the explicit admin exception and why it is not automatically an
   IDOR finding.

## Run and reset

From the lab bundle directory, run:

```powershell
python -m unittest m06_authorization.test_m06 -v
```

Expected result: `Ran 5 tests ... OK`. Sessions and documents are in-memory
fixtures, so no reset command is required.

## Expected evidence

The vulnerable path returns Alice's document to Bob and reuses the known
session ID. The secure path preserves owner/admin allowed behavior, denies
cross-owner and cross-tenant access, defaults unknown actions to deny, and
rotates the session identifier.
