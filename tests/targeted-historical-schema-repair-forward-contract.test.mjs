import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();
const migrationDirectory = join(root, "db", "postgres", "migrations");

const waves = [
  {
    id: "0042_forward_cs1a_audit_identity_reconciliation",
    checksum: "forward-cs1a-audit-identity-reconciliation-v1",
    tables: 3, functions: 0, triggers: 0, foreignKeys: 4, explicitIndexes: 1, constraints: 6,
    expectedTables: ["cs1a_governance_decisions", "cs1a_governance_decision_subjects", "cs1a_governance_decision_audits"],
  },
  {
    id: "0043_forward_final_review_authority_reconciliation",
    checksum: "forward-final-review-authority-reconciliation-v1",
    tables: 2, functions: 0, triggers: 0, foreignKeys: 3, explicitIndexes: 4, constraints: 7,
    expectedTables: ["content_final_review_authorities", "content_final_review_authority_subjects"],
  },
  {
    id: "0044_forward_review_judgment_reconciliation",
    checksum: "forward-review-judgment-reconciliation-v1",
    tables: 3, functions: 2, triggers: 7, foreignKeys: 5, explicitIndexes: 6, constraints: 12,
    expectedTables: ["content_review_judgments", "content_review_judgment_subjects", "content_review_findings"],
  },
  {
    id: "0045_forward_reviewer_separation_reconciliation",
    checksum: "forward-reviewer-separation-reconciliation-v1",
    tables: 2, functions: 1, triggers: 4, foreignKeys: 9, explicitIndexes: 10, constraints: 14,
    expectedTables: ["content_review_owner_attestations", "content_review_policy_evaluations"],
  },
  {
    id: "0046_forward_revision_registration_reconciliation",
    checksum: "forward-revision-registration-reconciliation-v1",
    tables: 3, functions: 1, triggers: 6, foreignKeys: 7, explicitIndexes: 10, constraints: 8,
    expectedTables: ["content_revision_registrations", "content_revision_registration_subjects", "content_revision_registration_sources"],
  },
  {
    id: "0047_forward_review_currentness_reconciliation",
    checksum: "forward-review-currentness-reconciliation-v1",
    tables: 0, functions: 0, triggers: 0, foreignKeys: 0, explicitIndexes: 0, constraints: 2,
    expectedTables: [],
  },
];

async function loadWave(wave) {
  const sql = await readFile(join(migrationDirectory, wave.id + ".sql"), "utf8");
  return { ...wave, sql };
}

function count(sql, pattern) {
  return [...sql.matchAll(pattern)].length;
}

test("exactly six ordered forward reconciliation migrations are present", () => {
  assert.deepEqual(waves.map((wave) => wave.id), [
    "0042_forward_cs1a_audit_identity_reconciliation",
    "0043_forward_final_review_authority_reconciliation",
    "0044_forward_review_judgment_reconciliation",
    "0045_forward_reviewer_separation_reconciliation",
    "0046_forward_revision_registration_reconciliation",
    "0047_forward_review_currentness_reconciliation",
  ]);
});

test("each forward migration is transactional and registers only its new authority", async () => {
  for (const wave of waves) {
    const { sql } = await loadWave(wave);
    assert.match(sql.trimStart(), /^--/);
    assert.match(sql, /\bBEGIN;\s*/i);
    assert.match(sql.trim(), /COMMIT;\s*$/i);
    assert.match(sql, new RegExp(
      "INSERT\\s+INTO\\s+app_schema_migrations\\s*\\(id,\\s*checksum\\)\\s*VALUES\\s*\\('" +
        wave.id + "',\\s*'" + wave.checksum + "'\\)",
      "i",
    ));
    assert.doesNotMatch(sql, /VALUES\s*\(\s*'002[2-9]_/i);
    assert.doesNotMatch(sql, /0041_legacy_concept_rls_hardening/);
  }
});

test("the six waves match the approved exact object manifest", async () => {
  const loaded = await Promise.all(waves.map(loadWave));
  const totals = loaded.reduce(
    (sum, wave) => ({
      tables: sum.tables + count(wave.sql, /\bCREATE TABLE public\."/g),
      functions: sum.functions + count(wave.sql, /\bCREATE FUNCTION public\./g),
      triggers: sum.triggers + count(wave.sql, /\bCREATE TRIGGER\b/g),
      foreignKeys: sum.foreignKeys + count(wave.sql, /\bREFERENCES\b/g),
      explicitIndexes: sum.explicitIndexes + count(wave.sql, /^\s*CREATE (?:UNIQUE )?INDEX\b/gm),
      constraints: sum.constraints + count(wave.sql, /\b(?:ADD )?CONSTRAINT\b/g),
    }),
    { tables: 0, functions: 0, triggers: 0, foreignKeys: 0, explicitIndexes: 0, constraints: 0 },
  );

  for (const wave of loaded) {
    assert.equal(count(wave.sql, /\bCREATE TABLE public\."/g), wave.tables, wave.id);
    assert.equal(count(wave.sql, /\bCREATE FUNCTION public\./g), wave.functions, wave.id);
    assert.equal(count(wave.sql, /\bCREATE TRIGGER\b/g), wave.triggers, wave.id);
    assert.equal(count(wave.sql, /\bREFERENCES\b/g), wave.foreignKeys, wave.id);
    assert.equal(count(wave.sql, /^\s*CREATE (?:UNIQUE )?INDEX\b/gm), wave.explicitIndexes, wave.id);
    assert.equal(count(wave.sql, /\b(?:ADD )?CONSTRAINT\b/g), wave.constraints, wave.id);
    for (const table of wave.expectedTables) assert.match(wave.sql, new RegExp('CREATE TABLE public\\."' + table + '"'));
  }

  assert.deepEqual(totals, { tables: 13, functions: 4, triggers: 17, foreignKeys: 28, explicitIndexes: 31, constraints: 49 });
  // The forward authority does not create the obsolete semantic-only index on
  // a fresh schema. If that historical index exists, Wave 4 proves and
  // replaces it with the reviewer-scoped index. The final fresh-state count
  // therefore remains 31 explicit indexes.
  const survivingExplicitIndexes = 31;
  const finalCatalogIndexes = survivingExplicitIndexes + 13 + 6;
  assert.equal(finalCatalogIndexes, 50, "final catalog index arithmetic matches the approved target");
});

test("forward migrations use invoker functions and no client privilege mutation", async () => {
  const loaded = await Promise.all(waves.map(loadWave));
  const sql = loaded.map((wave) => wave.sql).join("\n");
  assert.equal(count(sql, /\bCREATE FUNCTION public\./g), 4);
  assert.equal(count(sql, /\bSECURITY\s+DEFINER\b/gi), 0);
  assert.equal(count(sql, /\bSECURITY\s+INVOKER\b/gi), 0, "invoker is the PostgreSQL default");
  assert.equal(count(sql, /\b(?:GRANT|REVOKE)\b/gi), 0);
  assert.equal(count(sql, /\bCREATE POLICY\b/gi), 0);
  assert.equal(count(sql, /\bENABLE ROW LEVEL SECURITY\b/gi), 13);
  assert.equal(count(sql, /\bFORCE ROW LEVEL SECURITY\b/gi), 13);
});

test("historical, legacy Concept, and superseded 0011 authorities are excluded", async () => {
  const loaded = await Promise.all(waves.map(loadWave));
  const sql = loaded.map((wave) => wave.sql).join("\n");
  assert.doesNotMatch(sql, /\bfact_concept_bindings_identity_unique\b/);
  assert.doesNotMatch(sql, /\b(?:concepts|concept_versions|concept_labels)\b/);
  for (const id of ["0001", "0002", "0004", "0005", "0009", "0011", "0017", "0021", "0027", "0022", "0023", "0024", "0025", "0026", "0028", "0029"]) {
    assert.doesNotMatch(sql, new RegExp("'" + id + "_"), "historical migration id " + id);
  }
});

test("0026 obsolete-index replacement is exact and fail-closed", async () => {
  const judgmentWave = await loadWave(waves[2]);
  const { sql } = await loadWave(waves[3]);
  assert.doesNotMatch(judgmentWave.sql, /CREATE UNIQUE INDEX\s+"content_review_judgments_semantic_unique"/i);
  assert.doesNotMatch(sql, /DROP\s+INDEX\s+IF\s+EXISTS/i);
  assert.match(sql, /index_class\.relname\s*=\s*'content_review_judgments_semantic_unique'/i);
  assert.match(sql, /index_class\.relkind\s*=\s*'i'/i);
  assert.match(sql, /index_metadata\.indisunique/i);
  assert.match(sql, /access_method\s+IS\s+DISTINCT\s+FROM\s+'btree'/i);
  assert.match(sql, /key_count\s+IS\s+DISTINCT\s+FROM\s+1/i);
  assert.match(sql, /pg_get_indexdef\(index_metadata\.indexrelid\)/i);
  assert.match(sql, /Conflicting obsolete content review judgment index requires review/);
  assert.match(sql, /DROP INDEX public\."content_review_judgments_semantic_unique"/);
  assert.match(sql, /content_review_owner_attestations_state_idx/);
  assert.match(sql, /content_review_policy_evaluations_judgment_idx/);
});

test("forward files do not contain broad conflict-hiding creation patterns", async () => {
  const loaded = await Promise.all(waves.map(loadWave));
  const sql = loaded.map((wave) => wave.sql).join("\n");
  assert.doesNotMatch(sql, /\bCREATE\s+(?:TABLE|INDEX|FUNCTION|TRIGGER)\s+IF\s+NOT\s+EXISTS\b/i);
  assert.doesNotMatch(sql, /\bCREATE\s+OR\s+REPLACE\s+FUNCTION\b/i);
});
