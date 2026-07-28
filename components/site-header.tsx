import Link from "next/link";
import { Suspense } from "react";
import { SiteNav } from "@/components/site-nav";
import { getOptionalCurrentAppUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";

export async function SiteHeader() {
  const user = await getOptionalCurrentAppUser();

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label={`${BRAND.koreanName} 홈`}>
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>
            <strong>{BRAND.englishName}</strong>
            <small>{BRAND.systemLabel}</small>
          </span>
        </Link>
        <Suspense fallback={<nav className="main-nav" aria-label="주요 메뉴" />}>
          <SiteNav signedIn={Boolean(user)} />
        </Suspense>
        <div className="header-actions">
          {user ? (
            <>
              <span className="user-chip">{user.displayName}</span>
              <form action="/api/auth/supabase/logout" method="post">
                <input type="hidden" name="returnTo" value="/" />
                <button className="button button-ghost button-small" type="submit">
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Link className="button button-dark button-small" href="/login">
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
