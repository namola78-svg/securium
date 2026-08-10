import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getSupabaseAuthenticatedIdentity,
  getSupabaseSessionCookieIdentity,
  resolveAuthProvider,
} from "@/lib/auth-provider";
import { authApiRedirectHref, authRedirectHref, safeAuthReturnPath } from "@/lib/auth-routing";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  if (resolveAuthProvider() === "supabase") {
    return getSupabaseAuthenticatedIdentity();
  }

  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

export async function getChatGPTUserForDisplay(): Promise<ChatGPTUser | null> {
  if (resolveAuthProvider() === "supabase") {
    return getSupabaseSessionCookieIdentity();
  }

  return getChatGPTUser();
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeAuthReturnPath(returnTo, "/");
  if (resolveAuthProvider() === "supabase") {
    return authRedirectHref("/login", safeReturnTo);
  }
  return authApiRedirectHref(SIGN_IN_PATH, safeReturnTo, "/");
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeAuthReturnPath(returnTo, "/");
  if (resolveAuthProvider() === "supabase") {
    return authApiRedirectHref("/api/auth/supabase/logout", safeReturnTo, "/");
  }
  return authApiRedirectHref(SIGN_OUT_PATH, safeReturnTo, "/");
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
