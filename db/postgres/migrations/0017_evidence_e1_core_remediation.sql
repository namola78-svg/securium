-- Bounded Evidence E1 correctness remediation. Production deployment requires separate authorization.
BEGIN;

-- Evidence materialization has not been authorized. Fail closed rather than
-- guessing a Practical evaluation lineage for any unexpected historical row.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."evidence_projections" LIMIT 1) THEN
    RAISE EXCEPTION 'EVIDENCE_E1_EXISTING_PROJECTIONS_REQUIRE_EXPLICIT_REVIEW';
  END IF;
END
$$;

ALTER TABLE public."evidence_projections"
  ADD COLUMN "source_lineage_identity" text NOT NULL;

CREATE UNIQUE INDEX "evidence_projections_active_lineage_unique"
ON public."evidence_projections" (
  "user_id",
  "source_type",
  "source_lineage_identity",
  "evidence_type",
  "concept_id",
  "projection_version"
)
WHERE "lifecycle" = 'ACTIVE';

CREATE INDEX "evidence_projections_lineage_idx"
ON public."evidence_projections" (
  "user_id",
  "source_type",
  "source_lineage_identity",
  "lifecycle"
);

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0017_evidence_e1_core_remediation', 'pending-sha256')
ON CONFLICT (id) DO NOTHING;

COMMIT;
