# Module 07 — Authentication / Authorization

Time: 35 minutes

## Concept → Role → Skill → Tool/Technology

Identity and access decisions → service developer → authenticate, authorize, and audit each protected operation → session middleware, OAuth/OIDC libraries, server-side policy checks. Related certification: identity and access management domain (conceptual only).

## Lesson

Authentication establishes who is acting; authorization decides what that identity may do to this object in this context. Check authorization on the server for every read, write, and state transition. Never trust a client-provided role, hidden field, or object identifier without an ownership or policy check.

```java
Account actor = requireAuthenticatedAccount(request);
Document doc = documents.find(id).orElseThrow(notFound());
if (!policy.canEdit(actor, doc)) throw forbidden();
```

The lookup and policy check are separate. A not-found response can reduce enumeration, but it must not replace authorization. Explicitly test for BOLA/IDOR: an authenticated user must not be able to substitute another object identifier and pass the operation. Default deny when no policy rule grants the action.

## Exercise

Build an authorization matrix for owner, member, unrelated user, administrator, and missing user on a document update endpoint.

## Instructor notes

Discuss confused-deputy risk: a trusted service can still be tricked into using its authority for the wrong caller.

## Learner takeaway

Every protected operation needs a server-side subject, object, action, and policy decision.
