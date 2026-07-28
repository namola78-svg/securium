import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { resolveAuthProvider } from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = { title: "로그인" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const returnTo = safeAuthReturnPath(params.return_to);
  const provider = resolveAuthProvider();
  const error = params.error ? String(params.error) : "";
  const notice = params.notice ? String(params.notice) : "";

  if (provider === "supabase") {
    return (
      <main className="auth-main">
        <section className="auth-card">
          <p className="eyebrow">로그인</p>
          <h1>학습을 계속하려면 로그인하세요</h1>
          <p>
            Supabase Auth 계정으로 안전하게 로그인합니다. 세션은 HttpOnly
            쿠키로 보호되며, 사용자 권한은 플랫폼 RBAC 구조에서 관리됩니다.
          </p>
          {error ? (
            <div className="notice notice-warning">
              로그인에 실패했습니다. 이메일과 비밀번호를 다시 확인하세요.
            </div>
          ) : null}
          {notice === "confirm_email" ? (
            <div className="notice">
              가입한 이메일에서 인증을 완료한 뒤 로그인하세요.
            </div>
          ) : null}
          <form
            className="form-stack"
            action="/api/auth/supabase/login"
            method="post"
          >
            <input type="hidden" name="returnTo" value={returnTo} />
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
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <button className="button button-dark full-width" type="submit">
              로그인
            </button>
          </form>
          <Link
            className="text-link"
            href={`/signup?return_to=${encodeURIComponent(returnTo)}`}
          >
            계정 만들기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-main">
      <section className="auth-card">
        <p className="eyebrow">로그인</p>
        <h1>학습을 계속하려면 로그인하세요</h1>
        <p>
          이 환경은 플랫폼 로그인 흐름을 사용합니다. 애플리케이션은 비밀번호나
          OAuth 비밀값을 저장하지 않습니다.
        </p>
        <Link
          className="button button-dark full-width"
          href={chatGPTSignInPath(returnTo)}
        >
          ChatGPT로 안전하게 로그인
        </Link>
        <p className="auth-note">
          최초 로그인 시 기본 학습자 프로필이 자동 생성됩니다.
        </p>
        <Link className="text-link" href="/signup">
          계정 생성 안내
        </Link>
      </section>
    </main>
  );
}
