import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as taxonomy from "../lib/provenance/source-taxonomy.ts";
import {
  normalizeCurrentnessState,
  normalizeUsageFacts,
  resolveRestrictiveUsageFacts,
  type AuthorityClass,
  type AuthenticationState,
  type BindingRole,
  type CopyrightReviewState,
  type CurrentnessState,
  type IndependenceState,
  type SourceIdentity,
  type SourceLocator,
} from "../lib/provenance/source-taxonomy.ts";

test("authority mapping remains explicit and independent from usage", () => {
  const authority: AuthorityClass = "OFFICIAL_PUBLIC";
  assert.equal(authority, "OFFICIAL_PUBLIC");
  assert.notEqual(authority, "CAN_USE_AS_AUTHORITY");
});

test("usage facts preserve every value", () => {
  assert.deepEqual(
    normalizeUsageFacts([
      "CAN_REFERENCE",
      "USAGE_REVIEW_REQUIRED",
      "DO_NOT_REPUBLISH",
    ]),
    ["DO_NOT_REPUBLISH", "USAGE_REVIEW_REQUIRED", "CAN_REFERENCE"],
  );
});

test("restrictive usage resolution selects the strongest restriction", () => {
  assert.equal(
    resolveRestrictiveUsageFacts([
      "CAN_REFERENCE",
      "USAGE_REVIEW_REQUIRED",
      "DO_NOT_REPUBLISH",
    ]),
    "DO_NOT_REPUBLISH",
  );
});

test("copyright review states remain facts", () => {
  const state: CopyrightReviewState = "APPROVED_FOR_CANONICAL_USE";
  assert.equal(state, "APPROVED_FOR_CANONICAL_USE");
});

test("independence facts do not infer approval from transformation", () => {
  const state: IndependenceState = "REVIEW_REQUIRED";
  assert.equal(state, "REVIEW_REQUIRED");
});

test("all currentness states normalize exactly", () => {
  const states: CurrentnessState[] = [
    "CURRENT",
    "CURRENT_WITH_VERSION_UNCERTAINTY",
    "HISTORICAL",
    "SUPERSEDED",
    "FUTURE_EFFECTIVE",
    "UNKNOWN",
    "REVIEW_REQUIRED",
  ];
  assert.deepEqual(states.map(normalizeCurrentnessState), states);
});

test("historical state is not current", () => {
  assert.equal(normalizeCurrentnessState("HISTORICAL"), "HISTORICAL");
  assert.notEqual(normalizeCurrentnessState("HISTORICAL"), "CURRENT");
});

test("future-effective state remains future-effective", () => {
  assert.equal(normalizeCurrentnessState("FUTURE_EFFECTIVE"), "FUTURE_EFFECTIVE");
});

test("version uncertainty remains distinct from current", () => {
  assert.equal(
    normalizeCurrentnessState("CURRENT_WITH_VERSION_UNCERTAINTY"),
    "CURRENT_WITH_VERSION_UNCERTAINTY",
  );
});

test("authentication does not imply official authority", () => {
  const authority: AuthorityClass = "SUPPLEMENTAL_REFERENCE";
  assert.equal(authority, "SUPPLEMENTAL_REFERENCE");
});

test("binding role is orthogonal to authority", () => {
  const role: BindingRole = "PRIMARY_AUTHORITY";
  const authority: AuthorityClass = "OFFICIAL_PUBLIC";
  assert.equal(role, "PRIMARY_AUTHORITY");
  assert.equal(authority, "OFFICIAL_PUBLIC");
});

test("unknown values fail closed", () => {
  assert.equal(normalizeCurrentnessState("CURRENT-ish"), null);
  assert.equal(normalizeUsageFacts(["UNKNOWN"]), null);
  assert.equal(resolveRestrictiveUsageFacts(null), null);
});

test("SourceIdentity does not include path or ordering identity", () => {
  const identity: SourceIdentity = {
    logicalSourceDocumentId: "source:example:v1",
    sourceSha256: "a".repeat(64),
    issuer: "Example issuer",
    officialTitle: "Example source",
    version: "v1",
    effectiveFrom: null,
    effectiveTo: null,
  };
  assert.equal(identity.logicalSourceDocumentId, "source:example:v1");
  assert.equal("sourcePath" in identity, false);
});

test("SourceLocator supports criterion normalization", () => {
  const locator: SourceLocator = {
    kind: "criterion",
    criterionId: "1.1.1",
    sectionHeading: "Heading",
    pageStart: 1,
    pageEnd: 2,
    documentSubheading: null,
  };
  assert.equal(locator.kind, "criterion");
  assert.equal(locator.pageEnd, 2);
});

test("usage normalization is deterministic and does not mutate input", () => {
  const input = ["CAN_REFERENCE", "DO_NOT_REPUBLISH", "CAN_REFERENCE"] as const;
  const copy = [...input];
  assert.deepEqual(normalizeUsageFacts(input), ["DO_NOT_REPUBLISH", "CAN_REFERENCE"]);
  assert.deepEqual(input, copy);
});

test("malformed and missing values fail closed", () => {
  assert.equal(normalizeUsageFacts([]), null);
  assert.equal(normalizeUsageFacts({}), null);
  assert.equal(normalizeCurrentnessState(null), null);
  assert.equal(normalizeCurrentnessState(undefined), null);
});

test("taxonomy exposes no policy approval helper", () => {
  assert.equal("isWebAllowed" in {}, false);
  assert.equal(
    resolveRestrictiveUsageFacts(["CAN_USE_AS_AUTHORITY"]),
    "CAN_USE_AS_AUTHORITY",
  );
});

test("taxonomy dependency direction remains one-way", () => {
  assert.equal(normalizeCurrentnessState("CURRENT"), "CURRENT");
});

test("public export surface is exactly the frozen runtime and type contract", () => {
  const runtimeExports = Object.keys(taxonomy).sort();
  assert.deepEqual(runtimeExports, [
    "normalizeCurrentnessState",
    "normalizeUsageFacts",
    "resolveRestrictiveUsageFacts",
  ]);

  const source = readFileSync(new URL("../lib/provenance/source-taxonomy.ts", import.meta.url), "utf8");
  const typeExports = [...source.matchAll(/^export type (\w+)/gm)].map(([, name]) => name).sort();
  assert.deepEqual(typeExports, [
    "AuthenticationState",
    "AuthorityClass",
    "BindingRole",
    "CopyrightReviewState",
    "CurrentnessState",
    "IndependenceState",
    "SourceIdentity",
    "SourceLocator",
    "UsageClass",
  ]);
  assert.equal(new Set([...runtimeExports, ...typeExports]).size, 12);
  for (const forbidden of [
    "WEB_ALLOWED",
    "AI_ALLOWED",
    "ASSESSMENT_ALLOWED",
    "PUBLISHING_ALLOWED",
    "CANONICAL_ALLOWED",
    "WRITE_ALLOWED",
  ]) {
    assert.equal(forbidden in taxonomy, false);
  }
});

test("authentication and authority facts remain independent when either changes", () => {
  const baseline: { authority: AuthorityClass; authentication: AuthenticationState } = {
    authority: "UNKNOWN",
    authentication: "UNVERIFIED",
  };
  const authenticated = { ...baseline, authentication: "AUTHENTICATED" as const };
  const official = { ...baseline, authority: "OFFICIAL_PUBLIC" as const };
  const issuerIncomplete = { ...baseline, authentication: "ISSUER_INCOMPLETE" as const };

  assert.equal(authenticated.authority, baseline.authority);
  assert.equal(issuerIncomplete.authority, baseline.authority);
  assert.equal(official.authentication, baseline.authentication);
  assert.notEqual(authenticated.authentication, official.authority);
});

test("transformation metadata cannot derive an independent authoring fact", () => {
  const sourceFact = {
    independence: "REVIEW_REQUIRED" as IndependenceState,
    transformation: "AI_GENERATED",
  };
  const transformed = { ...sourceFact, transformation: "TRANSLATED" };

  assert.equal(sourceFact.independence, "REVIEW_REQUIRED");
  assert.equal(transformed.independence, "REVIEW_REQUIRED");
  assert.notEqual(transformed.independence, "DECLARED_INDEPENDENT");
});

test("each binding role preserves restrictive facts across a bounded cross-product", () => {
  const roles: BindingRole[] = [
    "PRIMARY_AUTHORITY",
    "CURRICULUM_CONTEXT",
    "SUPPLEMENTAL_REFERENCE",
    "REQUIREMENT_REFERENCE",
  ];
  const restrictive = {
    authority: "UNKNOWN" as AuthorityClass,
    usage: "DO_NOT_REPUBLISH" as const,
    copyright: "BLOCKED" as CopyrightReviewState,
    independence: "REAUTHORING_REQUIRED" as IndependenceState,
    currentness: "SUPERSEDED" as CurrentnessState,
    authentication: "UNVERIFIED" as AuthenticationState,
  };

  for (const role of roles) {
    const fact = { role, ...restrictive };
    assert.equal(fact.authority, restrictive.authority);
    assert.equal(fact.usage, restrictive.usage);
    assert.equal(fact.copyright, restrictive.copyright);
    assert.equal(fact.independence, restrictive.independence);
    assert.equal(fact.currentness, restrictive.currentness);
    assert.equal(fact.authentication, restrictive.authentication);
    assert.notEqual(fact.role, "PUBLISHING_ALLOWED");
  }
});

test("source taxonomy imports no ISMS-P consumer and the binding imports taxonomy", () => {
  const taxonomySource = readFileSync(new URL("../lib/provenance/source-taxonomy.ts", import.meta.url), "utf8");
  const bindingSource = readFileSync(
    new URL("../lib/provenance/isms-p-source-binding.ts", import.meta.url),
    "utf8",
  );
  const bindingSpecifier = /(?:\bimport\s+(?:type\s+)?[\s\S]{0,300}?\bfrom\s*|\bimport\s*\(\s*|\bexport\s+[\s\S]{0,300}?\bfrom\s*)["'][^"']*source-taxonomy\.ts["']/;
  const reverseSpecifier = /(?:\bimport\s+(?:type\s+)?[\s\S]{0,300}?\bfrom\s*|\bimport\s*\(\s*|\bexport\s+[\s\S]{0,300}?\bfrom\s*)["'][^"']*isms-p-source-binding\.ts["']/;

  assert.doesNotMatch(taxonomySource, reverseSpecifier);
  assert.match(bindingSource, bindingSpecifier);
  assert.doesNotMatch(bindingSource, reverseSpecifier);
});
