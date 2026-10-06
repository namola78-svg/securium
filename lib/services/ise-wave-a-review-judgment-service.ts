import type { DatabaseProvider } from "../../db/provider/database-provider.ts";
import type { AuthenticatedContentReviewer } from "../policy/content-review-judgment.ts";
import { recordAuthenticatedReviewJudgment, type AuthenticatedContentReviewIntent } from "./content-review-judgment-core.ts";
import { resolveIseWaveAReviewedInputContext } from "./ise-wave-a-reviewed-input-resolver.ts";

/** ISE server boundary fixes the ISE adapter; reviewer intent cannot select a resource. */
export function recordAuthenticatedIseWaveAReviewJudgment(intent: AuthenticatedContentReviewIntent, actor: AuthenticatedContentReviewer, database: DatabaseProvider) {
  return recordAuthenticatedReviewJudgment(intent, actor, database, resolveIseWaveAReviewedInputContext);
}
