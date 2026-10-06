-- Keep PostgreSQL baseline receipts server-only without changing receipt data.
BEGIN;

ALTER TABLE public.app_schema_baseline_receipts ENABLE ROW LEVEL SECURITY;

INSERT INTO app_schema_migrations (id, checksum)
VALUES ('0058_app_schema_baseline_receipts_rls_hardening', 'app-schema-baseline-receipts-rls-hardening-v1')
ON CONFLICT (id) DO NOTHING;

COMMIT;
