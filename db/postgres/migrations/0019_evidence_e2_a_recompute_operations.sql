-- E2-A lifecycle foundation only. No Evidence rows are materialized.
BEGIN;

ALTER TABLE public."evidence_projections"
  ADD COLUMN "generation_id" text;

ALTER TABLE public."evidence_recompute_requests"
  ADD COLUMN "generation_id" text,
  ADD COLUMN "claimed_by" text,
  ADD COLUMN "claim_token" text,
  ADD COLUMN "lease_expires_at" text,
  ADD COLUMN "next_attempt_at" text,
  ADD COLUMN "checkpoint" text,
  ADD COLUMN "error_class" text,
  ADD COLUMN "cancelled_at" text,
  ADD COLUMN "superseded_by_id" text;

ALTER TABLE public."evidence_recompute_requests"
  DROP CONSTRAINT "evidence_recompute_requests_status_check";
ALTER TABLE public."evidence_recompute_requests"
  ADD CONSTRAINT "evidence_recompute_requests_status_check"
  CHECK ("status" IN ('PENDING', 'PROCESSING', 'RETRYABLE', 'COMPLETED', 'FAILED', 'CANCELLED', 'SUPERSEDED'));

CREATE INDEX "evidence_projections_generation_idx"
  ON public."evidence_projections" ("generation_id", "lifecycle");
CREATE INDEX "evidence_recompute_requests_claim_idx"
  ON public."evidence_recompute_requests" ("status", "next_attempt_at", "lease_expires_at", "created_at");
CREATE INDEX "evidence_recompute_requests_generation_idx"
  ON public."evidence_recompute_requests" ("generation_id", "status");

CREATE TABLE public."evidence_rebuild_generations" (
  "id" text PRIMARY KEY,
  "scope_key" text NOT NULL DEFAULT 'EVIDENCE_V1',
  "projection_version" text NOT NULL,
  "mapping_snapshot_hash" text NOT NULL,
  "source_cutoff" text,
  "status" text NOT NULL DEFAULT 'PENDING',
  "checkpoint" text,
  "active" integer NOT NULL DEFAULT 0,
  "started_at" text,
  "completed_at" text,
  "failure_class" text,
  "superseded_by_id" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_rebuild_generations_status_check" CHECK ("status" IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SUPERSEDED')),
  CONSTRAINT "evidence_rebuild_generations_active_check" CHECK ("active" IN (0, 1))
);

CREATE UNIQUE INDEX "evidence_rebuild_generations_active_unique"
  ON public."evidence_rebuild_generations" ("scope_key") WHERE "active" = 1;
CREATE INDEX "evidence_rebuild_generations_status_idx"
  ON public."evidence_rebuild_generations" ("status", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."evidence_rebuild_generations" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."evidence_rebuild_generations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."evidence_rebuild_generations" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0019_evidence_e2_a_recompute_operations', 'pending-sha256')
ON CONFLICT (id) DO NOTHING;

COMMIT;

