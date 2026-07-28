import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignInPath } from "@/app/chatgpt-auth";
import { resolveAuthProvider } from "@/lib/auth-provider";
import { safeAuthReturnPath } from "@/lib/auth-routing";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const returnTo = safeAuthReturnPath(params.return_to);
  const provider = resolveAuthProvider();
  const error = params.error ? String(params.error) : "";

  if (provider === "supabase") {
    return (
      <main className="auth-main">
        <section className="auth-card">
          <p className="eyebrow">ACCOUNT CREATION</p>
          <h1>Create a Supabase Auth account</h1>
          <p>
            New accounts are authenticated by Supabase Auth and then mapped to
            the existing application user and role tables on first access.
          </p>
          {error ? (
            <div className="notice notice-warning">
              Account creation failed. Check the password length and Supabase
              email confirmation settings.
            </div>
          ) : null}
          <form
            className="form-stack"
            action="/api/auth/supabase/signup"
            method="post"
          >
            <input type="hidden" name="returnTo" value={returnTo} />
            <label>
              Display name
              <input
                name="displayName"
                type="text"
                autoComplete="name"
                maxLength={80}
              />
            </label>
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
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <button className="button button-dark full-width" type="submit">
              Create account
            </button>
          </form>
          <Link
            className="text-link"
            href={`/login?return_to=${encodeURIComponent(returnTo)}`}
          >
            Already have an account?
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-main">
      <section className="auth-card">
        <p className="eyebrow">ACCOUNT CREATION</p>
        <h1>No separate password signup is needed here</h1>
        <p>
          This environment delegates identity to the hosting platform. On first
          sign in, the app creates a learner profile with the default USER role.
        </p>
        <div className="notice">
          Supabase Auth signup is enabled when AUTH_PROVIDER is set to
          supabase.
        </div>
        <Link
          className="button button-dark full-width"
          href={chatGPTSignInPath(returnTo)}
        >
          Start with platform sign in
        </Link>
      </section>
    </main>
  );
}
