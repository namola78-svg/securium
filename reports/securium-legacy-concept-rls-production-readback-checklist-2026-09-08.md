# Production Readback Checklist

Use after the bounded artifacts are merged and deployed. This checklist is read-only unless a separate production test authorization explicitly permits a transaction-wrapped probe.

## Access and identity

- [ ] Authorized production connection is available through the repository/deployment mechanism.
- [ ] Provider is confirmed as Supabase/PostgreSQL before applying migration 0041.
- [ ] Record database, schema, user, search path, deployment version, and migration runner identity.
- [ ] Confirm no service-role key is exposed to browser/client runtime.

## Migration and RLS

- [ ] `app_schema_migrations` contains `0041_legacy_concept_rls_hardening` with checksum `legacy-concept-rls-hardening-v1`.
- [ ] `concepts`, `concept_versions`, `concept_labels` exist in the intended schema.
- [ ] RLS is enabled on all three tables.
- [ ] FORCE RLS matches the approved decision (`false`; no blind enablement).
- [ ] `pg_policies` contains no permissive policy for the three server-only tables.
- [ ] `anon` and `authenticated` have no SELECT/INSERT/UPDATE/DELETE privilege.
- [ ] `service_role` retains the required server privilege.
- [ ] Migration/session guard readback passed.

## Canonical and legacy data freeze

- [ ] Read-only counts and approved identity for `ontology_concepts`, `ontology_aliases`, and `ontology_edges` match the release baseline.
- [ ] No canonical Concept, alias, or edge was added, deleted, or rewritten by this deployment.
- [ ] No legacy row was deleted, rewritten, or promoted.
- [ ] No Skill, Relation, Evidence, CE, Mastery, or learner-state mutation occurred.

## Client/API boundary

- [ ] Supported PostgREST GET as anon returns denied/empty according to the configured API contract for each legacy table.
- [ ] Supported PostgREST GET as authenticated returns denied/empty according to the configured API contract for each legacy table.
- [ ] Anon/authenticated INSERT, UPDATE, and DELETE remain denied by effective privilege/RLS state; do not create production rows.
- [ ] No unsafe RPC or API route writes a legacy Concept table.
- [ ] No relevant SECURITY DEFINER function restores client access.

## Runtime shadow-authority boundary

- [ ] Deployed application version matches the ontology-only runtime repair artifact.
- [ ] Existing approved canonical ID resolves through `ontology_concepts`.
- [ ] Existing approved canonical key resolves through `ontology_concepts`.
- [ ] Existing approved registered alias resolves through `ontology_aliases`.
- [ ] Existing unknown/label-only input fails closed.
- [ ] Canonical search returns only canonical ontology results.
- [ ] Canonical Concept state comes from canonical ontology state.
- [ ] No canonical miss silently falls back to legacy tables.
- [ ] No legacy-only synthetic row is inserted into production.

## Smoke and monitoring

- [ ] Public health endpoint returns healthy status.
- [ ] Relevant learning route(s) render without runtime/database error.
- [ ] Anonymous and authenticated session boundaries behave as expected.
- [ ] Request IDs, deployment version, and error rates are recorded through existing observability.
- [ ] Review database/API logs for unexpected anon/authenticated access or resolver failures.
- [ ] Review unexpected `42501` denial spikes separately from expected direct-denial probes.

## Exit criteria

- [ ] Production RLS finding: `CLOSED`.
- [ ] Production runtime shadow-authority finding: `CLOSED`.
- [ ] Production canonical authority count: `1`.
- [ ] Production legacy authority count: `0`.
- [ ] Production canonical-facing legacy reads: `0`.
- [ ] No production data mutation outside the exact migration grant/RLS scope.
