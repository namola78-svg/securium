import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import { assertIseWaveAGovernanceDependencies, buildIseWaveAGovernanceContext } from "./ise-wave-a-reviewed-input-adapter.ts";
import type { ServerOwnedReviewedInputContext } from "./content-review-input-resolver.ts";

export async function resolveIseWaveAReviewedInputContext(database: DatabaseProvider): Promise<ServerOwnedReviewedInputContext> {
  const context = await buildIseWaveAGovernanceContext(database);
  assertIseWaveAGovernanceDependencies(context);
  const reviewed = context.reviewedInput;
  return {
    resourceType: reviewed.resourceType,
    resourceId: reviewed.resourceId,
    scope: reviewed.scope,
    reviewedInputIdentity: reviewed.reviewedInputIdentity,
    reviewedInputSnapshot: reviewed.snapshot,
    subjects: reviewed.subjects.map((subject) => ({
      subjectIdentity: subject.subjectIdentity,
      resourceRevisionId: subject.resourceRevisionId,
      contentSemanticHash: subject.contentSemanticHash,
      semanticOrdinal: subject.semanticOrdinal,
    })),
    requiredDomains: reviewed.requiredDomains,
    requiredReviewerCount: reviewed.requiredReviewerCount,
    riskClass: reviewed.riskClass,
    subjectBindingMode: "EXACT",
  };
}
