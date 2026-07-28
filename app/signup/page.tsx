import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { resolveAuthProvider } from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const returnTo = safeAuthReturnPath(params.return_to);
  const provider = resolveAuthProvider();
  const error = params.error ? String(params.error) : "";
  const user = await getChatGPTUser();

  if (user) redirect(returnTo);

  if (provider === "supabase") {
    return (
      <main className="auth-main">
        <section className="auth-card">
          <p className="eyebrow">회원가입</p>
          <h1>새 계정을 만드세요</h1>
          <p>
            Supabase Auth로 계정을 만들고, 최초 접속 시 플랫폼의 사용자 및
            권한 구조와 연결합니다.
          </p>
          {error ? (
            <div className="notice notice-warning">
              계정 생성에 실패했습니다. 비밀번호 길이와 이메일 인증 설정을
              확인하세요.
            </div>
          ) : null}
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
          이 환경은 호스팅 플랫폼의 인증을 사용합니다. 최초 로그인 시 기본
          USER 권한의 학습자 프로필이 생성됩니다.
        </p>
        <div className="notice">
          AUTH_PROVIDER가 supabase로 설정된 환경에서 Supabase Auth 회원가입을
          사용할 수 있습니다.
        </div>
        <Link
          className="button button-dark full-width"
          href={chatGPTSignInPath(returnTo)}
        >
          플랫폼 로그인으로 시작하기
        </Link>
      </section>
    </main>
  );
}
