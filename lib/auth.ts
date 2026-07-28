import { redirect } from "next/navigation";
import { getChatGPTUser, chatGPTSignInPath } from "@/app/chatgpt-auth";
import { ensureUser, listRoleCodes } from "@/db/repositories";
import { AppError } from "./errors";
import { assertCatalogManager } from "./services/catalog-service";
import { assertQuestionEditor } from "./services/question-workflow-service";

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
};

async function getIdentity() {
  const platformUser = await getChatGPTUser();
  if (platformUser) return platformUser;

  const devEmail =
    process.env.NODE_ENV !== "production"
      ? process.env.DEV_AUTH_EMAIL?.trim().toLowerCase()
      : null;
  if (!devEmail) return null;

  return {
    email: devEmail,
    displayName: "로컬 개발 사용자",
    fullName: null,
  };
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const identity = await getIdentity();
  if (!identity) return null;

  const user = await ensureUser({
    email: identity.email,
    displayName: identity.displayName,
  });
  if (user.status !== "ACTIVE") {
    throw new AppError("비활성화된 사용자입니다.", 403, "USER_INACTIVE");
  }
  const roleCodes = await listRoleCodes(user.id);
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: roleCodes,
  };
}

export async function getOptionalCurrentAppUser(): Promise<AppUser | null> {
  try {
    return await getCurrentAppUser();
  } catch {
    return null;
  }
}

export async function requireCurrentAppUser(returnTo: string) {
  const user = await getCurrentAppUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  return user;
}

export async function requireApiUser() {
  const user = await getCurrentAppUser();
  if (!user) {
    throw new AppError("로그인이 필요합니다.", 401, "UNAUTHENTICATED");
  }
  return user;
}

export async function requireCatalogManager(returnTo?: string) {
  const user = returnTo
    ? await requireCurrentAppUser(returnTo)
    : await requireApiUser();
  try {
    assertCatalogManager(user.roles);
  } catch (error) {
    if (returnTo) redirect("/dashboard?notice=admin-forbidden");
    throw error;
  }
  return user;
}

async function requireRoleSet(
  allowed: string[],
  code: string,
  returnTo?: string,
) {
  const user = returnTo
    ? await requireCurrentAppUser(returnTo)
    : await requireApiUser();
  if (!user.roles.some((role) => allowed.includes(role))) {
    if (returnTo) redirect("/dashboard?notice=admin-forbidden");
    throw new AppError("요청한 관리 권한이 없습니다.", 403, code);
  }
  return user;
}

export async function requireQuestionEditor(returnTo?: string) {
  const user = returnTo
    ? await requireCurrentAppUser(returnTo)
    : await requireApiUser();
  try {
    assertQuestionEditor(user.roles);
  } catch (error) {
    if (returnTo) redirect("/dashboard?notice=admin-forbidden");
    throw error;
  }
  return user;
}

export function requireQuestionReviewer(returnTo?: string) {
  return requireRoleSet(
    ["CONTENT_REVIEWER", "ADMIN", "SUPER_ADMIN"],
    "QUESTION_REVIEW_FORBIDDEN",
    returnTo,
  );
}

export function requireQuestionPublisher(returnTo?: string) {
  return requireRoleSet(
    ["COURSE_MANAGER", "ADMIN", "SUPER_ADMIN"],
    "QUESTION_PUBLISH_FORBIDDEN",
    returnTo,
  );
}

export function requireQuestionAdministrator(returnTo?: string) {
  return requireRoleSet(
    [
      "CONTENT_EDITOR",
      "CONTENT_REVIEWER",
      "COURSE_MANAGER",
      "ADMIN",
      "SUPER_ADMIN",
    ],
    "QUESTION_ADMIN_FORBIDDEN",
    returnTo,
  );
}

export function requireAuditViewer(returnTo?: string) {
  return requireRoleSet(
    ["ADMIN", "SUPER_ADMIN"],
    "AUDIT_VIEW_FORBIDDEN",
    returnTo,
  );
}

export function requireAuditExporter(returnTo?: string) {
  return requireRoleSet(
    ["SUPER_ADMIN"],
    "AUDIT_EXPORT_FORBIDDEN",
    returnTo,
  );
}
