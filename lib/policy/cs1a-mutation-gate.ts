import { AppError } from "../errors.ts";
import type {
  Cs1aOperation,
  Cs1aPolicyRequest,
} from "./cs1a-contract.ts";
import { evaluateCs1aPolicy } from "./cs1a-policy.ts";

export function assertCs1aMutationAllowed(
  request: Cs1aPolicyRequest | undefined,
  operation: Cs1aOperation,
) {
  const decision = evaluateCs1aPolicy(
    request ? { ...request, operation } : undefined,
  );
  if (
    decision.decision !== "ALLOW_DRAFT" ||
    !decision.canonicalMutationAllowed ||
    operation === "PUBLICATION"
  ) {
    throw new AppError(
      "Canonical mutation was denied by CS-1A.",
      403,
      `CS1A_${decision.reasonCode}`,
    );
  }
  return decision;
}

export function assertCs1aPublicationAllowed(request: Cs1aPolicyRequest | undefined) {
  const decision = evaluateCs1aPolicy(
    request ? { ...request, operation: "PUBLICATION" } : undefined,
  );
  if (decision.decision !== "ALLOW_PUBLICATION" || !decision.publicationAllowed) {
    throw new AppError("Canonical publication requires a separate governed permission.", 403, `CS1A_${decision.reasonCode}`);
  }
  return decision;
}
