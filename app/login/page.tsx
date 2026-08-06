import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { LoginPanel } from "@/components/login-panel";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { resolveAuthProvider } from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = {
  title: "로그인",
  description: "시큐리움 | SECURIUM 계정으로 학습 기록을 이어서 확인하세요.",
};
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const requestedReturnTo = firstParam(params.return_to);
  const returnTo = safeAuthReturnPath(requestedReturnTo);
  const provider = resolveAuthProvider();
  const error = firstParam(params.error);
  const notice = firstParam(params.notice);
  const user = await getOptionalCurrentAppUser();

  if (requestedReturnTo && requestedReturnTo !== returnTo) {
    const canonicalParams = new URLSearchParams({ return_to: returnTo });
    if (error) canonicalParams.set("error", error);
    if (notice) canonicalParams.set("notice", notice);
    redirect(`/login?${canonicalParams.toString()}`);
  }

  if (user) redirect(returnTo);

  if (provider === "supabase") {
    return (
      <main className="auth-main">
        <LoginPanel returnTo={returnTo} error={error} notice={notice} />
      </main>
    );
  }

  return (
    <main className="auth-main">
      <section className="auth-card auth-card-polished">
        <div className="auth-brand-lockup">
          <span className="auth-logo-mark" aria-hidden="true">
            S
          </span>
          <div>
            <strong>시큐리움 | SECURIUM</strong>
            <span>AI 통합 학습 플랫폼</span>
          </div>
        </div>
        <p className="eyebrow">SECURE SIGN IN</p>
        <h1>다시 만나서 반갑습니다</h1>
        <p className="auth-description">
          현재 환경은 플랫폼 로그인을 사용합니다. 학습 진도와 권한 정보는
          SECURIUM RBAC 구조에서 관리됩니다.
        </p>
        <Link
          className="button button-dark full-width"
          href={chatGPTSignInPath(returnTo)}
        >
          Sign in with ChatGPT
        </Link>
        <p className="auth-note">
          최초 로그인 시 기본 학습 프로필이 자동으로 생성됩니다.
        </p>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
