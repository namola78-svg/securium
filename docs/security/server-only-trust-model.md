# SEC-001 server-only trust model

## Current architecture

The canonical database is accessed by the application server and its governed
repositories. Canonical writes are therefore server-side operations; a browser
or other client must use an authenticated application endpoint and may not
mutate canonical tables through a direct database or Data API path.

The current PostgreSQL architecture intentionally constrains browser/client
database privileges. The server-only lockdown migrations revoke table
privileges from `PUBLIC`, `anon`, and `authenticated`, enable or force RLS on
the governed tables, and keep future PostgreSQL-owned objects closed by
default. This is a privilege and trust-boundary control, not a claim that the
database has per-user RLS predicates for every row.

Application and domain guards remain part of authorization enforcement. API
handlers authenticate with `requireApiUser`, and repositories/services enforce
user ownership, enrollment, course scope, and content binding before reading
or mutating user- or course-scoped data. These guards are a required part of
the server-only trust model.

The system does not currently claim that per-user RLS is the primary
authorization boundary. In particular, this document must not be read as a
claim that “RLS protects every user row.” RLS is enabled/forced where the
governance migrations require it, while application ownership and domain
guards provide the user-context authorization checks.

## Credential and client boundary

Direct browser/client mutation of canonical database tables is prohibited.
Server-only database credentials and service authority must remain in the
server/runtime environment and must never be exposed to clients or client
bundles. Client-facing configuration may contain only the deliberately
public/anonymous client material supported by the current architecture; it
must not contain a service-role credential or a canonical database credential.

This model is fail-closed at the governed boundaries: direct client/Data API
access is denied by database privileges, unauthenticated API mutation is
denied by application guards, and cross-user or cross-content operations are
denied by ownership and scope checks. The retained SEC-001 test is executable
proof of these assumptions; this is not documentation-only assurance.

## OPTION_A scope and future decisions

SEC-001 OPTION_A records and tests the existing server-only trust model. It
does not redesign authentication, authorization, runtime behavior, database
grants, RLS policies, schema, migrations, providers, or application services.

Future adoption of per-user RLS, if ever authorized, is a separate architecture
decision. It must be reviewed and implemented as its own bounded change and
must not be implied by this remediation. If any documented assumption stops
matching the migrations, server credential boundary, application guards, or
repository behavior, the retained security test must fail and the architecture
must be re-reviewed.
