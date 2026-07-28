import Link from "next/link";
import {
  getChatGPTUserForDisplay,
  chatGPTSignOutPath,
} from "@/app/chatgpt-auth";
import { SiteNav } from "@/components/site-nav";

export async function SiteHeader() {
  const user = await getChatGPTUserForDisplay();

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="Shield Academy 홈">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span>
            <strong>Shield Academy</strong>
            <small>Security learning system</small>
          </span>
        </Link>
        <SiteNav signedIn={Boolean(user)} />
        <div className="header-actions">
          {user ? (
            <>
              <span className="user-chip">{user.displayName}</span>
              <Link className="button button-ghost button-small" href={chatGPTSignOutPath("/")}>
                로그아웃
              </Link>
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
