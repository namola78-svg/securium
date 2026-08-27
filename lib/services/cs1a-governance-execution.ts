import { AppError } from "../errors.ts";
import { CS1A_GOVERNANCE_ACTOR_ROLES } from "../policy/cs1a-actor-audit.ts";
import {
  verifyCs1aDecisionSemantics,
  type Cs1aExecutionVerificationInput,
  type VerifiedCs1aDecisionSemantics,
} from "../policy/cs1a-governance-execution.ts";

export type Cs1aServerApplicationUser = Readonly<{
  id: string;
  email: string;
  displayName: string;
  status: string;
  roles: readonly string[];
}>;

export type Cs1aServerIdentityResolver = () => Promise<Readonly<{
  email: string;
  displayName: string;
}>>;

export type VerifiedCs1aGovernanceExecutionContext = Readonly<{
  semantic: VerifiedCs1aDecisionSemantics;
  actorSource: "SERVER_AUTHENTICATED";
  authorizationSource: "SERVER_DATABASE_AUTHORITY";
  applicationUser: Cs1aServerApplicationUser;
  authorizedRoles: readonly string[];
}>;

export type Cs1aGovernanceExecutionDependencies = Readonly<{
  resolveIdentity: Cs1aServerIdentityResolver;
  resolveApplicationUser: (email: string) => Promise<Cs1aServerApplicationUser | null>;
}>;

export async function verifyCs1aGovernanceExecution(
  input: Cs1aExecutionVerificationInput,
  dependencies: Cs1aGovernanceExecutionDependencies = defaultDependencies(),
): Promise<VerifiedCs1aGovernanceExecutionContext> {
  const semantic = verifyCs1aDecisionSemantics(input);
  let identity: Readonly<{ email: string; displayName: string }>;
  try {
    identity = await dependencies.resolveIdentity();
  } catch {
    throw new AppError("Authenticated identity is required.", 401, "CS1A_EXECUTION_UNAUTHENTICATED");
  }
  if (!identity?.email?.trim()) {
    throw new AppError("Authenticated identity is required.", 401, "CS1A_EXECUTION_UNAUTHENTICATED");
  }

  const applicationUser = await dependencies.resolveApplicationUser(identity.email);
  if (!applicationUser) {
    throw new AppError("Governance application user was not found.", 403, "CS1A_EXECUTION_APPLICATION_USER_NOT_FOUND");
  }
  if (applicationUser.status !== "ACTIVE") {
    throw new AppError("Governance application user is inactive.", 403, "CS1A_EXECUTION_USER_INACTIVE");
  }
  const authorizedRoles = applicationUser.roles.filter((role) =>
    CS1A_GOVERNANCE_ACTOR_ROLES.includes(role as (typeof CS1A_GOVERNANCE_ACTOR_ROLES)[number]),
  );
  if (authorizedRoles.length === 0) {
    throw new AppError("Governance authorization is required.", 403, "CS1A_EXECUTION_GOVERNANCE_ROLE_REQUIRED");
  }

  return Object.freeze({
    semantic,
    actorSource: "SERVER_AUTHENTICATED",
    authorizationSource: "SERVER_DATABASE_AUTHORITY",
    applicationUser: Object.freeze({ ...applicationUser, roles: Object.freeze([...applicationUser.roles]) }),
    authorizedRoles: Object.freeze([...authorizedRoles]),
  });
}

function defaultDependencies(): Cs1aGovernanceExecutionDependencies {
  return {
    async resolveIdentity() {
      const { getChatGPTUser } = await import("../../app/chatgpt-auth.ts");
      const identity = await getChatGPTUser();
      if (!identity) throw new AppError("Authenticated identity is required.", 401, "CS1A_EXECUTION_UNAUTHENTICATED");
      return identity;
    },
    async resolveApplicationUser(email) {
      const { findUserWithRoleCodesByEmail } = await import("../../db/repositories.ts");
      return findUserWithRoleCodesByEmail(email);
    },
  };
}
