-- REVIEW EXAMPLE ONLY. NOT APPLIED BY THIS SPRINT.
-- Dimension 1536 is illustrative; choose it from the approved embedding model.

create extension if not exists vector with schema extensions;

create table if not exists public.content_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  source_revision_id text,
  course_id text,
  review_status text not null,
  embedding_model text not null,
  embedding_dimensions integer not null check (embedding_dimensions > 0),
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, source_revision_id, embedding_model)
);

create index if not exists content_embeddings_course_idx
  on public.content_embeddings (course_id, review_status);

-- Build an HNSW/IVFFlat vector index only after the model, operator, workload,
-- and representative data volume are confirmed. A dimension/model change
-- should create a new embedding version rather than mutate old vectors.
