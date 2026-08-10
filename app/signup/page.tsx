import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { SignupPanel } from "@/components/signup-panel";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { resolveAuthProvider } from "@/lib/auth-provider";
import { buildSafeRedirectQuery, safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = { title: "회원가입 | SECURIUM", description: "SECURIUM 학습을 시작하세요." };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const requestedReturnTo = firstParam(params.return_to);
  const returnTo = safeAuthReturnPath(requestedReturnTo);
  const error = firstParam(params.error);
  const user = await getOptionalCurrentAppUser();
  if (requestedReturnTo && requestedReturnTo !== returnTo) redirect(`/signup?${buildSafeRedirectQuery({ return_to: returnTo, error })}`);
  if (user) redirect(returnTo);
  if (resolveAuthProvider() === "supabase") return <main className="auth-main"><SignupPanel returnTo={returnTo} error={error}><Link href={`/login?return_to=${encodeURIComponent(returnTo)}`} className="text-link">이미 계정이 있으신가요? 로그인</Link></SignupPanel></main>;
  return <main className="auth-main"><section className="auth-card"><p className="eyebrow">SECURE SIGN UP</p><h1>회원가입</h1><p>현재 환경에서는 Google 계정으로 바로 학습 프로필을 만들 수 있습니다.</p><Link className="button button-dark full-width" href={chatGPTSignInPath(returnTo)}>Google 계정으로 시작하기</Link></section></main>;
}
function firstParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
