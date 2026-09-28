import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile("db/postgres/migrations/0055_cppg_publication_receipts.sql", "utf8");
const registration = await readFile("db/postgres/migrations/0054_cppg_canonical_registration.sql", "utf8");

test("publication receipt is additive, append-only, and does not publish during migration", () => {
  assert.match(migration, /CREATE TABLE public\."cppg_publication_receipts"/u);
  assert.doesNotMatch(migration, /INSERT\s+INTO\s+public\."cppg_publication_receipts"/iu);
  assert.doesNotMatch(migration, /UPDATE\s+public\."cppg_runtime_registrations"/iu);
  assert.doesNotMatch(migration, /UPDATE\s+public\."courses"/iu);
  assert.match(registration, /DEFAULT 'REGISTERED_UNPUBLISHED' CHECK \("state" = 'REGISTERED_UNPUBLISHED'\)/u);
  assert.match(registration, /DEFAULT 'NOT_GRANTED' CHECK \("publication_authority" = 'NOT_GRANTED'\)/u);
  assert.match(migration, /ON UPDATE TO public\."cppg_publication_receipts"\s+DO INSTEAD NOTHING/u);
  assert.match(migration, /ON DELETE TO public\."cppg_publication_receipts"\s+DO INSTEAD NOTHING/u);
});

test("receipt records the approved registration snapshot and one PUBLISHED state", () => {
  for (const field of [
    "publication_id", "registration_semantic_identity", "course_id", "runtime_revision_id",
    "content_revision_ids", "source_manifest_id", "source_package_hash", "foundation_id",
    "foundation_hash", "approval_subject_hash", "authority_id", "authority_sequence",
    "publication_state", "publication_semantic_identity", "published_at", "published_by",
  ]) assert.match(migration, new RegExp(`"${field}"`, "u"), field);
  assert.match(migration, /DEFAULT 'PUBLISHED' CHECK \("publication_state" = 'PUBLISHED'\)/u);
  assert.match(migration, /"registration_semantic_identity" text NOT NULL UNIQUE/u);
  assert.match(migration, /"publication_semantic_identity" text NOT NULL UNIQUE/u);
  assert.match(migration, /FOREIGN KEY\s*\([\s\S]*?\) REFERENCES public\."cppg_runtime_registrations"/u);
  assert.equal((migration.match(/"content_revision_ids"/gu) ?? []).length >= 3, true);
});

test("publication identity is defined from the immutable registration identity", async () => {
  const design = await readFile("docs/cppg-publication-receipt-schema.md", "utf8");
  assert.match(migration, /CPPG_PUBLICATION_RECEIPT_V1/u);
  assert.match(design, /SHA-256 over the repository canonical JSON encoding/u);
  assert.match(design, /NOT_GRANTED/u);
  assert.match(design, /Legacy `courses\.active` \/ `courses\.published` flags/u);
});
