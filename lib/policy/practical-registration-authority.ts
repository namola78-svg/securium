import { AppError } from "../errors.ts";

export const PRACTICAL_SERVER_AUTHORITY_REQUIRED = "PRACTICAL_SERVER_AUTHORITY_REQUIRED";

/**
 * Runtime Authority V1 only authorizes COURSE_THEORY_DRAFT. Until it supports
 * practical writes, every practical registration or governance mutation is
 * denied. Caller review, rights, lifecycle and replay claims are not authority.
 * This check deliberately accepts no caller-supplied resolver or approval.
 */
export function requirePracticalServerAuthority(): void {
  throw new AppError(
    `${PRACTICAL_SERVER_AUTHORITY_REQUIRED}: Server-owned practical authorization is unavailable.`,
    503,
    PRACTICAL_SERVER_AUTHORITY_REQUIRED,
  );
}
