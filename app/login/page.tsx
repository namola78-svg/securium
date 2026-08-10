import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { LoginPanel } from "@/components/login-panel";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { resolveAuthProvider } from "@/lib/auth-provider";
import { buildSafeRedirectQuery, safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = { title: "로그인 | SECURIUM", description: "SECURIUM에서 학습을 이어가세요." };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const requestedReturnTo = firstParam(params.return_to);
  const returnTo = safeAuthReturnPath(requestedReturnTo);
  const error = firstParam(params.error);
  const notice = firstParam(params.notice);
  const user = await getOptionalCurrentAppUser();
  if (requestedReturnTo && requestedReturnTo !== returnTo) redirect(`/login?${buildSafeRedirectQuery({ return_to: returnTo, error, notice })}`);
  if (user) redirect(returnTo);
  if (resolveAuthProvider() === "supabase") return <main className="auth-main"><LoginPanel returnTo={returnTo} error={error} notice={notice} /></main>;
  return <main className="auth-main"><section className="auth-card auth-card-polished"><p className="eyebrow">SECURE SIGN IN</p><h1>로그인</h1><p className="auth-description">현재 환경에서는 Google 계정으로 바로 학습을 시작할 수 있습니다.</p><Link className="button button-dark full-width" href={chatGPTSignInPath(returnTo)}>Google 계정으로 로그인</Link><p className="auth-note">계정이 없으면 로그인 과정에서 새 계정을 만들 수 있습니다.</p></section></main>;
}
function firstParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
