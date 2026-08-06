import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { resolveAuthProvider } from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = { title: "회원가입" };
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const requestedReturnTo = firstParam(params.return_to);
  const returnTo = safeAuthReturnPath(requestedReturnTo);
  const provider = resolveAuthProvider();
  const error = firstParam(params.error);
  const user = await getOptionalCurrentAppUser();

  if (requestedReturnTo && requestedReturnTo !== returnTo) {
    const canonicalParams = new URLSearchParams({ return_to: returnTo });
    if (error) canonicalParams.set("error", error);
    redirect(`/signup?${canonicalParams.toString()}`);
  }

  if (user) redirect(returnTo);

  if (provider === "supabase") {
    return (
      <main className="auth-main">
        <section className="auth-card">
          <p className="eyebrow">회원가입</p>
          <h1>무료 계정을 만들고 학습을 시작하세요</h1>
          <p>
            학습 진도, 오답노트, AI 튜터 기록을 안전하게 이어갈 수 있도록
            SECURIUM 계정을 준비합니다.
          </p>
          {error ? (
            <div className="notice notice-warning">
              계정 생성에 실패했습니다. 비밀번호 길이와 이메일 인증 설정을
              확인하세요.
            </div>
          ) : null}
          <Link
            className="google-auth-button"
            href={`/api/auth/supabase/oauth/google?return_to=${encodeURIComponent(returnTo)}`}
          >
            <span aria-hidden="true">G</span>
            Google로 시작하기
          </Link>
          <div className="auth-divider" aria-hidden="true">
            <span>또는</span>
          </div>
          <form
            className="form-stack"
            action="/api/auth/supabase/signup"
            method="post"
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            <label>
              표시 이름
              <input
                name="displayName"
                type="text"
                autoComplete="name"
                maxLength={80}
              />
            </label>
            <label>
              이메일
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label>
              비밀번호
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <button className="button button-dark full-width" type="submit">
              계정 만들기
            </button>
          </form>
          <Link
            className="text-link"
            href={`/login?return_to=${encodeURIComponent(returnTo)}`}
          >
            이미 계정이 있으신가요?
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-main">
      <section className="auth-card">
        <p className="eyebrow">회원가입</p>
        <h1>별도 비밀번호 회원가입이 필요하지 않습니다</h1>
        <p>
          현재 환경에서는 플랫폼 로그인을 통해 바로 학습자 프로필을 만들 수
          있습니다.
        </p>
        <div className="notice">
          이메일 회원가입은 운영 인증 설정이 활성화된 환경에서 사용할 수
          있습니다.
        </div>
        <Link
          className="button button-dark full-width"
          href={chatGPTSignInPath(returnTo)}
        >
          Sign in with ChatGPT
        </Link>
      </section>
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
