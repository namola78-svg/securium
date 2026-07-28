import Link from "next/link";
import { getChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";

export async function SiteHeader() {
  const user = await getChatGPTUser();

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
        <nav className="main-nav" aria-label="주요 메뉴">
          <Link href="/courses">과정</Link>
          {user ? (
            <>
              <Link href="/dashboard">대시보드</Link>
              <Link href="/my-courses">내 과정</Link>
              <Link href="/wrong-notes">오답노트</Link>
              <Link href="/reviews">오늘의 복습</Link>
              <Link href="/mock-exams">모의고사</Link>
              <Link href="/analytics">학습분석</Link>
              <Link href="/bookmarks">즐겨찾기</Link>
              <Link href="/profile">프로필</Link>
            </>
          ) : null}
        </nav>
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
