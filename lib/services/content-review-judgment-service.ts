import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import type { AuthenticatedContentReviewer } from "../policy/content-review-judgment.ts";
import { recordAuthenticatedReviewJudgment, type AuthenticatedContentReviewIntent } from "./content-review-judgment-core.ts";
import { resolveSecureCodingReviewedInputContext } from "./secure-coding-reviewed-input-resolver.ts";

export type { AuthenticatedContentReviewIntent } from "./content-review-judgment-core.ts";

/** Legacy Secure Coding entrypoint; isolated from production ISE imports. */
export function recordAuthenticatedContentReviewJudgment(intent: AuthenticatedContentReviewIntent, actor: AuthenticatedContentReviewer, database: DatabaseProvider) {
  return recordAuthenticatedReviewJudgment(intent, actor, database, resolveSecureCodingReviewedInputContext);
}
