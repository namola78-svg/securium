import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SECURIUM_CANONICAL_CONCEPT_SEED,
  SECURIUM_CANONICAL_CONCEPT_SEED_METADATA,
} from "../lib/data/securium-canonical-concept-dataset-seed.mjs";

const testDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)));
const foundationManifestPath = resolve(
  testDirectory,
  "../../securium-canonical-ontology-dataset-foundation/db/seeds/canonical-ontology/canonical-concept-manifest.json",
);

test("Dataset A is historical evidence with no writer authority", () => {
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.classification, "HISTORICAL_DATASET_A");
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.manifestClassification, "ARCHIVED_EVIDENCE");
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.writerAuthority, "NONE");
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.sharedNonprodWriteAuthority, "NONE");
  assert.equal(SECURIUM_CANONICAL_CONCEPT_SEED.length, 29);
});

test("Dataset B owner is unique and current owner counts are preserved", () => {
  const manifest = JSON.parse(readFileSync(foundationManifestPath, "utf8"));
  assert.equal(manifest.concepts.length, 54);
  assert.equal(manifest.concepts.reduce((count, concept) => count + concept.aliases.length, 0), 56);
  assert.equal(manifest.relations.length, 4);
  assert.equal(
    SECURIUM_CANONICAL_CONCEPT_SEED_METADATA.canonicalOwner,
    "securium-canonical-ontology-dataset-foundation",
  );
});
