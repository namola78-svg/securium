import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ISMS_PROFILE_KEYS,
  resolveIsmsProfileApplicability,
  type IsmsProfileRecord,
  type IsmsProfileRequirementMappingRecord,
} from "../lib/isms-profile-domain";

const pendingStrengthened = {
  profileKey: "STRENGTHENED",
  criteriaState: "PENDING_OFFICIAL_CRITERIA",
  lifecycleState: "CURRENT",
  effectiveFrom: null,
  effectiveTo: null,
} as const;

test("profile catalog keys include general, both simplified profiles, and strengthened", () => {
  assert.deepEqual(ISMS_PROFILE_KEYS, [
    "GENERAL",
    "SIMPLIFIED_7_2",
    "SIMPLIFIED_7_3",
    "STRENGTHENED",
  ]);
});

test("pending strengthened profile with zero mappings is not interpreted as not applicable", () => {
  assert.deepEqual(
    resolveIsmsProfileApplicability({
      profile: pendingStrengthened,
      mappings: [],
      standardId: "standard-1",
      asOf: "2026-10-06",
    }),
    { state: "PENDING_OFFICIAL_CRITERIA", profileKey: "STRENGTHENED" },
  );
});

test("current profile with no verified mapping fails closed", () => {
  assert.deepEqual(
    resolveIsmsProfileApplicability({
      profile: { ...pendingStrengthened, profileKey: "GENERAL", criteriaState: "CURRENT_EFFECTIVE" },
      mappings: [],
      standardId: "standard-1",
      asOf: "2026-10-06",
    }),
    { state: "NO_VERIFIED_MAPPING", profileKey: "GENERAL", standardId: "standard-1" },
  );
});

test("resolver returns each explicit applicability state and respects effective interval", () => {
  const profile = { ...pendingStrengthened, profileKey: "GENERAL", criteriaState: "CURRENT_EFFECTIVE" } as const;
  const base = {
    standardId: "standard-1",
    mappingState: "CURRENT" as const,
    effectiveFrom: "2026-01-01",
    effectiveTo: "2027-01-01",
  };
  for (const applicabilityState of ["APPLIES", "NOT_APPLICABLE", "VARIANT"] as const) {
    assert.equal(
      resolveIsmsProfileApplicability({
        profile,
        mappings: [{ ...base, applicabilityState }],
        standardId: "standard-1",
        asOf: "2026-10-06",
      }).state,
      applicabilityState,
    );
  }
  assert.equal(
    resolveIsmsProfileApplicability({
      profile,
      mappings: [{ ...base, applicabilityState: "APPLIES" }],
      standardId: "standard-1",
      asOf: "2027-01-01",
    }).state,
    "NO_VERIFIED_MAPPING",
  );
});

test("duplicate current mappings and unresolved current mappings fail closed", () => {
  const profile = { ...pendingStrengthened, profileKey: "GENERAL", criteriaState: "CURRENT_EFFECTIVE" } as const;
  const mapping = {
    standardId: "standard-1",
    applicabilityState: "APPLIES" as const,
    mappingState: "CURRENT" as const,
    effectiveFrom: null,
    effectiveTo: null,
  };
  const resolve = (mappings: readonly IsmsProfileRequirementMappingRecord[]) => resolveIsmsProfileApplicability({
    profile,
    mappings,
    standardId: "standard-1",
    asOf: "2026-10-06",
  });
  assert.equal(resolve([mapping, mapping]).state, "AMBIGUOUS_MAPPING");
  assert.equal(
    resolve([{ ...mapping, applicabilityState: "UNRESOLVED" }]).state,
    "AMBIGUOUS_MAPPING",
  );
});

test("profile effective interval uses half-open boundaries and fails closed first", () => {
  const currentMapping = {
    standardId: "standard-1",
    applicabilityState: "APPLIES" as const,
    mappingState: "CURRENT" as const,
    effectiveFrom: null,
    effectiveTo: null,
  };
  const resolve = (profile: IsmsProfileRecord, asOf: string) =>
    resolveIsmsProfileApplicability({ profile, mappings: [currentMapping], standardId: "standard-1", asOf });
  const effective = {
    ...pendingStrengthened,
    profileKey: "GENERAL",
    criteriaState: "CURRENT_EFFECTIVE",
    effectiveFrom: "2026-10-06",
    effectiveTo: "2026-11-01",
  } as const;

  assert.equal(resolve(effective, "2026-10-05").state, "PROFILE_NOT_EFFECTIVE");
  assert.equal(resolve(effective, "2026-10-06").state, "APPLIES");
  assert.equal(resolve(effective, "2026-11-01").state, "PROFILE_NOT_EFFECTIVE");
  assert.equal(resolve({ ...effective, effectiveTo: "2026-10-05" }, "2026-10-06").state, "PROFILE_NOT_EFFECTIVE");
});

test("current profile requires its mapping to be effective too", () => {
  const profile = { ...pendingStrengthened, profileKey: "GENERAL", criteriaState: "CURRENT_EFFECTIVE" } as const;
  const result = resolveIsmsProfileApplicability({
    profile,
    mappings: [{ standardId: "standard-1", applicabilityState: "APPLIES", mappingState: "CURRENT", effectiveFrom: "2026-10-07", effectiveTo: null }],
    standardId: "standard-1",
    asOf: "2026-10-06",
  });
  assert.equal(result.state, "NO_VERIFIED_MAPPING");
});

test("profile temporal failure precedes pending criteria while pending remains explicit when effective", () => {
  const expiredPending = { ...pendingStrengthened, effectiveTo: "2026-10-06" };
  assert.equal(resolveIsmsProfileApplicability({ profile: expiredPending, mappings: [], standardId: "standard-1", asOf: "2026-10-06" }).state, "PROFILE_NOT_EFFECTIVE");
  assert.equal(resolveIsmsProfileApplicability({ profile: pendingStrengthened, mappings: [], standardId: "standard-1", asOf: "2026-10-06" }).state, "PENDING_OFFICIAL_CRITERIA");
});

test("canonical Batch 1 lesson identities and source registry remain unchanged", () => {
  const registry = readFileSync("lib/data/isms-p-theory-batch1.mjs", "utf8");
  const manifest = JSON.parse(readFileSync("reports/content-audit/batch1-integration-manifest.json", "utf8"));
  for (const lessonId of [
    "lesson-1-1-1", "lesson-1-3-3", "lesson-2-2-2", "lesson-2-2-6",
    "lesson-2-4-1", "lesson-2-4-2", "lesson-2-4-3", "lesson-2-5-1",
    "lesson-2-5-2", "lesson-2-6-1", "lesson-2-8-3", "lesson-2-9-2",
  ]) {
    assert.ok(registry.includes(lessonId), lessonId);
  }
  assert.equal(manifest.approved_count, 12);
  assert.equal(manifest.expected_content_ids.length, 12);
  assert.ok(!registry.includes("STRENGTHENED"));
});

test("schema carries requirement, authority-chain, history, and deletion safeguards", () => {
  const schema = readFileSync("db/schema.ts", "utf8");
  const migration = readFileSync("drizzle/0047_isms_profile_mapping_foundation.sql", "utf8");
  assert.match(schema, /ismsProfiles = sqliteTable/);
  assert.match(schema, /ismsProfileRequirementMappings = sqliteTable/);
  assert.match(schema, /references\(\(\) => temporalAssertions\.id/);
  assert.match(schema, /references\(\(\) => ismsStandards\.id/);
  assert.match(schema, /supersedesMappingId/);
  assert.match(schema, /PENDING_OFFICIAL_CRITERIA/);
  assert.match(migration, /CREATE TRIGGER "isms_profile_mappings_no_delete"/);
  assert.match(migration, /FOREIGN KEY \(`standard_id`\) REFERENCES `isms_standards`/);
});
