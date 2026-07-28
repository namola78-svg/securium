import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { resolveAuthProvider } from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = { title: "Login" };

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
          <p className="eyebrow">SECURE SIGN IN</p>
          <h1>Sign in to continue learning</h1>
          <p>
            Use the Supabase Auth account connected to this deployment. Session
            tokens are stored in HttpOnly cookies, while roles stay in the
            existing platform RBAC tables.
          </p>
          {error ? (
            <div className="notice notice-warning">
              Sign in failed. Check your email, password, and Supabase Auth
              settings.
            </div>
          ) : null}
          {notice === "confirm_email" ? (
            <div className="notice">
              Check your email to confirm the new account before signing in.
            </div>
          ) : null}
          <form
            className="form-stack"
            action="/api/auth/supabase/login"
            method="post"
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
              />
            </label>
            <button className="button button-dark full-width" type="submit">
              Sign in
            </button>
          </form>
          <Link
            className="text-link"
            href={`/signup?return_to=${encodeURIComponent(returnTo)}`}
          >
            Create an account
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-main">
      <section className="auth-card">
        <p className="eyebrow">SECURE SIGN IN</p>
        <h1>Continue learning</h1>
        <p>
          This environment uses the platform Sign in with ChatGPT flow. The
          application does not store passwords or OAuth secrets.
        </p>
        <Link
          className="button button-dark full-width"
          href={chatGPTSignInPath(returnTo)}
        >
          ChatGPT로 안전하게 로그인
        </Link>
        <p className="auth-note">
          A minimal learner profile is created automatically on first sign in.
        </p>
        <Link className="text-link" href="/signup">
          Account creation guide
        </Link>
      </section>
    </main>
  );
}
