import { AppError } from "../lib/errors.ts";
import {
  assertTheoryRevisionCandidate,
  type GovernedTheoryRevisionCandidate,
} from "../lib/services/content-revision-service.ts";
import type { DatabaseProvider } from "./provider/database-provider.ts";

export type GovernedTheoryRevisionOutcome =
  | "NEW_SUCCESS"
  | "EXACT_REPLAY"
  | "CONFLICT"
  | "NEW_REVISION_REQUIRED";

export type GovernedTheoryRevisionResult = Readonly<{
  outcome: GovernedTheoryRevisionOutcome;
  canonicalKey: string;
  revisionId: string;
  semanticHash: string;
  lifecycle: "CANONICAL_UNPUBLISHED";
}>;

export async function saveGovernedTheoryRevision(
  candidate: GovernedTheoryRevisionCandidate,
  actorUserId: string,
  database: DatabaseProvider,
): Promise<GovernedTheoryRevisionResult> {
  assertTheoryRevisionCandidate(candidate, actorUserId);
  // The current contract requires human review and PASS_ORIGINAL claims but has
  // no compatible server-owned resolver for this exact theory candidate. The
  // fixed Secure Coding and ISE reviewed inputs cannot attest to this payload.
  // Keep the legacy signature, and deny before any canonical persistence;
  // these claims have no candidate-only representation in this write contract.
  void database;
  throw new AppError(
    "Theory revisions require server-verified review authority for the exact semantic payload.",
    409,
    "THEORY_SERVER_REVIEW_AUTHORITY_REQUIRED",
  );
}
