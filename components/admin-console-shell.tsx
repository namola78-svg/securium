"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdminConsoleTopBar } from "@/components/admin-console-top-bar";
import { AdminNav } from "@/components/admin-nav";

type AdminConsoleShellProps = {
  children: ReactNode;
  user: {
    displayName: string;
    roles: string[];
  };
};

export function AdminConsoleShell({ children, user }: AdminConsoleShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const lockedScrollY = useRef(0);

  useEffect(() => {
    if (!navigationOpen) return;

    const body = document.body;
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    lockedScrollY.current = window.scrollY;

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${lockedScrollY.current}px`;
    body.style.width = "100%";

    function closeAndReturnFocus() {
      setNavigationOpen(false);
      window.requestAnimationFrame(() => navigationButtonRef.current?.focus());
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAndReturnFocus();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
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

    window.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      sidebarRef.current
        ?.querySelector<HTMLElement>('a[href], button:not([disabled])')
        ?.focus();
    }, 50);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      window.scrollTo(0, lockedScrollY.current);
    };
  }, [navigationOpen]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 960) setNavigationOpen(false);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function closeNavigation() {
    setNavigationOpen(false);
  }

  return (
    <main className={`admin-shell ${navigationOpen ? "admin-nav-open" : ""}`}>
      <a className="skip-link" href="#admin-main-content">
        관리자 본문으로 이동
      </a>
      <div className="shell admin-layout">
        <button
          aria-controls="admin-sidebar-navigation"
          aria-expanded={navigationOpen}
          aria-label={navigationOpen ? "관리자 메뉴 닫기" : "관리자 메뉴 열기"}
          className="admin-mobile-nav-button"
          onClick={() => setNavigationOpen((open) => !open)}
          ref={navigationButtonRef}
          type="button"
        >
          <span aria-hidden="true">☰</span>
          관리 메뉴
        </button>

        <aside
          aria-label="관리자 탐색"
          className="admin-sidebar"
          id="admin-sidebar-navigation"
          ref={sidebarRef}
          onClick={(event) => {
            if ((event.target as Element).closest("a")) closeNavigation();
          }}
        >
          <div className="admin-sidebar-brand">
            <div>
              <p className="eyebrow">CONSOLE NAVIGATION</p>
              <strong>SECURIUM</strong>
              <span>운영 · 콘텐츠 · AI 지식 관리</span>
            </div>
            <button
              aria-label="관리자 메뉴 닫기"
              className="admin-sidebar-close"
              onClick={closeNavigation}
              type="button"
            >
              ×
            </button>
          </div>
          <AdminNav />
        </aside>

        <section className="admin-workspace" aria-label="관리자 작업 영역">
          <AdminConsoleTopBar user={user} />
          <div className="admin-content" id="admin-main-content" tabIndex={-1}>
            {children}
          </div>
        </section>
      </div>

      {navigationOpen ? (
        <button
          aria-label="관리자 메뉴 닫기"
          className="admin-nav-backdrop"
          onClick={closeNavigation}
          type="button"
        />
      ) : null}
    </main>
  );
}
