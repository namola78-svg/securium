import { AppError } from "../errors.ts";

export const CPPG_PUBLICATION_GATE_REQUIRED = "CPPG_PUBLICATION_GATE_REQUIRED";

/** Exact, stable identifiers only; labels and titles are deliberately ignored. */
export function isCppgPublicationTarget(identity: {
  courseId?: string | null;
  courseSlug?: string | null;
  courseCode?: string | null;
}): boolean {
  return identity.courseId === "course-cppg" ||
    identity.courseSlug?.trim().toLowerCase() === "cppg" ||
    identity.courseCode?.trim().toUpperCase() === "CPPG";
}

/** Deny only a generic false-to-true visibility transition. */
export function assertGenericCppgPublicationAllowed(
  identity: { courseId?: string | null; courseSlug?: string | null; courseCode?: string | null },
  current: { active?: boolean; published?: boolean },
  requested: { active?: boolean; published?: boolean },
  priorIdentity = identity,
): void {
  const targetsCppg = isCppgPublicationTarget(identity);
  const wasCppg = isCppgPublicationTarget(priorIdentity);
  if (!targetsCppg && !wasCppg) return;
  const elevates = (key: "active" | "published") =>
    current[key] !== true && requested[key] === true;
  const becomesVisibleCppgIdentity = !wasCppg && targetsCppg &&
    requested.active === true && requested.published === true;
  const hidesCppgIdentityWhileVisible = wasCppg && !targetsCppg &&
    requested.active === true && requested.published === true;
  if (elevates("active") || elevates("published") || becomesVisibleCppgIdentity || hidesCppgIdentityWhileVisible) {
    throw new AppError(
      "CPPG publication requires the dedicated canonical publication gate.",
      409,
      CPPG_PUBLICATION_GATE_REQUIRED,
    );
  }
}

export function assertGenericCppgStatusPublicationAllowed(
  identity: { courseId?: string | null; courseSlug?: string | null; courseCode?: string | null },
  currentStatus: string | null | undefined,
  requestedStatus: string,
  publishedStatus: string,
): void {
  if (isCppgPublicationTarget(identity) && currentStatus !== publishedStatus && requestedStatus === publishedStatus) {
    throw new AppError(
      "CPPG publication requires the dedicated canonical publication gate.",
      409,
      CPPG_PUBLICATION_GATE_REQUIRED,
    );
  }
}
