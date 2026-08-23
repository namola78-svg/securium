-- Additive, rebuildable Evidence projection foundation. Production application requires separate authorization.
BEGIN;

CREATE TABLE public."evidence_projections" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "source_type" text NOT NULL,
  "source_event_id" text NOT NULL,
  "source_revision_identity" text NOT NULL,
  "evidence_type" text NOT NULL,
  "concept_id" text NOT NULL REFERENCES public."ontology_concepts" ("id") ON DELETE RESTRICT,
  "concept_mapping_set_hash" text NOT NULL,
  "projection_version" text NOT NULL,
  "source_semantic_hash" text NOT NULL,
  "semantic_hash" text NOT NULL,
  "result_summary_json" text NOT NULL DEFAULT '{}',
  "quality" text NOT NULL,
  "lifecycle" text NOT NULL DEFAULT 'ACTIVE',
  "superseded_by_id" text REFERENCES public."evidence_projections" ("id") ON DELETE RESTRICT,
  "invalidation_reason" text,
  "occurred_at" text NOT NULL,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_projections_source_check" CHECK ("source_type" IN ('QUESTION_ATTEMPT', 'MOCK_ATTEMPT', 'MOCK_ITEM_RESULT', 'PRACTICAL_EVALUATION', 'LESSON_PROGRESS', 'COURSE_LESSON_PROGRESS', 'LECTURE_PROGRESS', 'AUDIO_PROGRESS')),
  CONSTRAINT "evidence_projections_type_check" CHECK ("evidence_type" IN ('PERFORMANCE_RESULT', 'PRACTICAL_PERFORMANCE', 'LEARNING_ACTIVITY')),
  CONSTRAINT "evidence_projections_lifecycle_check" CHECK ("lifecycle" IN ('ACTIVE', 'SUPERSEDED', 'INVALIDATED')),
  CONSTRAINT "evidence_projections_quality_check" CHECK ("quality" IN ('DIRECT_PERFORMANCE', 'HUMAN_EVALUATED', 'SUPPORTING_ACTIVITY')),
  CONSTRAINT "evidence_projections_hashes_check" CHECK ("concept_mapping_set_hash" ~ '^[0-9a-f]{64}$' AND "source_semantic_hash" ~ '^[0-9a-f]{64}$' AND "semantic_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "evidence_projections_payload_length_check" CHECK (length("result_summary_json") <= 4000)
);
CREATE INDEX "evidence_projections_source_idx" ON public."evidence_projections" ("source_type", "source_event_id", "lifecycle");
CREATE INDEX "evidence_projections_user_idx" ON public."evidence_projections" ("user_id", "lifecycle", "occurred_at");
CREATE INDEX "evidence_projections_concept_idx" ON public."evidence_projections" ("concept_id", "lifecycle", "occurred_at");

CREATE TABLE public."evidence_recompute_requests" (
  "id" text PRIMARY KEY,
  "request_type" text NOT NULL DEFAULT 'EVIDENCE_RECOMPUTE_REQUIRED',
  "scope_type" text NOT NULL,
  "source_type" text,
  "source_event_id" text,
  "source_revision_identity" text,
  "user_id" text REFERENCES public."users" ("id") ON DELETE RESTRICT,
  "concept_id" text REFERENCES public."ontology_concepts" ("id") ON DELETE RESTRICT,
  "projection_version" text NOT NULL,
  "reason_code" text NOT NULL,
  "input_semantic_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "cursor" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "claimed_at" text,
  "completed_at" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_recompute_requests_type_check" CHECK ("request_type" IN ('EVIDENCE_RECOMPUTE_REQUIRED', 'MASTERY_RECOMPUTE_REQUIRED')),
  CONSTRAINT "evidence_recompute_requests_scope_check" CHECK ("scope_type" IN ('EVENT', 'USER', 'CONCEPT', 'FULL')),
  CONSTRAINT "evidence_recompute_requests_status_check" CHECK ("status" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  CONSTRAINT "evidence_recompute_requests_hash_check" CHECK ("input_semantic_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "evidence_recompute_requests_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "evidence_recompute_requests_scope_values_check" CHECK (("scope_type" <> 'EVENT' OR ("source_type" IS NOT NULL AND "source_event_id" IS NOT NULL AND "source_revision_identity" IS NOT NULL)) AND ("scope_type" <> 'USER' OR "user_id" IS NOT NULL) AND ("scope_type" <> 'CONCEPT' OR "concept_id" IS NOT NULL))
);
CREATE UNIQUE INDEX "evidence_recompute_requests_semantic_unique" ON public."evidence_recompute_requests" ("request_type", "input_semantic_hash");
CREATE INDEX "evidence_recompute_requests_work_idx" ON public."evidence_recompute_requests" ("status", "request_type", "created_at");
CREATE INDEX "evidence_recompute_requests_user_idx" ON public."evidence_recompute_requests" ("user_id", "status", "created_at");
CREATE INDEX "evidence_recompute_requests_concept_idx" ON public."evidence_recompute_requests" ("concept_id", "status", "created_at");

REVOKE ALL PRIVILEGES ON TABLE public."evidence_projections", public."evidence_recompute_requests" FROM PUBLIC, anon, authenticated;
ALTER TABLE public."evidence_projections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."evidence_projections" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."evidence_recompute_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."evidence_recompute_requests" FORCE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0015_evidence_projection_foundation', 'pending-sha256')
ON CONFLICT (id) DO NOTHING;

COMMIT;
