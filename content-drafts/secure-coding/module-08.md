# Module 08 — Session / Cookie Security

Time: 30 minutes

## Concept → Role → Skill → Tool/Technology

Session integrity and lifecycle → web developer → rotate, expire, revoke, and constrain session state → Servlet session APIs, cookie attributes, CSRF protections. Related certification: web security domain (conceptual only).

## Lesson

Use unpredictable server-managed session identifiers. Rotate the identifier after login or privilege change, expire idle and absolute sessions, revoke on logout, and avoid putting authorization decisions solely in client-modifiable state. Cookies carrying session identifiers normally need `Secure`, `HttpOnly`, and an intentional `SameSite` policy. CSRF defenses remain relevant when browsers attach credentials automatically.

## Exercise

Review a login flow that keeps the pre-login session identifier and sets no cookie attributes. List the lifecycle changes and tests needed.

## Instructor notes

Separate session theft, fixation, CSRF, and authorization failures; they have related but distinct controls.

## Learner takeaway

Session security is lifecycle security plus transport and browser constraints.
