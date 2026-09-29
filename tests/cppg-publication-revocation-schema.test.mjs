import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile("db/postgres/migrations/0057_cppg_publication_revocations.sql", "utf8");

test("CPPG revocation migration appends facts bound to the exact immutable receipt", () => {
  assert.match(migration, /CREATE TABLE public\."cppg_publication_revocations"/u);
  assert.match(migration, /FOREIGN KEY\s*\([\s\S]*?publication_id[\s\S]*?publication_semantic_identity[\s\S]*?registration_semantic_identity[\s\S]*?authority_id[\s\S]*?authority_sequence[\s\S]*?\) REFERENCES public\."cppg_publication_receipts"/u);
  assert.match(migration, /UNIQUE\s*\("publication_id"\)/u);
  assert.match(migration, /UNIQUE\s*\("idempotency_key"\)/u);
  assert.match(migration, /previous_state" text NOT NULL DEFAULT 'PUBLISHED' CHECK \("previous_state" = 'PUBLISHED'\)/u);
  assert.match(migration, /effective_state" text NOT NULL DEFAULT 'REVOKED' CHECK \("effective_state" = 'REVOKED'\)/u);
  assert.match(migration, /ON UPDATE TO public\."cppg_publication_revocations"\s+DO INSTEAD NOTHING/u);
  assert.match(migration, /ON DELETE TO public\."cppg_publication_revocations"\s+DO INSTEAD NOTHING/u);
  assert.doesNotMatch(migration, /UPDATE\s+public\."cppg_publication_receipts"|DELETE\s+FROM\s+public\."cppg_publication_receipts"/iu);
});
