"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ActionButton } from "@/components/design-system-primitives";
import { NavigationIcon } from "@/components/navigation-icon";
import { authRedirectHref, safeAuthReturnPath } from "@/lib/auth-routing";
import { usePresentationIdentity } from "@/components/presentation-identity-provider";


import {
  learnerPrimaryNavItems,
  learnerUtilityNavItems,
  mobileBottomNavItems,
  isLearnerFocusRoute,
  publicNavItems,
  type MobileBottomNavItem as ConfigMobileBottomNavItem,
} from "@/lib/ui-nav";
type HeaderUser = {
  displayName: string;
  roles: string[];
};

type NavItem = {
  href?: string;
  label: string;
  disabled?: boolean;
};


type MobileBottomNavItem = ConfigMobileBottomNavItem;

export function HeaderControls() {
  const pathname = usePathname() || "/";
  const focusMode = isLearnerFocusRoute(pathname);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signedOutLocally, setSignedOutLocally] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const { identity, status, markUnauthenticated } = usePresentationIdentity();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const lockedScrollY = useRef(0);
  const activePath = resolveActivePath(pathname, searchParams);
  const user: HeaderUser | null =
    status === "authenticated" && identity?.displayName
      ? { displayName: identity.displayName, roles: identity.roles }
      : null;
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
  const navItems = isSignedIn ? learnerPrimaryNavItems : publicNavItems;
  const mobileBottomItems = mobileBottomNavItems;
  const currentSearch = searchParams?.toString() ?? "";
  const loginReturnTo = safeAuthReturnPath(
    `${pathname}${currentSearch ? `?${currentSearch}` : ""}`,
  );
  const logoutReturnTo = safeAuthReturnPath(loginReturnTo);
  const loginHref = authRedirectHref("/login", loginReturnTo);
  const signupHref = authRedirectHref("/signup", loginReturnTo);
  const loginAfterLogoutHref = authRedirectHref("/login", logoutReturnTo);

  useEffect(() => {
    if (!mobileOpen) return;
    const body = document.body;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    lockedScrollY.current = window.scrollY;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${lockedScrollY.current}px`;
    body.style.width = "100%";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setProfileOpen(false);
        window.requestAnimationFrame(() => menuButtonRef.current?.focus());
        return;
      }

      if (event.key === "Tab") {
        const focusableElements = [
          ...(navRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ) ?? []),
        ];
        if (!focusableElements.length) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (navRef.current?.contains(target)) return;
      if (menuButtonRef.current?.contains(target)) return;
      setMobileOpen(false);
      setProfileOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    const focusTimer = window.setTimeout(() => {
      const focusTarget = navRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusTarget?.focus();
    }, 50);

    return () => {
      window.clearTimeout(focusTimer);
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      window.scrollTo(0, lockedScrollY.current);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
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
    if (!profileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        window.requestAnimationFrame(() => profileButtonRef.current?.focus());
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          setSignedOutLocally(true);
          markUnauthenticated();
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
  }, [markUnauthenticated, router]);

  const profileItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { href: "/profile", label: "프로필" },
      { href: "/settings", label: "학습 설정" },
    ];
    if (isAdmin) items.push({ href: "/admin", label: "운영 콘솔" });
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
        body: new URLSearchParams({ returnTo: logoutReturnTo }),
        redirect: "manual",
      });

      if (!response.ok && response.type !== "opaqueredirect") {
        throw new Error("SERVER_LOGOUT_FAILED");
      }

      setSignedOutLocally(true);
      markUnauthenticated();
      router.replace(loginAfterLogoutHref);
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
        <div className="mobile-drawer-header">
          <div>
            <p className="eyebrow">SECURIUM MENU</p>
            <strong>{isSignedIn ? "학습 메뉴" : "시작하기"}</strong>
          </div>
          <button
            className="mobile-drawer-close"
            type="button"
            aria-label="모바일 메뉴 닫기"
            onClick={() => {
              closeMenus();
              window.requestAnimationFrame(() => menuButtonRef.current?.focus());
            }}
          >
            ×
          </button>
        </div>
        {isSignedIn && currentUser ? (
          <div className="mobile-account-summary" aria-label="로그인 계정">
            <span className="mobile-account-avatar" aria-hidden="true">
              {currentUser.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{currentUser.displayName}</strong>
              <span>{isAdmin ? "운영 권한 보유" : "학습자"}</span>
            </div>
          </div>
        ) : null}
        {navItems.map((item) => (
          <HeaderNavItem
            activePath={activePath}
            item={item}
            key={item.label}
            onClick={closeMenus}
          />
        ))}
        {isSignedIn ? (
          <div className="mobile-nav-utility">
            <div className="mobile-nav-section-title">추가 학습</div>
            {learnerUtilityNavItems.map((item) => (
              <HeaderNavItem
                activePath={activePath}
                item={item}
                key={item.label}
                onClick={closeMenus}
              />
            ))}
          </div>
        ) : null}        <div className="mobile-nav-actions" aria-label="계정 메뉴">
          {!isSignedIn ? (
            <>
              <ActionButton
                className="full-width"
                href={loginHref}
                variant="ghost"
                onClick={closeMenus}
              >
                로그인
              </ActionButton>
              <ActionButton
                className="full-width"
                href={signupHref}
                variant="dark"
                onClick={closeMenus}
              >
                무료로 시작하기
              </ActionButton>
            </>
          ) : (
            <>
              <div className="mobile-nav-section-title">계정</div>
              {profileItems.map((item) => (
                <HeaderNavItem
                  activePath={activePath}
                  item={item}
                  key={item.label}
                  onClick={closeMenus}
                />
              ))}
              <ActionButton
                className="profile-menu-item danger"
                variant="danger"
                onClick={handleLogout}
                disabled={signingOut}
                loading={signingOut}
              >
                {signingOut ? "로그아웃 중" : "로그아웃"}
              </ActionButton>
            </>
          )}
        </div>
        {!isSignedIn ? null : logoutError ? (
          <p className="mobile-header-error" role="alert">
            {logoutError}
          </p>
        ) : null}
      </nav>

      <div className="header-actions">
        {isSignedIn && currentUser ? (
          <nav className="header-utility-nav" aria-label="추가 학습 링크">
            {learnerUtilityNavItems.slice(0, 3).map((item) => (
              <HeaderNavItem
                activePath={activePath}
                item={item}
                key={item.label}
                onClick={closeMenus}
              />
            ))}
          </nav>
        ) : null}
        {isSignedIn && currentUser ? (
          <div className="profile-menu" ref={profileRef}>
            <button
              className="profile-menu-trigger"
              ref={profileButtonRef}
              type="button"
              aria-label={`${currentUser.displayName} 프로필 메뉴`}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-controls="profile-menu-panel"
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span className="user-chip">{currentUser.displayName}</span>
              <span aria-hidden="true">⌄</span>
            </button>
            {profileOpen ? (
              <div className="profile-menu-panel" id="profile-menu-panel" role="menu">
                <div className="profile-menu-summary" role="presentation">
                  <strong>{currentUser.displayName}</strong>
                  <span>{isAdmin ? "운영 권한 보유" : "학습자"}</span>
                </div>
                {profileItems.map((item) => (
                  <HeaderNavItem
                    activePath={activePath}
                    item={item}
                    key={item.label}
                    onClick={closeMenus}
                    role="menuitem"
                  />
                ))}
                <ActionButton
                  className="profile-menu-item danger"
                  variant="danger"
                  onClick={handleLogout}
                  disabled={signingOut}
                  loading={signingOut}
                >
                  {signingOut ? "로그아웃 중" : "로그아웃"}
                </ActionButton>
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
            <ActionButton
              href={loginHref}
              size="sm"
              variant="ghost"
              className="button-small"
            >
              로그인
            </ActionButton>
            <ActionButton
              href={signupHref}
              size="sm"
              variant="dark"
              className="button-small"
            >
              무료로 시작하기
            </ActionButton>
          </>
        )}
      </div>

      {mobileOpen ? (
        <button
          className="mobile-menu-backdrop"
          type="button"
          aria-label="메뉴 바깥 영역 닫기"
          onClick={closeMenus}
        />
      ) : null}

      {isSignedIn && !focusMode ? (
        <nav className="mobile-bottom-nav" aria-label="모바일 학습 빠른 이동">
          {mobileBottomItems.map((item) => {
            const active = isMobileBottomActive(activePath, item);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "active" : undefined}
                href={item.href ?? "#"}
                key={item.label}
                title={active ? `현재 위치: ${item.label}` : item.label}
              >
                <span aria-hidden="true"><NavigationIcon name={item.icon} /></span>
                <strong>{item.label}</strong>
              </Link>
            );
          })}
        </nav>
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
  return safeAuthReturnPath(searchParams?.get("return_to"), pathname);
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isMobileBottomActive(pathname: string, item: MobileBottomNavItem) {
  return item.activeHrefs.some((href) => isActivePath(pathname, href));
}
