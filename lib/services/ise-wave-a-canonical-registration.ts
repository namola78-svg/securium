import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import {
  buildRegistrationIdentities,
  type ContentRevisionRegistrationInput,
  type RegistrationSourceBinding,
} from "./content-revision-registration.ts";
import { buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories } from "./ise-wave-a-canonical-repository-adapter.ts";
import { persistContentRevisionRegistration, type RegistrationReadback } from "../../db/content-revision-registration-repository.ts";

export const ISE_WAVE_A_REGISTRATION_RESOURCE_TYPE = "ISE_WAVE_A_LESSON_PACKAGE" as const;

/**
 * Server-owned adapter: caller supplies only the authenticated actor. All
 * qualification, revision, hash, source, and provenance facts are rebuilt.
 */
export async function buildIseWaveACanonicalRegistrationInput(
  database: Pick<DatabaseProvider, "query" | "queryOne" | "execute">,
  actorUserId: string,
  idempotencyKey?: string | null,
): Promise<ContentRevisionRegistrationInput & Awaited<ReturnType<typeof buildRegistrationIdentities>>> {
  if (!actorUserId || actorUserId.trim() === "") throw new Error("ISE_WAVE_A_REGISTRATION_ACTOR_REQUIRED");
  const state = await buildIseWaveACanonicalRevisionProvenanceFromCanonicalRepositories(database);
  if (state.readiness !== "CANONICAL_REVISION_PROVENANCE_READY_FOR_REVIEW") throw new Error(`ISE_WAVE_A_REGISTRATION_NOT_READY:${state.blockingReasons.join(",")}`);
  const subjects = state.revisions.map((revision) => ({
    semanticRevisionId: revision.semanticId,
    contentId: revision.registrationPayload.contentId,
    contentType: "LESSON" as const,
    version: "1" as const,
    contentHash: revision.contentHash,
    snapshotJson: revision.registrationPayload.snapshotJson,
    sourceLineage: revision.provenance.sourceLineage,
    sourceBindings: revision.provenance.sourceBindings.filter((source) => source.role === "SCOPE_REFERENCE").map((source): RegistrationSourceBinding => ({
      sourceIdentityId: source.sourceIdentityId,
      canonicalKey: source.canonicalKey,
      sourceType: source.sourceType,
      normalizedIdentity: source.normalizedIdentity,
      lifecycleState: "ACTIVE",
      bindingRole: "SCOPE_REFERENCE",
      locator: source.locator,
      expressionReuse: "NOT_USED",
    })),
    rightsState: revision.provenance.rightsState,
    originalityState: revision.provenance.rightsState,
    currentnessState: revision.provenance.currentnessState,
    responsibleOwnerState: revision.provenance.responsibleOwnerState,
  }));
  const base = { actorUserId, resourceType: ISE_WAVE_A_REGISTRATION_RESOURCE_TYPE, qualificationId: state.qualification, packageKey: state.packageId, subjects, idempotencyKey } satisfies ContentRevisionRegistrationInput;
  return { ...base, ...await buildRegistrationIdentities(base) };
}

export async function registerIseWaveACanonicalRevisions(
  database: DatabaseProvider,
  actorUserId: string,
  idempotencyKey?: string | null,
): Promise<{ outcome: "NEW_SUCCESS" | "EXACT_REPLAY"; registration: RegistrationReadback }> {
  const input = await buildIseWaveACanonicalRegistrationInput(database, actorUserId, idempotencyKey);
  return persistContentRevisionRegistration(database, input);
}
