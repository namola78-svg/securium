# M06 Instructor Guide

## Demonstration order

1. Start with `GET /object-id` as a data-flow thought experiment: login is
   authentication, the object lookup is not permission.
2. Run the vulnerable Bob/Alice assertion. Do not call a returned object proof
   of authorization.
3. Draw subject, object, action, tenant, and policy before showing
   `_allows`. Emphasize default deny for unknown actions.
4. Show the same-tenant admin test. It is a false positive only because an
   explicit server-owned rule grants the cross-owner action.
5. Demonstrate session fixation: the pre-auth ID is known, so reusing it after
   login is the vulnerable behavior; rotation and revocation are separate from
   object authorization.

## Common wrong answers

- “The user is logged in, so the object is allowed.”
- “An integer/opaque object ID is authorization.”
- “Hide the button in the client.”
- “Admin can access everything, even across tenant boundaries.”
- “HttpOnly is an authorization check.”

## Check questions

- Where is the server-owned permission decision made?
- Which test proves a real BOLA boundary rather than only a successful owner
  case?
- Why does an explicit admin rule need tenant scope in this fixture?
- What does session rotation protect, and what does it not replace?
