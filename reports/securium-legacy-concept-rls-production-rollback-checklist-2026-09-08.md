# Production Rollback Checklist

Rollback is fail-safe and must not restore legacy Concept authority.

## Before deployment

- [ ] Confirm a tested application build containing the ontology-only resolver/search/state repair is available.
- [ ] Confirm migration 0041 file and ledger checksum match the artifact manifest.
- [ ] Confirm authorized pre-deployment readback and recovery/incident contacts.
- [ ] Confirm the production provider is Supabase/PostgreSQL; do not apply PostgreSQL RLS SQL to D1.

## Database migration failure before commit

- [ ] Stop the guarded migration runner.
- [ ] Confirm the migration transaction rolled back.
- [ ] Confirm no canonical or legacy rows changed.
- [ ] Confirm no partial `app_schema_migrations` receipt remains.
- [ ] Keep the incident open; do not retry blindly.

## Database state after a committed hardening migration

- [ ] Do not run a down migration that grants anon/authenticated access.
- [ ] Do not disable RLS.
- [ ] Keep the three tables server-only while application rollout is repaired.
- [ ] If correction is required, use a separately reviewed forward-only migration.
- [ ] Re-read grants, RLS, policies, and migration receipt before resuming rollout.

## Application rollout failure

- [ ] Keep database hardening active.
- [ ] Stop or pause the rollout and traffic switch.
- [ ] Do not deploy the pre-repair application, because it reads legacy tables as canonical authority.
- [ ] Roll forward to a known build that uses `ontology_concepts` / `ontology_aliases`, or keep service unavailable until that build is ready.
- [ ] Re-run canonical resolver/search/state smoke checks before resuming traffic.

## Post-rollback verification

- [ ] Anon/authenticated direct legacy access remains denied.
- [ ] service_role/migration access remains available where required.
- [ ] Canonical resolver/search/state still excludes legacy tables.
- [ ] Canonical dataset and legacy rows are unchanged.
- [ ] Existing monitoring shows no unsafe legacy access or canonical resolver fallback.
- [ ] Record the final deployment version and readback evidence.
