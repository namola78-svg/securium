import { AppError } from "../errors.ts";

export type AdminBootstrapIdentity = {
  email: string;
  displayName: string;
};

export function validateAdminBootstrapIdentity(input: {
  email?: string;
  displayName?: string;
}): AdminBootstrapIdentity {
  const email = input.email?.trim().toLowerCase() ?? "";
  const displayName =
    input.displayName?.trim().replace(/\s+/g, " ") ??
    "Initial Super Administrator";

  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    /[\u0000-\u001f\u007f]/.test(email)
  ) {
    throw bootstrapError(
      "ADMIN_BOOTSTRAP_EMAIL must be a valid email address.",
      "ADMIN_BOOTSTRAP_EMAIL_INVALID",
    );
  }
  if (
    displayName.length < 2 ||
    displayName.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(displayName)
  ) {
    throw bootstrapError(
      "ADMIN_BOOTSTRAP_DISPLAY_NAME is invalid.",
      "ADMIN_BOOTSTRAP_DISPLAY_NAME_INVALID",
    );
  }
  return { email, displayName };
}

export function assertFirstSuperAdminCanBeCreated(
  activeSuperAdminCount: number,
) {
  if (!Number.isSafeInteger(activeSuperAdminCount) || activeSuperAdminCount < 0) {
    throw bootstrapError(
      "The active super administrator count is invalid.",
      "ADMIN_BOOTSTRAP_STATE_INVALID",
    );
  }
  if (activeSuperAdminCount > 0) {
    throw bootstrapError(
      "An active super administrator already exists.",
      "ADMIN_BOOTSTRAP_ALREADY_COMPLETE",
    );
  }
}

export function assertSuperAdminRoleChangeAllowed(input: {
  activeSuperAdminCount: number;
  targetIsActiveSuperAdmin: boolean;
  removesSuperAdminRole: boolean;
  suspendsTarget: boolean;
}) {
  if (!input.targetIsActiveSuperAdmin) return;
  if (!input.removesSuperAdminRole && !input.suspendsTarget) return;
  if (input.activeSuperAdminCount <= 1) {
    throw bootstrapError(
      "The last active super administrator cannot be removed or suspended.",
      "LAST_SUPER_ADMIN_PROTECTED",
    );
  }
}

function bootstrapError(message: string, code: string) {
  return new AppError(message, 409, code);
}
