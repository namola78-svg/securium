import { sha256Canonical } from "../policy/stable-canonical-hash.ts";

export const CONTENT_REVISION_REGISTRATION_V1 = "CONTENT_REVISION_REGISTRATION_V1" as const;
export const REGISTERED_REVIEW_PENDING = "REGISTERED_REVIEW_PENDING" as const;
export const REVIEW_REQUIRED = "REVIEW_REQUIRED" as const;
export const OWNER_ATTESTATION_REQUIRED = "OWNER_ATTESTATION_REQUIRED" as const;

export type RegistrationSourceBinding = Readonly<{
  sourceIdentityId: string;
  canonicalKey: string;
  sourceType: string;
  normalizedIdentity: string;
  lifecycleState: "ACTIVE";
  bindingRole: "SCOPE_REFERENCE";
  locator: string;
  expressionReuse: "NOT_USED";
}>;

export type RegistrationSubjectInput = Readonly<{
  semanticRevisionId: string;
  contentId: string;
  contentType: "LESSON";
  version: "1";
  contentHash: string;
  snapshotJson: string;
  sourceLineage: string;
  sourceBindings: readonly RegistrationSourceBinding[];
  rightsState: typeof REVIEW_REQUIRED;
  originalityState: typeof REVIEW_REQUIRED;
  currentnessState: typeof REVIEW_REQUIRED;
  responsibleOwnerState: typeof OWNER_ATTESTATION_REQUIRED;
}>;

export type ContentRevisionRegistrationInput = Readonly<{
  actorUserId: string;
  resourceType: string;
  qualificationId: string;
  packageKey: string;
  subjects: readonly RegistrationSubjectInput[];
  idempotencyKey?: string | null;
}>;

export type RegistrationIdentitySet = Readonly<{
  packageSemanticIdentity: string;
  provenanceAggregateIdentity: string;
  registrationSemanticIdentity: string;
  subjectProvenanceIdentities: Readonly<Record<string, string>>;
}>;

export async function buildRegistrationIdentities(
  input: Pick<ContentRevisionRegistrationInput, "resourceType" | "qualificationId" | "packageKey" | "subjects">,
): Promise<RegistrationIdentitySet> {
  const subjects = [...input.subjects].sort((a, b) => a.semanticRevisionId.localeCompare(b.semanticRevisionId));
  const subjectProvenanceIdentities: Record<string, string> = {};
  for (const subject of subjects) {
    subjectProvenanceIdentities[subject.semanticRevisionId] = await sha256Canonical({
      contractVersion: CONTENT_REVISION_REGISTRATION_V1,
      semanticRevisionId: subject.semanticRevisionId,
      contentHash: subject.contentHash,
      qualificationId: input.qualificationId,
      packageKey: input.packageKey,
      sourceLineage: subject.sourceLineage,
      sourceBindings: [...subject.sourceBindings].sort(sourceBindingSort).map((binding) => ({
        sourceIdentityId: binding.sourceIdentityId,
        canonicalKey: binding.canonicalKey,
        sourceType: binding.sourceType,
        normalizedIdentity: binding.normalizedIdentity,
        lifecycleState: binding.lifecycleState,
        bindingRole: binding.bindingRole,
        locator: binding.locator,
        expressionReuse: binding.expressionReuse,
      })),
      rightsState: subject.rightsState,
      originalityState: subject.originalityState,
      currentnessState: subject.currentnessState,
      responsibleOwnerState: subject.responsibleOwnerState,
    });
  }
  const subjectSet = subjects.map((subject) => ({
    semanticRevisionId: subject.semanticRevisionId,
    contentHash: subject.contentHash,
    provenanceIdentity: subjectProvenanceIdentities[subject.semanticRevisionId],
  }));
  const provenanceAggregateIdentity = await sha256Canonical({
    contractVersion: CONTENT_REVISION_REGISTRATION_V1,
    packageKey: input.packageKey,
    subjectProvenanceIdentities: subjects.map((subject) => subjectProvenanceIdentities[subject.semanticRevisionId]).sort(),
  });
  const packageSemanticIdentity = await sha256Canonical({
    contractVersion: CONTENT_REVISION_REGISTRATION_V1,
    qualificationId: input.qualificationId,
    packageKey: input.packageKey,
    subjects: subjectSet,
  });
  const registrationSemanticIdentity = await sha256Canonical({
    contractVersion: CONTENT_REVISION_REGISTRATION_V1,
    resourceType: input.resourceType,
    qualificationId: input.qualificationId,
    packageSemanticIdentity,
    provenanceAggregateIdentity,
  });
  return { packageSemanticIdentity, provenanceAggregateIdentity, registrationSemanticIdentity, subjectProvenanceIdentities };
}

function sourceBindingSort(a: RegistrationSourceBinding, b: RegistrationSourceBinding) {
  return [a.sourceIdentityId, a.bindingRole, a.locator].join("\u0000").localeCompare([b.sourceIdentityId, b.bindingRole, b.locator].join("\u0000"));
}
