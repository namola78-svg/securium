"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { NavigationIcon } from "@/components/navigation-icon";
import { V2Foundation } from "@/components/v2/v2-foundation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  learnerShellAccountItems,
  learnerShellPrimaryItems,
  learnerShellSecondaryItems,
  learnerShellSupportItems,
  mobileBottomNavItems,
  type LearnerShellNavItem,
} from "@/lib/ui-nav";
import styles from "@/components/v2/learner-app-shell.module.css";

type ShellUser = { displayName: string; roles: string[] };

const learnerRoutePrefixes = [
  "/ai-tutor",
  "/analytics",
  "/bookmarks",
  "/content-versions",
  "/dashboard",
  "/learn",
  "/lectures",
  "/mock-exams",
  "/my-courses",
  "/my-learning",
  "/practical",
  "/practice",
  "/profile",
  "/questions",
  "/reviews",
  "/settings",
  "/wrong-notes",
] as const;

export function LearnerAppShell({ children, user }: { children: ReactNode; user: ShellUser | null }) {
  const pathname = usePathname() || "/";
  if (!user || !isLearnerRoute(pathname)) {
    return <div id="main-content" tabIndex={-1}>{children}</div>;
  }

  return <AuthenticatedLearnerShell pathname={pathname} user={user}>{children}</AuthenticatedLearnerShell>;
}

function AuthenticatedLearnerShell({ children, pathname, user }: { children: ReactNode; pathname: string; user: ShellUser }) {
  const practiceFocusMode = pathname.startsWith("/practice/") || pathname.startsWith("/mock-exams/attempts/");
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const drawerRef = useRef<HTMLElement>(null);
  const drawerButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    let secondFrame = 0;
    let scrollTimer = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        scrollTimer = window.setTimeout(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          contentRef.current?.focus({ preventScroll: true });
        }, 0);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      if (scrollTimer) window.clearTimeout(scrollTimer);
    };
  }, [pathname]);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const scrollPosition = useRef(0);
  const pageTitle = getPageTitle(pathname);
  const isAdmin = user.roles.some((role) => ["ADMIN", "SUPER_ADMIN", "COURSE_MANAGER", "CONTENT_EDITOR", "CONTENT_REVIEWER"].includes(role));

  function openDrawer() {
    setProfileOpen(false);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => drawerButtonRef.current?.focus());
  }

  useEffect(() => {
    if (!drawerOpen) return;
    const body = document.body;
    const root = document.documentElement;
    const previousBody = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width };
    const previousRootOverflow = root.style.overflow;
    scrollPosition.current = window.scrollY;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollPosition.current}px`;
    body.style.width = "100%";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    window.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => drawerRef.current?.querySelector<HTMLElement>("a[href]")?.focus(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBody.overflow;
      body.style.position = previousBody.position;
      body.style.top = previousBody.top;
      body.style.width = previousBody.width;
      window.scrollTo(0, scrollPosition.current);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        window.requestAnimationFrame(() => profileButtonRef.current?.focus());
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [profileOpen]);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError("");
    try {
      try { await createSupabaseBrowserClient().auth.signOut(); } catch {}
      const response = await fetch("/api/auth/supabase/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ returnTo: pathname }),
        redirect: "manual",
      });
      if (!response.ok && response.type !== "opaqueredirect") throw new Error("LOGOUT_FAILED");
      router.replace(`/login?return_to=${encodeURIComponent(pathname)}`);
      router.refresh();
    } catch {
      setLogoutError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSigningOut(false);
    }
  }

  return (
    <V2Foundation className={styles.root} data-learner-app-shell-v2="" data-practice-focus-shell={practiceFocusMode ? "" : undefined}>
      {practiceFocusMode ? null : <LearnerSidebar pathname={pathname} />}
      <div className={styles.mainColumn}>
        {practiceFocusMode ? null : <header className={styles.topHeader}>
          <button ref={drawerButtonRef} className={styles.menuButton} type="button" aria-label="학습 메뉴 열기" aria-expanded={drawerOpen} aria-controls="learner-navigation-drawer" onClick={openDrawer}>
            <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
          </button>
          <Link className={styles.mobileBrand} href="/dashboard" aria-label="SECURIUM 대시보드로 이동"><span aria-hidden="true">S</span><strong>SECURIUM</strong></Link>
          <div className={styles.pageContext}><span>학습 공간</span><strong>{pageTitle}</strong></div>
          <ProfileMenu isAdmin={isAdmin} logout={logout} logoutError={logoutError} open={profileOpen} setOpen={setProfileOpen} signingOut={signingOut} user={user} profileRef={profileRef} buttonRef={profileButtonRef} />
        </header>}
        <div ref={contentRef} className={styles.content} id="main-content" tabIndex={-1}>{children}</div>
      </div>
      {!practiceFocusMode && drawerOpen ? <LearnerDrawer pathname={pathname} user={user} drawerRef={drawerRef} onClose={closeDrawer} logout={logout} signingOut={signingOut} isAdmin={isAdmin} /> : null}
      {!practiceFocusMode && drawerOpen ? <button className={styles.backdrop} type="button" aria-label="학습 메뉴 바깥 영역 닫기" onClick={closeDrawer} /> : null}
      {practiceFocusMode ? null : <MobileBottomNavigation pathname={pathname} />}
    </V2Foundation>
  );
}

function LearnerSidebar({ pathname }: { pathname: string }) {
  return (
    <aside className={styles.sidebar} aria-label="학습자 사이드바">
      <Link className={styles.brand} href="/dashboard" aria-label="SECURIUM 대시보드로 이동"><span aria-hidden="true">S</span><div><strong>SECURIUM</strong><small>LEARNING APP</small></div></Link>
      <nav className={styles.sidebarNav} aria-label="학습자 주요 메뉴">
        <NavGroup items={learnerShellPrimaryItems} pathname={pathname} />
        <NavGroup label="학습 도구" items={learnerShellSecondaryItems} pathname={pathname} />
        <NavGroup label="계정" items={learnerShellAccountItems} pathname={pathname} />
      </nav>
      <div className={styles.supportArea}>
        <NavGroup items={learnerShellSupportItems} pathname={pathname} />
        <Link className={styles.askButton} href="/ai-tutor">AI 튜터에게 질문하기</Link>
      </div>
    </aside>
  );
}

function NavGroup({ items, label, onClick, pathname }: { items: readonly LearnerShellNavItem[]; label?: string; onClick?: () => void; pathname: string }) {
  return <div className={styles.navGroup}>{label ? <p>{label}</p> : null}{items.map((item) => <ShellNavLink item={item} pathname={pathname} key={item.href} onClick={onClick} />)}</div>;
}

function ShellNavLink({ item, pathname, onClick }: { item: LearnerShellNavItem; pathname: string; onClick?: () => void }) {
  const active = item.activeHrefs.some((href) => isActivePath(pathname, href));
  return <Link className={`${styles.navItem} ${active ? styles.active : ""}`} data-shell-nav-item="" href={item.href} aria-current={active ? "page" : undefined} onClick={onClick}><NavigationIcon name={item.icon} /><span>{item.label}</span>{item.badge ? <small>{item.badge}</small> : null}</Link>;
}

function LearnerDrawer({ drawerRef, isAdmin, logout, onClose, pathname, signingOut, user }: { drawerRef: React.RefObject<HTMLElement | null>; isAdmin: boolean; logout: () => void; onClose: () => void; pathname: string; signingOut: boolean; user: ShellUser }) {
  return <aside ref={drawerRef} className={`${styles.drawer} ${styles.drawerOpen}`} id="learner-navigation-drawer" aria-label="학습 메뉴" aria-modal="true" role="dialog">
    <div className={styles.drawerHeader}><div><span>SECURIUM</span><strong>학습 메뉴</strong></div><button type="button" aria-label="학습 메뉴 닫기" onClick={onClose}>×</button></div>
    <div className={styles.accountSummary}><span aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{isAdmin ? "운영 권한 보유" : "학습자"}</small></div></div>
    <nav className={styles.drawerNav} aria-label="전체 학습 메뉴">
      <NavGroup items={learnerShellPrimaryItems} pathname={pathname} onClick={onClose} />
      <NavGroup label="학습 도구" items={learnerShellSecondaryItems} pathname={pathname} onClick={onClose} />
      <NavGroup label="계정" items={learnerShellAccountItems} pathname={pathname} onClick={onClose} />
      <NavGroup label="도움" items={learnerShellSupportItems} pathname={pathname} onClick={onClose} />
      {isAdmin ? <Link className={styles.navItem} href="/admin" onClick={onClose}><NavigationIcon name="settings" /><span>운영 콘솔</span></Link> : null}
    </nav>
    <button className={styles.drawerLogout} type="button" disabled={signingOut} onClick={logout}>{signingOut ? "로그아웃 중" : "로그아웃"}</button>
  </aside>;
}

function ProfileMenu({ buttonRef, isAdmin, logout, logoutError, open, profileRef, setOpen, signingOut, user }: { buttonRef: React.RefObject<HTMLButtonElement | null>; isAdmin: boolean; logout: () => void; logoutError: string; open: boolean; profileRef: React.RefObject<HTMLDivElement | null>; setOpen: (open: boolean) => void; signingOut: boolean; user: ShellUser }) {
  return <div className={styles.profile} ref={profileRef}>
    <button ref={buttonRef} className={styles.profileTrigger} type="button" aria-label={`${user.displayName} 프로필 메뉴`} aria-expanded={open} aria-haspopup="menu" aria-controls="learner-profile-menu" onClick={() => setOpen(!open)}><span aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</span><strong>{user.displayName}</strong><small aria-hidden="true">⌄</small></button>
    {open ? <div className={styles.profilePanel} id="learner-profile-menu" role="menu">
      <div className={styles.profileSummary}><strong>{user.displayName}</strong><span>{isAdmin ? "운영 권한 보유" : "학습자"}</span></div>
      <Link href="/profile" role="menuitem" onClick={() => setOpen(false)}>프로필</Link>
      <Link href="/settings" role="menuitem" onClick={() => setOpen(false)}>학습 설정</Link>
      {isAdmin ? <Link href="/admin" role="menuitem" onClick={() => setOpen(false)}>운영 콘솔</Link> : null}
      <button type="button" role="menuitem" disabled={signingOut} onClick={logout}>{signingOut ? "로그아웃 중" : "로그아웃"}</button>
    </div> : null}
    {logoutError ? <p className={styles.logoutError} role="alert">{logoutError}</p> : null}
  </div>;
}

function MobileBottomNavigation({ pathname }: { pathname: string }) {
  return <nav className={styles.bottomNav} aria-label="모바일 학습 빠른 이동">{mobileBottomNavItems.map((item) => {
    const active = item.activeHrefs.some((href) => isActivePath(pathname, href));
    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? styles.bottomActive : ""}><NavigationIcon name={item.icon} /><span>{item.label}</span></Link>;
  })}</nav>;
}

function isLearnerRoute(pathname: string) { return learnerRoutePrefixes.some((prefix) => isActivePath(pathname, prefix)); }
function isActivePath(pathname: string, href: string) { return pathname === href || pathname.startsWith(`${href}/`); }
function getPageTitle(pathname: string) {
  const titles: Array<[string, string]> = [["/dashboard", "대시보드"], ["/my-courses", "학습"], ["/learn", "학습"], ["/lectures", "강의"], ["/practice", "문제풀이"], ["/questions", "문제"], ["/mock-exams", "모의고사"], ["/wrong-notes", "오답노트"], ["/reviews", "복습"], ["/analytics", "학습 분석"], ["/bookmarks", "북마크"], ["/ai-tutor", "AI 튜터"], ["/practical", "실무 학습"], ["/profile", "마이페이지"], ["/settings", "학습 설정"], ["/my-learning", "내 학습"]];
  return titles.find(([prefix]) => isActivePath(pathname, prefix))?.[1] ?? "학습";
}
