import type { AuthenticatedApplicationIdentity } from "../auth-provider.ts";
import { getChatGPTApplicationIdentity, getChatGPTUser } from "../../app/chatgpt-auth.ts";
import { AppError } from "../errors.ts";
import { findUserWithRoleCodesById } from "../../db/application-user-auth-repository.ts";
import { resolveVerifiedApplicationActor } from "./resolve-verified-application-actor.ts";

export type ProductionApplicationUser = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
};

/** Production auth entrypoint. Trusted identity and database sources stay module-owned. */
export async function resolveProductionApplicationAuth(): Promise<ProductionApplicationUser | null> {
  return resolveProductionApplicationAuthInternal();
}

async function resolveProductionApplicationAuthInternal(): Promise<ProductionApplicationUser | null> {
  const identity: AuthenticatedApplicationIdentity | null = await getChatGPTApplicationIdentity();
  if (!identity) {
    if (await getChatGPTUser()) {
      throw new AppError("Authenticated identity binding is required.", 403, "AUTH_IDENTITY_BINDING_REQUIRED");
    }
    return null;
  }

  const actor = await resolveVerifiedApplicationActor(identity.authTuple);
  if (!actor) {
    throw new AppError("Authenticated identity binding is required.", 403, "AUTH_IDENTITY_BINDING_REQUIRED");
  }

  const user = await findUserWithRoleCodesById(actor.userId);
  if (!user || user.status !== "ACTIVE") {
    throw new AppError("Authenticated application user is inactive or unavailable.", 403, "USER_INACTIVE");
  }
  return { id: user.id, email: user.email, displayName: user.displayName, roles: user.roles };
}
