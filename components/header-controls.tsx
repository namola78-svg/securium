"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type HeaderUser = {
  displayName: string;
  roles: string[];
};

type HeaderControlsProps = {
  user: HeaderUser | null;
};

type NavItem = {
  href?: string;
  label: string;
  disabled?: boolean;
};

const publicItems: NavItem[] = [
  { href: "/courses", label: "과정" },
  { href: "/guide", label: "학습 가이드" },
  { href: "/about", label: "시큐리움 소개" },
];

const signedInItems: NavItem[] = [
  { href: "/my-courses", label: "내 학습" },
  { href: "/practice", label: "문제풀이" },
  { href: "/wrong-notes", label: "오답노트" },
  { href: "/ai-tutor", label: "AI 튜터" },
];

export function HeaderControls({ user }: HeaderControlsProps) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signedOutLocally, setSignedOutLocally] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const lockedScrollY = useRef(0);
  const activePath = resolveActivePath(pathname, searchParams);
  const currentUser = signedOutLocally ? null : user;
  const isSignedIn = Boolean(currentUser);
  const isAdmin = Boolean(
    currentUser?.roles.some((role) =>
      [
        "ADMIN",
        "SUPER_ADMIN",
        "COURSE_MANAGER",
        "CONTENT_EDITOR",
        "CONTENT_REVIEWER",
      ].includes(role),
    ),
  );
  const navItems = isSignedIn ? signedInItems : publicItems;

  useEffect(() => {
    if (!mobileOpen) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    lockedScrollY.current = window.scrollY;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${lockedScrollY.current}px`;
    body.style.width = "100%";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setProfileOpen(false);
        window.requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      const focusTarget = navRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusTarget?.focus();
    });

    return () => {
      body.style.overflow = previousOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      window.scrollTo(0, lockedScrollY.current);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 960) {
        setMobileOpen(false);
        setProfileOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          setSignedOutLocally(true);
          setMobileOpen(false);
          setProfileOpen(false);
          router.refresh();
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // Browser Supabase env may be absent in non-Supabase local modes.
    }

    return () => unsubscribe?.();
  }, [router]);

  const profileItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { href: "/profile", label: "프로필" },
      { href: "/settings", label: "학습 설정" },
    ];
    if (isAdmin) items.push({ href: "/admin", label: "관리자 화면" });
    return items;
  }, [isAdmin]);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError("");
    setMobileOpen(false);
    setProfileOpen(false);

    try {
      let browserSignOutFailed = false;
      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.signOut();
        browserSignOutFailed = Boolean(error);
      } catch {
        browserSignOutFailed = true;
      }

      const response = await fetch("/api/auth/supabase/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ returnTo: "/login" }),
        redirect: "manual",
      });

      if (!response.ok && response.type !== "opaqueredirect") {
        throw new Error("SERVER_LOGOUT_FAILED");
      }

      setSignedOutLocally(true);
      router.replace("/login");
      router.refresh();

      if (browserSignOutFailed) {
        // Server-side HttpOnly cookies were cleared, so the visible session is
        // still safely removed. No user-facing error is needed.
      }
    } catch {
      setLogoutError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSigningOut(false);
    }
  }

  function closeMenus() {
    setMobileOpen(false);
    setProfileOpen(false);
  }

  return (
    <>
      <button
        className="mobile-menu-button"
        ref={menuButtonRef}
        type="button"
        aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={mobileOpen}
        aria-controls="site-navigation"
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span className="sr-only">{mobileOpen ? "메뉴 닫기" : "메뉴 열기"}</span>
      </button>

      <nav
        className={`main-nav ${mobileOpen ? "open" : ""}`}
        id="site-navigation"
        ref={navRef}
        aria-label="주요 메뉴"
      >
        {navItems.map((item) => (
          <HeaderNavItem
            activePath={activePath}
            item={item}
            key={item.label}
            onClick={closeMenus}
          />
        ))}
        {!isSignedIn ? (
          <div className="mobile-nav-actions" aria-label="계정 메뉴">
            <Link className="button button-ghost full-width" href="/login" onClick={closeMenus}>
              로그인
            </Link>
            <Link className="button button-lime full-width" href="/signup" onClick={closeMenus}>
              무료로 시작하기
            </Link>
          </div>
        ) : null}
      </nav>

      <div className="header-actions">
        {isSignedIn && currentUser ? (
          <div className="profile-menu" ref={profileRef}>
            <button
              className="profile-menu-trigger"
              type="button"
              aria-label={`${currentUser.displayName} 프로필 메뉴`}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span className="user-chip">{currentUser.displayName}</span>
              <span aria-hidden="true">⌄</span>
            </button>
            {profileOpen ? (
              <div className="profile-menu-panel" role="menu">
                {profileItems.map((item) => (
                  <HeaderNavItem
                    activePath={activePath}
                    item={item}
                    key={item.label}
                    onClick={closeMenus}
                    role="menuitem"
                  />
                ))}
                <button
                  className="profile-menu-item danger"
                  type="button"
                  role="menuitem"
                  disabled={signingOut}
                  aria-busy={signingOut}
                  onClick={handleLogout}
                >
                  {signingOut ? "로그아웃 중" : "로그아웃"}
                </button>
              </div>
            ) : null}
            {logoutError ? (
              <p className="header-error" role="alert">
                {logoutError}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <Link className="button button-ghost button-small" href="/login">
              로그인
            </Link>
            <Link className="button button-lime button-small" href="/signup">
              무료로 시작하기
            </Link>
          </>
        )}
      </div>

      {mobileOpen ? (
        <button
          className="mobile-menu-backdrop"
          type="button"
          aria-label="메뉴 닫기"
          onClick={closeMenus}
        />
      ) : null}
    </>
  );
}

function HeaderNavItem({
  activePath,
  item,
  onClick,
  role,
}: {
  activePath: string;
  item: NavItem;
  onClick: () => void;
  role?: string;
}) {
  if (!item.href || item.disabled) {
    return (
      <span
        className="nav-disabled"
        aria-disabled="true"
        role={role}
        title="아직 제공되지 않는 메뉴입니다."
      >
        {item.label}
      </span>
    );
  }

  const active = isActivePath(activePath, item.href);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={active ? "active" : undefined}
      href={item.href}
      onClick={onClick}
      role={role}
      title={active ? `현재 위치: ${item.label}` : item.label}
    >
      {item.label}
    </Link>
  );
}

function resolveActivePath(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
) {
  if (pathname !== "/login" && pathname !== "/signup") return pathname;
  return safeReturnPath(searchParams.get("return_to")) ?? pathname;
}

function safeReturnPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;

  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return null;
    if (url.pathname === "/login" || url.pathname === "/signup") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
