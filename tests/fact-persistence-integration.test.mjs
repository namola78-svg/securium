import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { Miniflare } from "miniflare";
import { FactRepository } from "../db/fact-repositories.ts";
import { D1DatabaseProvider } from "../db/provider/d1-database-provider.ts";
import { PostgresDatabaseProvider } from "../db/provider/postgres-database-provider.ts";
import {
  createFactIdentity,
  createTemporalAssertion,
} from "../lib/facts/fact-domain.ts";
import {
  bindingToProvenanceSource,
  createAssertionSourceBinding,
  createSourceIdentity,
  digestFactProvenance,
} from "../lib/provenance/fact-source-binding.ts";

const actorId = "10000000-0000-4000-8000-000000000001";
const factId = "20000000-0000-4000-8000-000000000001";
const sourceId = "30000000-0000-4000-8000-000000000001";
const createdAt = "2026-08-20T00:00:00.000Z";
const execFile = promisify(execFileCallback);

let miniflare;
let database;
let provider;
let repository;

before(async () => {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "fr-1a-integration" },
  });
  database = await miniflare.getD1Database("DB");
  for (const migration of await migrationsBefore0023()) {
    await applyMigration(migration);
  }
  await seedReferences();
  provider = new D1DatabaseProvider(database);
  repository = new FactRepository(provider);
});

after(async () => {
  await miniflare?.dispose();
});

test("FR-1A I01 D1 0023 creates exactly six empty canonical Fact tables", async () => {
  await applyMigration(await readFile("drizzle/0023_canonical_fact_foundation.sql", "utf8"));
  const tableNames = await rows(`SELECT name FROM sqlite_master
    WHERE type = 'table' AND name IN (
      'fact_identities', 'temporal_assertions', 'source_identities',
      'assertion_source_bindings', 'fact_concept_bindings', 'fact_track_bindings'
    ) ORDER BY name`);
  assert.deepEqual(tableNames.map((row) => row.name), [
    "assertion_source_bindings",
    "fact_concept_bindings",
    "fact_identities",
    "fact_track_bindings",
    "source_identities",
    "temporal_assertions",
  ]);
  assert.equal(await scalar("PRAGMA foreign_keys", "foreign_keys"), 1);
  for (const table of tableNames) {
    assert.equal(await scalar(`SELECT count(*) AS value FROM ${table.name}`), 0);
  }
  assert.equal(await scalar("SELECT count(*) AS value FROM sqlite_master WHERE name = 'fact_dependency_bindings'"), 0);
});

test("FR-1A I02 Fact creation is canonical-key unique and exact replay is idempotent", async () => {
  const fact = makeFact();
  assert.deepEqual(await repository.createFactIdentity(fact), fact);
  assert.deepEqual(await repository.createFactIdentity(fact), fact);
  assert.equal(await scalar("SELECT count(*) AS value FROM fact_identities"), 1);
  await assert.rejects(
    repository.createFactIdentity(makeFact({
      id: "20000000-0000-4000-8000-000000000002",
      canonicalLabel: "Conflicting label",
    })),
    hasCode("FACT_IDENTITY_CONFLICT"),
  );
  assert.equal((await repository.getFactIdentity(factId)).scopeDiscriminator, "kr:all-tracks");
  assert.equal((await repository.findFactByCanonicalKey(fact.canonicalKey)).id, factId);
});

test("FR-1A I03 multiple and future TemporalAssertions retain ordered immutable history", async () => {
  await repository.createSourceIdentity(makeSource());
  const currentBundle = await makeAssertionBundle("40000000-0000-4000-8000-000000000001", {
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    currentnessState: "CURRENT_VERIFIED",
  });
  const futureBundle = await makeAssertionBundle("40000000-0000-4000-8000-000000000002", {
    effectiveFrom: "2027-01-01T00:00:00.000Z",
    currentnessState: "FUTURE_CHANGE_PENDING",
    normalizedProposition: "the future threshold is ten",
  });
  const { assertion: current, bindings: currentBindings } = currentBundle;
  const { assertion: future, bindings: futureBindings } = futureBundle;
  await repository.createTemporalAssertion(current, currentBindings);
  await repository.createTemporalAssertion(future, futureBindings);
  assert.deepEqual((await repository.listAssertionsForFact(factId)).map((row) => row.id), [current.id, future.id]);
  assert.deepEqual(await repository.getTemporalAssertion(current.id), current);
  await assert.rejects(
    repository.createTemporalAssertion(
      { ...current, qualification: "changed" },
      currentBindings,
    ),
    hasCode("TEMPORAL_ASSERTION_CONFLICT"),
  );
  assert.equal(await scalar("SELECT count(*) AS value FROM temporal_assertions"), 2);
});

test("FR-1A I04 SourceIdentity is reused without storing source prose", async () => {
  const source = makeSource();
  assert.deepEqual(await repository.createSourceIdentity(source), source);
  assert.deepEqual(await repository.createSourceIdentity(source), source);
  assert.equal(await scalar("SELECT count(*) AS value FROM source_identities"), 1);
  assert.equal("body" in source || "content" in source || "prose" in source, false);
  await assert.rejects(
    repository.createSourceIdentity(makeSource({
      id: "30000000-0000-4000-8000-000000000002",
      officialTitle: "Changed",
    })),
    hasCode("SOURCE_IDENTITY_CONFLICT"),
  );
});

test("FR-1A I05 one primary and multiple supporting/context source bindings are enforced", async () => {
  const assertionId = "40000000-0000-4000-8000-000000000003";
  const primary = makeBinding("52000000-0000-4000-8000-000000000001", assertionId, sourceId, "PRIMARY_AUTHORITY", "article-1");
  const supportingSource = makeSource({
    id: "30000000-0000-4000-8000-000000000003",
    logicalSourceDocumentId: "source:official-guidance:2",
    normalizedIdentity: "official-guidance:2",
  });
  await repository.createSourceIdentity(supportingSource);
  const supporting = makeBinding("52000000-0000-4000-8000-000000000002", assertionId, supportingSource.id, "SUPPORTING_AUTHORITY", "section-2");
  const context = makeBinding(
    "52000000-0000-4000-8000-000000000003",
    assertionId,
    supportingSource.id,
    "CONTEXT_SOURCE",
    "appendix-a",
    contextVerification(),
  );
  const bindings = [context, supporting, primary];
  const assertion = await makeAssertion(assertionId, {
    normalizedProposition: "the multi-source assertion is verified",
    provenance: { sources: bindings.map(bindingToProvenanceSource) },
  });
  await repository.createTemporalAssertion(assertion, bindings);
  await repository.createTemporalAssertion(assertion, bindings);
  assert.deepEqual((await repository.listSourcesForAssertion(assertionId)).map((row) => row.sourceRole), [
    "PRIMARY_AUTHORITY", "SUPPORTING_AUTHORITY", "CONTEXT_SOURCE",
  ]);
  assert.equal(await digestFactProvenance(bindings), assertion.provenanceHash);
  await assert.rejects(
    repository.createAssertionSourceBinding(makeBinding(
      "52000000-0000-4000-8000-000000000004",
      assertionId,
      supportingSource.id,
      "PRIMARY_AUTHORITY",
      "article-2",
    )),
    hasCode("ASSERTION_SOURCE_BINDING_SET_IMMUTABLE"),
  );
  assert.equal(await scalar("SELECT count(*) AS value FROM assertion_source_bindings"), 5);
});

test("FR-1A I05A non-authority source cannot become PRIMARY_AUTHORITY", async () => {
  const beforeAssertions = await scalar("SELECT count(*) AS value FROM temporal_assertions");
  const beforeBindings = await scalar("SELECT count(*) AS value FROM assertion_source_bindings");
  assert.throws(
    () => makeBinding(
      "51000000-0000-4000-8000-000000000001",
      "41000000-0000-4000-8000-000000000001",
      sourceId,
      "PRIMARY_AUTHORITY",
      "commercial-reference",
      verification({
        classification: {
          ...eligibleClassification(),
          authorityClass: "COMMERCIAL_REFERENCE",
          usageFacts: ["REFERENCE_ONLY"],
          authenticationState: "UNVERIFIED",
        },
      }),
    ),
    /FACT_SOURCE_AUTHORITY_NOT_ELIGIBLE/,
  );
  assert.equal(await scalar("SELECT count(*) AS value FROM temporal_assertions"), beforeAssertions);
  assert.equal(await scalar("SELECT count(*) AS value FROM assertion_source_bindings"), beforeBindings);
});

test("FR-1A I05B arbitrary provenance, hash divergence, and late binding fail closed", async () => {
  const assertionId = "41000000-0000-4000-8000-000000000002";
  const primary = makeBinding(
    "51000000-0000-4000-8000-000000000002",
    assertionId,
    sourceId,
    "PRIMARY_AUTHORITY",
    "article-2",
  );
  const beforeAssertions = await scalar("SELECT count(*) AS value FROM temporal_assertions");
  const beforeBindings = await scalar("SELECT count(*) AS value FROM assertion_source_bindings");
  await assert.rejects(
    makeAssertion(assertionId, {
      provenance: { sources: [bindingToProvenanceSource(primary)], unknown: { nested: true } },
    }),
    /INVALID_FACT_PROVENANCE_MANIFEST/,
  );
  const valid = await makeAssertion(assertionId, {
    provenance: { sources: [bindingToProvenanceSource(primary)] },
  });
  await assert.rejects(
    repository.createTemporalAssertion({ ...valid, provenanceHash: "f".repeat(64) }, [primary]),
    hasCode("ASSERTION_PROVENANCE_BINDING_MISMATCH"),
  );
  assert.equal(await scalar("SELECT count(*) AS value FROM temporal_assertions"), beforeAssertions);
  assert.equal(await scalar("SELECT count(*) AS value FROM assertion_source_bindings"), beforeBindings);
  await repository.createTemporalAssertion(valid, [primary]);
  const late = makeBinding(
    "51000000-0000-4000-8000-000000000003",
    assertionId,
    sourceId,
    "CONTEXT_SOURCE",
    "appendix-late",
    contextVerification(),
  );
  await assert.rejects(
    repository.createAssertionSourceBinding(late),
    hasCode("ASSERTION_SOURCE_BINDING_SET_IMMUTABLE"),
  );
  assert.equal((await repository.listSourcesForAssertion(assertionId)).length, 1);
  assert.equal((await repository.getTemporalAssertion(assertionId)).provenanceHash, valid.provenanceHash);
});

test("FR-1A I05C assertion and binding materialization rolls back atomically", async () => {
  const assertionId = "41000000-0000-4000-8000-000000000003";
  const missingSourceBinding = makeBinding(
    "51000000-0000-4000-8000-000000000004",
    assertionId,
    "39999999-9999-4999-8999-999999999999",
    "PRIMARY_AUTHORITY",
    "article-missing",
  );
  const assertion = await makeAssertion(assertionId, {
    provenance: { sources: [bindingToProvenanceSource(missingSourceBinding)] },
  });
  const beforeAssertions = await scalar("SELECT count(*) AS value FROM temporal_assertions");
  const beforeBindings = await scalar("SELECT count(*) AS value FROM assertion_source_bindings");
  await assert.rejects(repository.createTemporalAssertion(assertion, [missingSourceBinding]));
  assert.equal(await scalar("SELECT count(*) AS value FROM temporal_assertions"), beforeAssertions);
  assert.equal(await scalar("SELECT count(*) AS value FROM assertion_source_bindings"), beforeBindings);
  assert.equal(await repository.getTemporalAssertion(assertionId), null);
});

test("FR-1A I05D conflicting binding IDs roll back the assertion and every binding", async () => {
  const assertionId = "41000000-0000-4000-8000-000000000004";
  const firstBinding = makeBinding(
    "51000000-0000-4000-8000-000000000005",
    assertionId,
    sourceId,
    "CONTEXT_SOURCE",
    "context-before-conflict",
    contextVerification(),
  );
  const conflictingBinding = makeBinding(
    "52000000-0000-4000-8000-000000000001",
    assertionId,
    sourceId,
    "PRIMARY_AUTHORITY",
    "primary-conflict",
  );
  const assertion = await makeAssertion(assertionId, {
    normalizedProposition: "a conflicting binding id must roll back the complete assertion",
    provenance: {
      sources: [firstBinding, conflictingBinding].map(bindingToProvenanceSource),
    },
  });
  const beforeAssertions = await scalar("SELECT count(*) AS value FROM temporal_assertions");
  const beforeBindings = await scalar("SELECT count(*) AS value FROM assertion_source_bindings");
  const existingBinding = await rows(`SELECT * FROM assertion_source_bindings
    WHERE id = '52000000-0000-4000-8000-000000000001'`);

  await assert.rejects(
    repository.createTemporalAssertion(assertion, [firstBinding, conflictingBinding]),
    hasCode("ASSERTION_SOURCE_BINDING_CONFLICT"),
  );

  assert.equal(await scalar("SELECT count(*) AS value FROM temporal_assertions"), beforeAssertions);
  assert.equal(await scalar("SELECT count(*) AS value FROM assertion_source_bindings"), beforeBindings);
  assert.equal(await repository.getTemporalAssertion(assertionId), null);
  assert.deepEqual(
    await rows(`SELECT * FROM assertion_source_bindings
      WHERE id = '52000000-0000-4000-8000-000000000001'`),
    existingBinding,
  );
});

test("FR-1A I05E concurrent exact replay produces one complete D1 canonical state", async () => {
  const assertionId = "41000000-0000-4000-8000-000000000005";
  const primary = makeBinding(
    "51000000-0000-4000-8000-000000000006",
    assertionId,
    sourceId,
    "PRIMARY_AUTHORITY",
    "d1-concurrent-exact",
  );
  const assertion = await makeAssertion(assertionId, {
    normalizedProposition: "concurrent exact replay has one canonical outcome",
    provenance: { sources: [bindingToProvenanceSource(primary)] },
  });
  const beforeAssertions = await scalar("SELECT count(*) AS value FROM temporal_assertions");
  const beforeBindings = await scalar("SELECT count(*) AS value FROM assertion_source_bindings");

  const outcomes = await Promise.allSettled([
    repository.createTemporalAssertion(assertion, [primary]),
    repository.createTemporalAssertion(assertion, [primary]),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 2);
  assert.equal(await scalar("SELECT count(*) AS value FROM temporal_assertions"), beforeAssertions + 1);
  assert.equal(await scalar("SELECT count(*) AS value FROM assertion_source_bindings"), beforeBindings + 1);
  assert.deepEqual(await repository.getTemporalAssertion(assertionId), assertion);
  assert.deepEqual(await repository.listSourcesForAssertion(assertionId), [primary]);
  assert.equal(await digestFactProvenance([primary]), assertion.provenanceHash);
});

test("FR-1A I05F incompatible concurrent D1 submissions preserve exactly one winner", async () => {
  const assertionId = "41000000-0000-4000-8000-000000000006";
  const winnerCandidateBinding = makeBinding(
    "51000000-0000-4000-8000-000000000007",
    assertionId,
    sourceId,
    "PRIMARY_AUTHORITY",
    "d1-race-a",
  );
  const loserCandidateBinding = makeBinding(
    "51000000-0000-4000-8000-000000000008",
    assertionId,
    sourceId,
    "PRIMARY_AUTHORITY",
    "d1-race-b",
  );
  const candidateA = {
    assertion: await makeAssertion(assertionId, {
      normalizedProposition: "D1 concurrent candidate A",
      provenance: { sources: [bindingToProvenanceSource(winnerCandidateBinding)] },
    }),
    bindings: [winnerCandidateBinding],
  };
  const candidateB = {
    assertion: await makeAssertion(assertionId, {
      normalizedProposition: "D1 concurrent candidate B",
      provenance: { sources: [bindingToProvenanceSource(loserCandidateBinding)] },
    }),
    bindings: [loserCandidateBinding],
  };
  const beforeAssertions = await scalar("SELECT count(*) AS value FROM temporal_assertions");
  const beforeBindings = await scalar("SELECT count(*) AS value FROM assertion_source_bindings");

  const outcomes = await Promise.allSettled([
    repository.createTemporalAssertion(candidateA.assertion, candidateA.bindings),
    repository.createTemporalAssertion(candidateB.assertion, candidateB.bindings),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
  assert.equal(outcomes.find((outcome) => outcome.status === "rejected").reason.code, "TEMPORAL_ASSERTION_CONFLICT");
  assert.equal(await scalar("SELECT count(*) AS value FROM temporal_assertions"), beforeAssertions + 1);
  assert.equal(await scalar("SELECT count(*) AS value FROM assertion_source_bindings"), beforeBindings + 1);

  const persistedAssertion = await repository.getTemporalAssertion(assertionId);
  const winner = persistedAssertion.normalizedProposition === candidateA.assertion.normalizedProposition
    ? candidateA
    : candidateB;
  const loser = winner === candidateA ? candidateB : candidateA;
  const persistedBindings = await repository.listSourcesForAssertion(assertionId);
  assert.deepEqual(persistedAssertion, winner.assertion);
  assert.deepEqual(persistedBindings, winner.bindings);
  assert.equal(await digestFactProvenance(persistedBindings), persistedAssertion.provenanceHash);
  assert.equal(await scalar(`SELECT count(*) AS value FROM assertion_source_bindings
    WHERE id = '${loser.bindings[0].id}'`), 0);
  await assert.rejects(
    repository.createTemporalAssertion(loser.assertion, loser.bindings),
    hasCode("TEMPORAL_ASSERTION_CONFLICT"),
  );
  assert.deepEqual(await repository.createTemporalAssertion(winner.assertion, winner.bindings), winner.assertion);
  assert.deepEqual(await repository.getTemporalAssertion(assertionId), winner.assertion);
  assert.deepEqual(await repository.listSourcesForAssertion(assertionId), winner.bindings);
});

test("FR-1A I06 Fact concept and cross-track bindings prevent duplicates without cloning Fact identity", async () => {
  const concept = {
    id: "concept-fr1a-test",
    concept_key: "fr1a:test",
    label: "Fact Test",
    normalized_label: "fact test",
  };
  await database.prepare(`INSERT INTO ontology_concepts
    (id, concept_key, label, normalized_label) VALUES (?, ?, ?, ?)`)
    .bind(concept.id, concept.concept_key, concept.label, concept.normalized_label).run();
  const conceptBinding = binding("60000000-0000-4000-8000-000000000001", { conceptId: concept.id });
  await repository.createFactConceptBinding(conceptBinding);
  await repository.createFactConceptBinding(conceptBinding);
  const cppg = track("70000000-0000-4000-8000-000000000001", "CPPG");
  const sw = track("70000000-0000-4000-8000-000000000002", "SW보안약점진단");
  await repository.createFactTrackBinding(cppg);
  await repository.createFactTrackBinding(cppg);
  await repository.createFactTrackBinding(sw);
  assert.equal(await scalar("SELECT count(*) AS value FROM fact_concept_bindings"), 1);
  assert.equal(await scalar("SELECT count(*) AS value FROM fact_track_bindings"), 2);
  assert.equal(await scalar("SELECT count(DISTINCT fact_identity_id) AS value FROM fact_track_bindings"), 1);
});

test("FR-1A I07 all history-bearing foreign keys reject destructive parent deletion", async () => {
  await assert.rejects(database.prepare("DELETE FROM fact_identities WHERE id = ?").bind(factId).run());
  await assert.rejects(database.prepare("DELETE FROM temporal_assertions WHERE id = ?")
    .bind("40000000-0000-4000-8000-000000000001").run());
  await assert.rejects(database.prepare("DELETE FROM source_identities WHERE id = ?").bind(sourceId).run());
  assert.equal(await scalar("SELECT count(*) AS value FROM fact_identities"), 1);
  assert.equal(await scalar("SELECT count(*) AS value FROM temporal_assertions"), 6);
  assert.equal(await scalar("SELECT count(*) AS value FROM source_identities"), 2);
});

test("FR-1A I08 a failed D1 batch rolls back with zero partial Fact state", async () => {
  const before = await scalar("SELECT count(*) AS value FROM fact_identities");
  await assert.rejects(database.batch([
    database.prepare(`INSERT INTO fact_identities
      (id, canonical_key, domain, canonical_label, normalized_semantic_identity,
       scope_discriminator, created_by, created_at)
      VALUES ('80000000-0000-4000-8000-000000000001', 'fact:rollback:first',
       'security', 'Rollback first', 'rollback:first', 'kr:all-tracks', ?, ?)`)
      .bind(actorId, createdAt),
    database.prepare(`INSERT INTO fact_identities
      (id, canonical_key, domain, canonical_label, normalized_semantic_identity,
       scope_discriminator, created_by, created_at)
      VALUES ('80000000-0000-4000-8000-000000000002', 'fact:rollback:second',
       'security', 'Rollback second', 'rollback:second', 'kr:all-tracks', 'missing-user', ?)`)
      .bind(createdAt),
  ]));
  assert.equal(await scalar("SELECT count(*) AS value FROM fact_identities"), before);
  assert.equal(await scalar("SELECT count(*) AS value FROM fact_identities WHERE canonical_key LIKE 'fact:rollback:%'"), 0);
});

test("FR-1A I08A the D1 NOT NULL guard rolls back an earlier successful mutation", async () => {
  const before = await scalar("SELECT count(*) AS value FROM fact_identities");
  const error = await database.batch([
    database.prepare(`INSERT INTO fact_identities
      (id, canonical_key, domain, canonical_label, normalized_semantic_identity,
       scope_discriminator, created_by, created_at)
      VALUES ('81000000-0000-4000-8000-000000000001', 'fact:guard:rollback',
       'security', 'Guard rollback', 'guard:rollback', 'kr:all-tracks', ?, ?)`)
      .bind(actorId, createdAt),
    database.prepare(`INSERT INTO temporal_assertions
      (id, fact_identity_id, normalized_proposition, effective_from,
       currentness_state, normative_strength, payload_json, provenance_json,
       payload_hash, provenance_hash, created_by, created_at)
      SELECT NULL, ?, 'guard failure', ?, 'UNVERIFIED', 'NEUTRAL_DEFINITION',
       '{}', '{}', ?, ?, ?, ? WHERE 1 = 1`)
      .bind(factId, createdAt, "b".repeat(64), "c".repeat(64), actorId, createdAt),
  ]).then(() => null, (reason) => reason);

  assert.match(String(error?.message), /NOT NULL|SQLITE_CONSTRAINT_NOTNULL/i);
  assert.equal(await scalar("SELECT count(*) AS value FROM fact_identities"), before);
  assert.equal(await scalar("SELECT count(*) AS value FROM fact_identities WHERE canonical_key = 'fact:guard:rollback'"), 0);
});

test("FR-1A I09 D1 checks reject invalid currentness, strength, and empty intervals", async () => {
  for (const [id, currentness, strength, effectiveTo] of [
    ["90000000-0000-4000-8000-000000000001", "CURRENT", "NEUTRAL_DEFINITION", null],
    ["90000000-0000-4000-8000-000000000002", "UNVERIFIED", "OPINION", null],
    ["90000000-0000-4000-8000-000000000003", "UNVERIFIED", "NEUTRAL_DEFINITION", createdAt],
  ]) {
    await assert.rejects(rawAssertionInsert(id, currentness, strength, effectiveTo));
  }
  assert.equal(await scalar("SELECT count(*) AS value FROM temporal_assertions WHERE id LIKE '90000000-%'"), 0);
});

test("FR-1A I10 D1 and PostgreSQL migrations preserve entity, index, FK, and security intent parity", async () => {
  const [d1, postgres] = await Promise.all([
    readFile("drizzle/0023_canonical_fact_foundation.sql", "utf8"),
    readFile("db/postgres/migrations/0011_canonical_fact_foundation.sql", "utf8"),
  ]);
  const tables = ["fact_identities", "temporal_assertions", "source_identities", "assertion_source_bindings", "fact_concept_bindings", "fact_track_bindings"];
  for (const table of tables) {
    assert.match(d1, new RegExp("CREATE TABLE `" + table + "`"));
    assert.match(postgres, new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`));
    assert.match(postgres, new RegExp(`ALTER TABLE public\\."${table}" ENABLE ROW LEVEL SECURITY`));
    assert.match(postgres, new RegExp(`ALTER TABLE public\\."${table}" FORCE ROW LEVEL SECURITY`));
    assert.match(postgres, new RegExp(`REVOKE ALL PRIVILEGES ON TABLE public\\."${table}"`));
  }
  assert.equal((d1.match(/CREATE UNIQUE INDEX/g) ?? []).length, 8);
  assert.equal((postgres.match(/CREATE UNIQUE INDEX/g) ?? []).length, 8);
  assert.equal((d1.match(/CREATE INDEX /g) ?? []).length, 9);
  assert.equal((postgres.match(/CREATE INDEX /g) ?? []).length, 9);
  assert.equal((d1.match(/FOREIGN KEY/g) ?? []).length, 12);
  assert.equal((postgres.match(/REFERENCES "/g) ?? []).length, 12);
  assert.equal((postgres.match(/ON DELETE CASCADE/g) ?? []).length, 0);
});

test("FR-1A I11 disposable PostgreSQL applies 0011 with RLS, privileges, and history-safe FKs", async () => {
  const container = `securium-fr1a-${randomUUID()}`;
  const password = "fr1a-disposable-password";
  let sql;
  let sql2;
  let started = false;
  try {
    await execFile("docker", [
      "run", "--detach", "--rm", "--name", container,
      "--env", `POSTGRES_PASSWORD=${password}`,
      "--publish", "127.0.0.1::5432", "postgres:17.6",
    ]);
    started = true;
    await waitForPostgres(container);
    const { stdout } = await execFile("docker", ["port", container, "5432/tcp"]);
    const port = stdout.trim().match(/:(\d+)$/)?.[1];
    assert.ok(port);
    const postgres = (await import("postgres")).default;
    sql = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, {
      max: 1, prepare: false, ssl: false, onnotice: false,
    });
    sql2 = postgres(`postgres://postgres:${password}@127.0.0.1:${port}/postgres`, {
      max: 1, prepare: false, ssl: false, onnotice: false,
    });
    await waitForPostgresClient(sql);
    await waitForPostgresClient(sql2);
    await Promise.all([
      sql.unsafe("SET lock_timeout = '5s'; SET statement_timeout = '60s'"),
      sql2.unsafe("SET lock_timeout = '5s'; SET statement_timeout = '60s'"),
    ]);
    await sql.unsafe(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE TABLE users (id text PRIMARY KEY);
      CREATE TABLE ontology_concepts (id text PRIMARY KEY);
      CREATE TABLE app_schema_migrations (
        id text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await sql.unsafe(await readFile("db/postgres/migrations/0011_canonical_fact_foundation.sql", "utf8"));
    const tableState = await sql.unsafe(`SELECT
      count(*)::int AS tables,
      count(*) FILTER (WHERE relrowsecurity)::int AS rls,
      count(*) FILTER (WHERE relforcerowsecurity)::int AS force_rls
      FROM pg_class WHERE relkind = 'r' AND relname = ANY($1)`, [[
      "fact_identities", "temporal_assertions", "source_identities",
      "assertion_source_bindings", "fact_concept_bindings", "fact_track_bindings",
    ]]);
    assert.deepEqual(tableState[0], { tables: 6, rls: 6, force_rls: 6 });
    const indexes = await sql.unsafe(`SELECT
      count(*) FILTER (WHERE indexdef LIKE 'CREATE UNIQUE INDEX%')::int AS unique_indexes,
      count(*) FILTER (WHERE indexdef LIKE 'CREATE INDEX%')::int AS operational_indexes
      FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE ANY($1)
        AND indexname NOT LIKE '%_pkey'`, [[
      "fact_identities_%", "temporal_assertions_%", "source_identities_%",
      "assertion_source_bindings_%", "fact_concept_bindings_%", "fact_track_bindings_%",
    ]]);
    assert.deepEqual(indexes[0], { unique_indexes: 8, operational_indexes: 9 });
    const foreignKeys = await sql.unsafe(`SELECT confdeltype, count(*)::int AS count
      FROM pg_constraint WHERE contype = 'f' AND conrelid::regclass::text = ANY($1)
      GROUP BY confdeltype ORDER BY confdeltype`, [[
      "fact_identities", "temporal_assertions", "source_identities",
      "assertion_source_bindings", "fact_concept_bindings", "fact_track_bindings",
    ]]);
    assert.deepEqual(foreignKeys.map((row) => ({ ...row })), [
      { confdeltype: "a", count: 4 },
      { confdeltype: "r", count: 8 },
    ]);
    const privileges = await sql.unsafe(`SELECT count(*)::int AS count
      FROM information_schema.role_table_grants
      WHERE table_name = ANY($1) AND grantee = ANY($2)`, [[
      "fact_identities", "temporal_assertions", "source_identities",
      "assertion_source_bindings", "fact_concept_bindings", "fact_track_bindings",
    ], ["PUBLIC", "anon", "authenticated"]]);
    assert.equal(privileges[0].count, 0);
    const registration = await sql.unsafe("SELECT count(*)::int AS count FROM app_schema_migrations WHERE id = '0011_canonical_fact_foundation'");
    assert.equal(registration[0].count, 1);
    await sql.unsafe("INSERT INTO users (id) VALUES ($1)", [actorId]);
    await provePostgresGuardRollback(sql);
    await provePostgresBindingConflictAtomicity(sql, sql2);
  } finally {
    if (sql2) await sql2.end({ timeout: 5 });
    if (sql) await sql.end({ timeout: 5 });
    if (started) await execFile("docker", ["rm", "--force", container]);
  }
});

test("FR-1A I12 published assertion history has no repository update, delete, or overwrite primitive", () => {
  const names = Object.getOwnPropertyNames(FactRepository.prototype).filter((name) => name !== "constructor");
  for (const prohibited of [
    "updateFact", "updateAssertion", "deleteFact", "deleteAssertion",
    "upsertAndOverwriteCanonicalFact", "setCurrentAssertion", "supersede",
  ]) {
    assert.equal(names.includes(prohibited), false);
  }
});

function makeFact(overrides = {}) {
  return createFactIdentity({
    id: factId,
    canonicalKey: "fact:security:retention-threshold",
    domain: "security",
    canonicalLabel: "Retention threshold",
    normalizedSemanticIdentity: "retention threshold",
    scopeDiscriminator: "kr:all-tracks",
    createdBy: actorId,
    createdAt,
    ...overrides,
  });
}

function makeAssertion(id, overrides = {}) {
  return createTemporalAssertion({
    id,
    factIdentityId: factId,
    normalizedProposition: "the threshold is five",
    effectiveFrom: createdAt,
    currentnessState: "CURRENT_VERIFIED",
    normativeStrength: "NEUTRAL_DEFINITION",
    provenance: { sources: [provenanceSource(sourceId, "PRIMARY_AUTHORITY", "article-default")] },
    createdBy: actorId,
    createdAt,
    ...overrides,
  });
}

async function makeAssertionBundle(id, overrides = {}) {
  const bindingId = id.replace(/^40/, "50");
  const primary = makeBinding(
    bindingId,
    id,
    sourceId,
    "PRIMARY_AUTHORITY",
    `article-${id.slice(-1)}`,
  );
  return {
    assertion: await makeAssertion(id, {
      provenance: { sources: [bindingToProvenanceSource(primary)] },
      ...overrides,
    }),
    bindings: [primary],
  };
}

function makeSource(overrides = {}) {
  return createSourceIdentity({
    id: sourceId,
    logicalSourceDocumentId: "source:statute:1",
    sourceKind: "STATUTE",
    officialTitle: "Synthetic statute",
    normalizedIdentity: "synthetic-statute:1",
    issuer: "Synthetic Authority",
    jurisdiction: "KR",
    createdBy: actorId,
    createdAt,
    ...overrides,
  });
}

function makeBinding(
  id,
  temporalAssertionId,
  sourceIdentityId,
  sourceRole,
  locator,
  sourceVerification = verification(),
) {
  return createAssertionSourceBinding({
    id,
    temporalAssertionId,
    sourceIdentityId,
    sourceRole,
    sourceVersion: "v1",
    sourceHash: "a".repeat(64),
    locator,
    verification: sourceVerification,
    createdBy: actorId,
    createdAt,
  });
}

function eligibleClassification(overrides = {}) {
  return {
    authorityClass: "OFFICIAL_PUBLIC",
    usageFacts: ["CAN_USE_AS_AUTHORITY"],
    copyrightReviewState: "APPROVED_FOR_CANONICAL_USE",
    independenceState: "DECLARED_INDEPENDENT",
    currentnessState: "CURRENT",
    authenticationState: "AUTHENTICATED",
    ...overrides,
  };
}

function verification(overrides = {}) {
  return {
    classification: eligibleClassification(),
    reviewDecision: "ACCEPTED",
    verifiedBy: actorId,
    verifiedAt: createdAt,
    retrievedAt: createdAt,
    ...overrides,
  };
}

function contextVerification() {
  return verification({
    classification: {
      ...eligibleClassification(),
      authorityClass: "COMMERCIAL_REFERENCE",
      usageFacts: ["REFERENCE_ONLY"],
    },
    reviewDecision: "CONTEXT_ONLY",
  });
}

function provenanceSource(sourceIdentityId, sourceRole, locator) {
  return {
    sourceIdentityId,
    sourceRole,
    sourceVersion: "v1",
    sourceHash: "a".repeat(64),
    locator,
    verification: sourceRole === "CONTEXT_SOURCE" ? contextVerification() : verification(),
  };
}

function binding(id, overrides) {
  return Object.freeze({ id, factIdentityId: factId, createdBy: actorId, createdAt, ...overrides });
}

function track(id, trackKey) {
  return Object.freeze({ id, factIdentityId: factId, trackKey, createdBy: actorId, createdAt });
}

async function migrationsBefore0023() {
  const names = (await readdir("drizzle"))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name) && Number(name.slice(0, 4)) < 23)
    .sort();
  return Promise.all(names.map((name) => readFile(`drizzle/${name}`, "utf8")));
}

async function applyMigration(sql) {
  const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
  for (let index = 0; index < statements.length; index += 50) {
    await database.batch(statements.slice(index, index + 50).map((statement) => database.prepare(statement)));
  }
}

async function seedReferences() {
  await database.batch([
    database.prepare("PRAGMA foreign_keys = ON"),
    database.prepare("INSERT INTO users (id, email, display_name) VALUES (?, 'fr1a@example.invalid', 'FR-1A Operator')").bind(actorId),
  ]);
}

function rawAssertionInsert(id, currentness, strength, effectiveTo) {
  return database.prepare(`INSERT INTO temporal_assertions
    (id, fact_identity_id, normalized_proposition, effective_from, effective_to,
     currentness_state, normative_strength, payload_json, provenance_json,
     payload_hash, provenance_hash, created_by, created_at)
    VALUES (?, ?, 'invalid contract fixture', ?, ?, ?, ?, '{}', '{}', ?, ?, ?, ?)`)
    .bind(id, factId, createdAt, effectiveTo, currentness, strength, "b".repeat(64), "c".repeat(64), actorId, createdAt).run();
}

async function rows(sql) {
  return (await database.prepare(sql).all()).results ?? [];
}

async function scalar(sql, key = "value") {
  const row = await database.prepare(sql).first();
  return Number(row?.[key] ?? 0);
}

function hasCode(code) {
  return (error) => error?.code === code;
}

function makePostgresRepository(sql) {
  return new FactRepository(new PostgresDatabaseProvider({
    query: (statement, parameters) => postgresQuery(sql, statement, parameters),
    transaction: (callback) => sql.begin((transaction) => callback({
      query: (statement, parameters) => postgresQuery(transaction, statement, parameters),
    })),
  }));
}

async function provePostgresGuardRollback(sql) {
  const provider = new PostgresDatabaseProvider({
    query: (statement, parameters) => postgresQuery(sql, statement, parameters),
    transaction: (callback) => sql.begin((transaction) => callback({
      query: (statement, parameters) => postgresQuery(transaction, statement, parameters),
    })),
  });
  const error = await provider.transaction([
    {
      sql: `INSERT INTO fact_identities
        (id, canonical_key, domain, canonical_label, normalized_semantic_identity,
         scope_discriminator, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      parameters: [
        "82000000-0000-4000-8000-000000000001",
        "fact:postgres-guard:rollback",
        "security",
        "PostgreSQL guard rollback",
        "postgres-guard:rollback",
        "kr:all-tracks",
        actorId,
        createdAt,
      ],
    },
    {
      sql: `INSERT INTO temporal_assertions
        (id, fact_identity_id, normalized_proposition, effective_from,
         currentness_state, normative_strength, payload_json, provenance_json,
         payload_hash, provenance_hash, created_by, created_at)
        SELECT NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE 1 = 1`,
      parameters: [
        factId,
        "portable guard failure",
        createdAt,
        "UNVERIFIED",
        "NEUTRAL_DEFINITION",
        "{}",
        "{}",
        "b".repeat(64),
        "c".repeat(64),
        actorId,
        createdAt,
      ],
    },
  ]).then(() => null, (reason) => reason);
  assert.equal(error?.code, "23502");
  const rolledBack = await sql.unsafe(
    "SELECT count(*)::int AS count FROM fact_identities WHERE canonical_key = $1",
    ["fact:postgres-guard:rollback"],
  );
  assert.equal(rolledBack[0].count, 0);
}

async function provePostgresBindingConflictAtomicity(sql, sql2) {
  const postgresRepository = makePostgresRepository(sql);
  const concurrentRepository = makePostgresRepository(sql2);
  const fact = makeFact();
  const source = makeSource();
  await postgresRepository.createFactIdentity(fact);
  await postgresRepository.createSourceIdentity(source);

  const seedAssertionId = "42000000-0000-4000-8000-000000000001";
  const sharedBindingId = "53000000-0000-4000-8000-000000000001";
  const seedBinding = makeBinding(
    sharedBindingId,
    seedAssertionId,
    sourceId,
    "PRIMARY_AUTHORITY",
    "postgres-seed",
  );
  const supportingBinding = makeBinding(
    "53000000-0000-4000-8000-000000000003",
    seedAssertionId,
    sourceId,
    "SUPPORTING_AUTHORITY",
    "postgres-supporting",
  );
  const contextBinding = makeBinding(
    "53000000-0000-4000-8000-000000000004",
    seedAssertionId,
    sourceId,
    "CONTEXT_SOURCE",
    "postgres-context",
    contextVerification(),
  );
  const seedBindings = [contextBinding, supportingBinding, seedBinding];
  const seedAssertion = await makeAssertion(seedAssertionId, {
    normalizedProposition: "the PostgreSQL seed assertion is valid",
    provenance: { sources: seedBindings.map(bindingToProvenanceSource) },
  });
  await postgresRepository.createTemporalAssertion(seedAssertion, seedBindings);
  await postgresRepository.createTemporalAssertion(seedAssertion, seedBindings);
  assert.deepEqual(
    (await postgresRepository.listSourcesForAssertion(seedAssertionId)).map((row) => row.sourceRole),
    ["PRIMARY_AUTHORITY", "SUPPORTING_AUTHORITY", "CONTEXT_SOURCE"],
  );

  const assertionId = "42000000-0000-4000-8000-000000000002";
  const firstBinding = makeBinding(
    "53000000-0000-4000-8000-000000000002",
    assertionId,
    sourceId,
    "CONTEXT_SOURCE",
    "postgres-context-before-conflict",
    contextVerification(),
  );
  const conflict = makeBinding(
    sharedBindingId,
    assertionId,
    sourceId,
    "PRIMARY_AUTHORITY",
    "postgres-primary-conflict",
  );
  const assertion = await makeAssertion(assertionId, {
    normalizedProposition: "PostgreSQL must roll back a partial provenance binding set",
    provenance: { sources: [firstBinding, conflict].map(bindingToProvenanceSource) },
  });
  const before = await postgresCounts(sql);
  const storedBinding = await sql.unsafe(
    "SELECT * FROM assertion_source_bindings WHERE id = $1",
    [sharedBindingId],
  );

  await assert.rejects(
    postgresRepository.createTemporalAssertion(assertion, [firstBinding, conflict]),
    hasCode("ASSERTION_SOURCE_BINDING_CONFLICT"),
  );

  assert.deepEqual(await postgresCounts(sql), before);
  assert.deepEqual(
    [...await sql.unsafe("SELECT * FROM assertion_source_bindings WHERE id = $1", [sharedBindingId])],
    [...storedBinding],
  );
  assert.equal(await postgresRepository.getTemporalAssertion(assertionId), null);

  const exactAssertionId = "42000000-0000-4000-8000-000000000003";
  const exactBinding = makeBinding(
    "53000000-0000-4000-8000-000000000005",
    exactAssertionId,
    sourceId,
    "PRIMARY_AUTHORITY",
    "postgres-concurrent-exact",
  );
  const exactAssertion = await makeAssertion(exactAssertionId, {
    normalizedProposition: "PostgreSQL concurrent exact replay is deterministic",
    provenance: { sources: [bindingToProvenanceSource(exactBinding)] },
  });
  const exactOutcomes = await Promise.allSettled([
    postgresRepository.createTemporalAssertion(exactAssertion, [exactBinding]),
    concurrentRepository.createTemporalAssertion(exactAssertion, [exactBinding]),
  ]);
  assert.equal(exactOutcomes.filter((outcome) => outcome.status === "fulfilled").length, 2);
  const exactRows = await sql.unsafe(
    "SELECT count(*)::int AS count FROM temporal_assertions WHERE id = $1",
    [exactAssertionId],
  );
  assert.equal(exactRows[0].count, 1);
  assert.deepEqual(await postgresRepository.listSourcesForAssertion(exactAssertionId), [exactBinding]);
  assert.equal(await digestFactProvenance([exactBinding]), exactAssertion.provenanceHash);

  const raceAssertionId = "42000000-0000-4000-8000-000000000004";
  const bindingA = makeBinding(
    "53000000-0000-4000-8000-000000000006",
    raceAssertionId,
    sourceId,
    "PRIMARY_AUTHORITY",
    "postgres-race-a",
  );
  const bindingB = makeBinding(
    "53000000-0000-4000-8000-000000000007",
    raceAssertionId,
    sourceId,
    "PRIMARY_AUTHORITY",
    "postgres-race-b",
  );
  const candidateA = {
    assertion: await makeAssertion(raceAssertionId, {
      normalizedProposition: "PostgreSQL concurrent candidate A",
      provenance: { sources: [bindingToProvenanceSource(bindingA)] },
    }),
    bindings: [bindingA],
  };
  const candidateB = {
    assertion: await makeAssertion(raceAssertionId, {
      normalizedProposition: "PostgreSQL concurrent candidate B",
      provenance: { sources: [bindingToProvenanceSource(bindingB)] },
    }),
    bindings: [bindingB],
  };
  const beforeRace = await postgresCounts(sql);
  const raceOutcomes = await Promise.allSettled([
    postgresRepository.createTemporalAssertion(candidateA.assertion, candidateA.bindings),
    concurrentRepository.createTemporalAssertion(candidateB.assertion, candidateB.bindings),
  ]);
  assert.equal(raceOutcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(raceOutcomes.filter((outcome) => outcome.status === "rejected").length, 1);
  assert.equal(
    raceOutcomes.find((outcome) => outcome.status === "rejected").reason.code,
    "TEMPORAL_ASSERTION_CONFLICT",
  );
  const afterRace = await postgresCounts(sql);
  assert.deepEqual(afterRace, {
    assertions: beforeRace.assertions + 1,
    bindings: beforeRace.bindings + 1,
  });

  const persistedAssertion = await postgresRepository.getTemporalAssertion(raceAssertionId);
  const winner = persistedAssertion.normalizedProposition === candidateA.assertion.normalizedProposition
    ? candidateA
    : candidateB;
  const loser = winner === candidateA ? candidateB : candidateA;
  const persistedBindings = await postgresRepository.listSourcesForAssertion(raceAssertionId);
  assert.deepEqual(persistedAssertion, winner.assertion);
  assert.deepEqual(persistedBindings, winner.bindings);
  assert.equal(await digestFactProvenance(persistedBindings), persistedAssertion.provenanceHash);
  const loserBindings = await sql.unsafe(
    "SELECT count(*)::int AS count FROM assertion_source_bindings WHERE id = $1",
    [loser.bindings[0].id],
  );
  assert.equal(loserBindings[0].count, 0);
  await assert.rejects(
    concurrentRepository.createTemporalAssertion(loser.assertion, loser.bindings),
    hasCode("TEMPORAL_ASSERTION_CONFLICT"),
  );
  assert.deepEqual(
    await postgresRepository.createTemporalAssertion(winner.assertion, winner.bindings),
    winner.assertion,
  );
  assert.deepEqual(await postgresRepository.getTemporalAssertion(raceAssertionId), winner.assertion);
  assert.deepEqual(await postgresRepository.listSourcesForAssertion(raceAssertionId), winner.bindings);
}

async function postgresCounts(sql) {
  const result = await sql.unsafe(`SELECT
    (SELECT count(*)::int FROM temporal_assertions) AS assertions,
    (SELECT count(*)::int FROM assertion_source_bindings) AS bindings`);
  return { assertions: result[0].assertions, bindings: result[0].bindings };
}

async function postgresQuery(sql, statement, parameters) {
  const rows = await sql.unsafe(statement, [...parameters]);
  return { rows: [...rows], rowCount: Number(rows.count ?? rows.length) };
}

async function waitForPostgres(container) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await execFile("docker", ["exec", container, "pg_isready", "--username", "postgres"]);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Disposable PostgreSQL did not become ready.");
}

async function waitForPostgresClient(sql) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await sql.unsafe("SELECT 1");
      return;
    } catch (error) {
      if (!["57P03", "ECONNREFUSED", "ECONNRESET"].includes(error?.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("Disposable PostgreSQL client connection did not become ready.");
}
