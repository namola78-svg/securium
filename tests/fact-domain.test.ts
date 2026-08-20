import assert from "node:assert/strict";
import test from "node:test";
import { FactRepository } from "../db/fact-repositories.ts";
import {
  FACT_CURRENTNESS_STATES,
  FACT_NORMATIVE_STRENGTHS,
  canonicalizeFactJson,
  createFactProvenanceManifest,
  createFactProvenanceSource,
  createFactIdentity,
  createTemporalAssertion,
  provenanceSourceEstablishesAuthority,
} from "../lib/facts/fact-domain.ts";
import {
  createAssertionSourceBinding,
  createSourceIdentity,
  digestFactProvenance,
  bindingEstablishesAuthority,
} from "../lib/provenance/fact-source-binding.ts";
import {
  factIdentityFoundationSchema,
  temporalAssertionFoundationSchema,
} from "../lib/validation.ts";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const FACT_ID = "22222222-2222-4222-8222-222222222222";
const ASSERTION_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE_ID = "44444444-4444-4444-8444-444444444444";
const BINDING_ID = "55555555-5555-4555-8555-555555555555";
const CREATED_AT = "2026-08-20T00:00:00.000Z";

function fact(overrides: Record<string, unknown> = {}) {
  return createFactIdentity({
    id: FACT_ID,
    canonicalKey: "privacy.retention.minimum-period",
    domain: "privacy",
    canonicalLabel: "Minimum retention period",
    normalizedSemanticIdentity: "minimum retention period",
    scopeDiscriminator: "kr:privacy:general",
    createdBy: ACTOR_ID,
    createdAt: CREATED_AT,
    ...overrides,
  });
}

async function assertion(overrides: Record<string, unknown> = {}) {
  return createTemporalAssertion({
    id: ASSERTION_ID,
    factIdentityId: FACT_ID,
    normalizedProposition: "records are retained for the applicable minimum period",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    currentnessState: "CURRENT_VERIFIED",
    qualification: "subject to the governing record category",
    normativeStrength: "STATUTORY_REQUIREMENT",
    provenance: { sources: [provenanceSource()] },
    createdBy: ACTOR_ID,
    createdAt: CREATED_AT,
    ...overrides,
  });
}

test("FactIdentity is stable and independent from source, track, batch, date, and payload", () => {
  const identity = fact();
  assert.equal(identity.id, FACT_ID);
  assert.equal(identity.canonicalKey, "privacy.retention.minimum-period");
  assert.equal("sourceUrl" in identity, false);
  assert.equal("track" in identity, false);
  assert.equal("batch" in identity, false);
  assert.equal("payloadHash" in identity, false);
});

test("FactIdentity requires a non-positional UUID or ULID and explicit scope", () => {
  assert.throws(() => fact({ id: "fact-1" }), /INVALID_FACT_ID/);
  assert.throws(() => fact({ scopeDiscriminator: "" }), /INVALID_SCOPE_DISCRIMINATOR/);
});

test("canonical keys and semantic identities are normalized", () => {
  assert.throws(() => fact({ canonicalKey: "Privacy Key" }), /INVALID_CANONICAL_KEY/);
  assert.throws(
    () => fact({ normalizedSemanticIdentity: "Not Lowercase" }),
    /SEMANTIC_IDENTITY_NOT_NORMALIZED/,
  );
});

test("Currentness uses only the six locked values", async () => {
  assert.equal(FACT_CURRENTNESS_STATES.length, 6);
  await assert.rejects(
    assertion({ currentnessState: "QUESTION_READY" }),
    /INVALID_FACT_CURRENTNESS_STATE/,
  );
});

test("NormativeStrength uses only the seven locked values", async () => {
  assert.equal(FACT_NORMATIVE_STRENGTHS.length, 7);
  await assert.rejects(
    assertion({ normativeStrength: "MANDATORY" }),
    /INVALID_FACT_NORMATIVE_STRENGTH/,
  );
});

test("TemporalAssertion supports open-ended half-open intervals", async () => {
  const value = await assertion();
  assert.equal(value.effectiveTo, null);
  const bounded = await assertion({ effectiveTo: "2027-01-01T00:00:00.000Z" });
  assert.equal(bounded.effectiveTo, "2027-01-01T00:00:00.000Z");
});

test("TemporalAssertion rejects equal and reversed intervals", async () => {
  await assert.rejects(
    assertion({ effectiveTo: "2026-01-01T00:00:00.000Z" }),
    /INVALID_HALF_OPEN_EFFECTIVE_INTERVAL/,
  );
  await assert.rejects(
    assertion({ effectiveTo: "2025-12-31T23:59:59.000Z" }),
    /INVALID_HALF_OPEN_EFFECTIVE_INTERVAL/,
  );
});

test("payload and provenance hashes are deterministic", async () => {
  const first = await assertion();
  const second = await assertion({
    provenance: { sources: [{ ...provenanceSource() }] },
  });
  assert.equal(first.payloadHash, second.payloadHash);
  assert.equal(first.provenanceHash, second.provenanceHash);
});

test("payload hash excludes database identity and timestamps", async () => {
  const first = await assertion();
  const second = await assertion({
    id: "66666666-6666-4666-8666-666666666666",
    createdAt: "2026-08-21T00:00:00.000Z",
  });
  assert.equal(first.payloadHash, second.payloadHash);
  assert.notEqual(first.payloadHash, first.id.replaceAll("-", ""));
});

test("provenance hash is stable across source binding order", async () => {
  const primary = binding({ sourceRole: "PRIMARY_AUTHORITY" });
  const context = binding({
    id: "77777777-7777-4777-8777-777777777777",
    sourceIdentityId: "88888888-8888-4888-8888-888888888888",
    sourceRole: "CONTEXT_SOURCE",
  });
  assert.equal(
    await digestFactProvenance([primary, context]),
    await digestFactProvenance([context, primary]),
  );
});

test("source binding role is orthogonal to taxonomy authority eligibility", () => {
  assert.equal(bindingEstablishesAuthority(binding()), true);
  const context = binding({ sourceRole: "CONTEXT_SOURCE" });
  assert.equal(bindingEstablishesAuthority(context), false);
  assert.equal(
    provenanceSourceEstablishesAuthority(createFactProvenanceSource({
      ...provenanceSource(),
      sourceRole: "CONTEXT_SOURCE",
    })),
    false,
  );
  assert.throws(() => binding({ sourceRole: "OFFICIAL" }), /INVALID_FACT_SOURCE_ROLE/);
});

test("PRIMARY_AUTHORITY rejects commercial, reference-only, and unverified sources", () => {
  for (const classification of [
    { authorityClass: "COMMERCIAL_REFERENCE" },
    { usageFacts: ["REFERENCE_ONLY"] },
    { authenticationState: "UNVERIFIED" },
  ]) {
    assert.throws(
      () => binding({
        verification: verification({
          classification: { ...eligibleClassification(), ...classification },
        }),
      }),
      /FACT_SOURCE_AUTHORITY_NOT_ELIGIBLE/,
    );
  }
});

test("canonical assertion provenance rejects unknown and arbitrary nested fields", async () => {
  await assert.rejects(
    assertion({ provenance: { sources: [provenanceSource()], executable: { command: "run" } } }),
    /INVALID_FACT_PROVENANCE_MANIFEST/,
  );
  await assert.rejects(
    assertion({
      provenance: {
        sources: [{ ...provenanceSource(), verification: { ...verification(), unknown: {} } }],
      },
    }),
    /INVALID_FACT_SOURCE_VERIFICATION/,
  );
});

test("multi-source provenance is deterministic across semantically irrelevant order", async () => {
  const primary = provenanceSource();
  const supporting = provenanceSource({
    sourceIdentityId: "88888888-8888-4888-8888-888888888888",
    sourceRole: "SUPPORTING_AUTHORITY",
    locator: "section:2",
  });
  const context = provenanceSource({
    sourceIdentityId: "99999999-9999-4999-8999-999999999999",
    sourceRole: "CONTEXT_SOURCE",
    locator: "appendix:a",
    verification: verification({
      classification: {
        ...eligibleClassification(),
        authorityClass: "COMMERCIAL_REFERENCE",
        usageFacts: ["REFERENCE_ONLY"],
      },
      reviewDecision: "CONTEXT_ONLY",
    }),
  });
  const first = await assertion({ provenance: { sources: [primary, supporting, context] } });
  const second = await assertion({ provenance: { sources: [context, primary, supporting] } });
  assert.equal(first.provenanceHash, second.provenanceHash);
  assert.equal(first.provenanceJson, second.provenanceJson);
  assert.equal(createFactProvenanceManifest({ sources: [context, primary, supporting] }).sources.length, 3);
});

test("SourceIdentity is a bounded identity record and stores no source prose", () => {
  const source = createSourceIdentity({
    id: SOURCE_ID,
    logicalSourceDocumentId: "kr.law.privacy-act",
    sourceKind: "STATUTE",
    officialTitle: "Privacy Act",
    normalizedIdentity: "kr privacy act",
    issuer: "competent authority",
    jurisdiction: "KR",
    createdBy: ACTOR_ID,
    createdAt: CREATED_AT,
  });
  assert.equal("body" in source, false);
  assert.equal("prose" in source, false);
  assert.ok(Object.isFrozen(source));
});

test("Fact and assertion domain records are frozen append-only values", async () => {
  assert.ok(Object.isFrozen(fact()));
  assert.ok(Object.isFrozen(await assertion()));
});

test("FactRepository exposes exactly the eleven narrow primitives", () => {
  const methods = Object.getOwnPropertyNames(FactRepository.prototype)
    .filter((name) => name !== "constructor")
    .sort();
  assert.deepEqual(methods, [
    "createAssertionSourceBinding",
    "createFactConceptBinding",
    "createFactIdentity",
    "createFactTrackBinding",
    "createSourceIdentity",
    "createTemporalAssertion",
    "findFactByCanonicalKey",
    "getFactIdentity",
    "getTemporalAssertion",
    "listAssertionsForFact",
    "listSourcesForAssertion",
  ]);
  assert.equal(methods.some((name) => /update|delete|approve|activate|import|supersede/i.test(name)), false);
});

test("canonical JSON rejects dangerous or non-deterministic objects", () => {
  assert.throws(() => canonicalizeFactJson({ value: Number.NaN }), /NON_FINITE/);
  assert.throws(
    () => canonicalizeFactJson(Object.create({ inherited: true })),
    /CUSTOM_PROTOTYPE/,
  );
  const accessor = {};
  Object.defineProperty(accessor, "value", { enumerable: true, get: () => 1 });
  assert.throws(() => canonicalizeFactJson(accessor), /ACCESSOR/);
});

test("foundation validation requires explicit scope and valid intervals", () => {
  assert.equal(factIdentityFoundationSchema.safeParse(fact()).success, true);
  assert.equal(
    factIdentityFoundationSchema.safeParse({ ...fact(), scopeDiscriminator: "" }).success,
    false,
  );
  assert.equal(
    temporalAssertionFoundationSchema.safeParse({
      id: ASSERTION_ID,
      factIdentityId: FACT_ID,
      normalizedProposition: "valid proposition",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: "2026-01-01T00:00:00.000Z",
      currentnessState: "CURRENT_VERIFIED",
      normativeStrength: "OFFICIAL_GUIDANCE",
      provenance: { sources: [provenanceSource()] },
      createdBy: ACTOR_ID,
      createdAt: CREATED_AT,
    }).success,
    false,
  );
});

function binding(overrides: Record<string, unknown> = {}) {
  return createAssertionSourceBinding({
    id: BINDING_ID,
    temporalAssertionId: ASSERTION_ID,
    sourceIdentityId: SOURCE_ID,
    sourceRole: "PRIMARY_AUTHORITY",
    sourceVersion: "2026-01",
    sourceHash: "a".repeat(64),
    locator: "article:1",
    verification: verification(),
    createdBy: ACTOR_ID,
    createdAt: CREATED_AT,
    ...overrides,
  });
}

function eligibleClassification(overrides: Record<string, unknown> = {}) {
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

function verification(overrides: Record<string, unknown> = {}) {
  return {
    classification: eligibleClassification(),
    reviewDecision: "ACCEPTED",
    verifiedBy: ACTOR_ID,
    verifiedAt: CREATED_AT,
    retrievedAt: CREATED_AT,
    ...overrides,
  };
}

function provenanceSource(overrides: Record<string, unknown> = {}) {
  return {
    sourceIdentityId: SOURCE_ID,
    sourceRole: "PRIMARY_AUTHORITY",
    sourceVersion: "2026-01",
    sourceHash: "a".repeat(64),
    locator: "article:1",
    verification: verification(),
    ...overrides,
  };
}
