export const ISMS_PROFILE_KEYS = [
  "GENERAL",
  "SIMPLIFIED_7_2",
  "SIMPLIFIED_7_3",
  "STRENGTHENED",
] as const;

export type IsmsProfileKey = (typeof ISMS_PROFILE_KEYS)[number] | (string & {});
export type IsmsProfileCriteriaState =
  | "CURRENT_EFFECTIVE"
  | "PENDING_OFFICIAL_CRITERIA"
  | "SUPERSEDED"
  | "NOT_APPLICABLE"
  | "UNRESOLVED";
export type IsmsProfileMappingApplicability =
  | "APPLIES"
  | "NOT_APPLICABLE"
  | "VARIANT"
  | "UNRESOLVED";

export interface IsmsProfileRecord {
  profileKey: IsmsProfileKey;
  criteriaState: IsmsProfileCriteriaState;
  lifecycleState: "CURRENT" | "SUPERSEDED" | "INACTIVE";
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface IsmsProfileRequirementMappingRecord {
  standardId: string;
  applicabilityState: IsmsProfileMappingApplicability;
  mappingState: "CURRENT" | "PENDING" | "SUPERSEDED";
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export type IsmsProfileApplicabilityResolution =
  | { state: "PENDING_OFFICIAL_CRITERIA"; profileKey: IsmsProfileKey }
  | { state: "PROFILE_UNAVAILABLE"; profileKey: IsmsProfileKey }
  | { state: "PROFILE_NOT_EFFECTIVE"; profileKey: IsmsProfileKey }
  | { state: "NO_VERIFIED_MAPPING"; profileKey: IsmsProfileKey; standardId: string }
  | { state: "AMBIGUOUS_MAPPING"; profileKey: IsmsProfileKey; standardId: string }
  | {
      state: IsmsProfileMappingApplicability;
      profileKey: IsmsProfileKey;
      standardId: string;
    };

function coversDate(
  mapping: IsmsProfileRequirementMappingRecord,
  asOf: string,
): boolean {
  return (
    (mapping.effectiveFrom === null || mapping.effectiveFrom <= asOf) &&
    (mapping.effectiveTo === null || asOf < mapping.effectiveTo)
  );
}

/** Resolve fail-closed. An empty pending profile never means requirements do not apply. */
export function resolveIsmsProfileApplicability(input: {
  profile: IsmsProfileRecord | null;
  mappings: readonly IsmsProfileRequirementMappingRecord[];
  standardId: string;
  asOf: string;
}): IsmsProfileApplicabilityResolution {
  const { profile, mappings, standardId, asOf } = input;
  if (!profile || profile.lifecycleState !== "CURRENT") {
    return {
      state: "PROFILE_UNAVAILABLE",
      profileKey: profile?.profileKey ?? "UNRESOLVED",
    };
  }
  if (
    (profile.effectiveFrom !== null && profile.effectiveTo !== null && profile.effectiveTo <= profile.effectiveFrom) ||
    (profile.effectiveFrom !== null && asOf < profile.effectiveFrom) ||
    (profile.effectiveTo !== null && asOf >= profile.effectiveTo)
  ) {
    return { state: "PROFILE_NOT_EFFECTIVE", profileKey: profile.profileKey };
  }
  if (profile.criteriaState === "PENDING_OFFICIAL_CRITERIA") {
    return { state: "PENDING_OFFICIAL_CRITERIA", profileKey: profile.profileKey };
  }
  if (profile.criteriaState !== "CURRENT_EFFECTIVE") {
    return {
      state: "PROFILE_UNAVAILABLE",
      profileKey: profile.profileKey,
    };
  }
  const active = mappings.filter(
    (mapping) =>
      mapping.standardId === standardId &&
      mapping.mappingState === "CURRENT" &&
      coversDate(mapping, asOf),
  );
  if (active.length === 0) {
    return { state: "NO_VERIFIED_MAPPING", profileKey: profile.profileKey, standardId };
  }
  if (active.length !== 1 || active[0].applicabilityState === "UNRESOLVED") {
    return { state: "AMBIGUOUS_MAPPING", profileKey: profile.profileKey, standardId };
  }
  return {
    state: active[0].applicabilityState,
    profileKey: profile.profileKey,
    standardId,
  };
}
