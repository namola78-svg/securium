"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { authRedirectHref, safeAuthReturnPath } from "@/lib/auth-routing";

type AccountDrawerProps = {
  user: {
    displayName: string;
    roles: string[];
  };
};

export function AccountDrawer({ user }: AccountDrawerProps) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const currentSearch = searchParams?.toString() ?? "";
  const returnTo = safeAuthReturnPath(
    `${pathname}${currentSearch ? `?${currentSearch}` : ""}`,
  );
  const loginAfterLogoutHref = authRedirectHref("/login", returnTo);
  const isAdmin =
    user.roles.includes("ADMIN") ||
    user.roles.includes("SUPER_ADMIN") ||
    user.roles.includes("COURSE_MANAGER") ||
    user.roles.includes("CONTENT_EDITOR") ||
    user.roles.includes("CONTENT_REVIEWER");
  const roleLabel = isAdmin ? "관리자" : "학습자";

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 50);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
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

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (drawerRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    setError("");

    try {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
      } catch {
        // HttpOnly session cookies는 서버 logout API에서 정리됩니다.
      }

      const response = await fetch("/api/auth/supabase/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ returnTo }),
        redirect: "manual",
      });

      if (!response.ok && response.type !== "opaqueredirect") {
        throw new Error("LOGOUT_FAILED");
      }

      setOpen(false);
      router.replace(loginAfterLogoutHref);
      router.refresh();
    } catch {
      setError("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSigningOut(false);
    }
  }

  const initials = user.displayName.trim().slice(0, 1).toUpperCase() || "S";
  const visibleRoles = user.roles.length
    ? user.roles.map(formatRoleLabel).join(" / ")
    : "일반 사용자";

  return (
    <div className="account-drawer-shell">
      <button
        className="account-drawer-trigger"
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls="admin-account-drawer"
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="account-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="account-trigger-copy">
          <strong>{user.displayName}</strong>
          <small>{roleLabel}</small>
        </span>
      </button>

      {open ? (
        <div
          className="account-drawer"
          id="admin-account-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby="admin-account-drawer-title"
        >
          <header className="account-drawer-header">
            <span className="account-avatar large" aria-hidden="true">
              {initials}
            </span>
            <div>
              <p className="eyebrow">ACCOUNT</p>
              <h2 id="admin-account-drawer-title">{user.displayName}</h2>
              <p>{visibleRoles}</p>
            </div>
            <button
              aria-label="드로어 닫기"
              className="account-drawer-close"
              onClick={() => {
                setOpen(false);
                window.requestAnimationFrame(() => triggerRef.current?.focus());
              }}
              ref={closeButtonRef}
              type="button"
            >
              ✕
            </button>
          </header>

          <div className="account-drawer-links">
            <Link href="/profile" onClick={() => setOpen(false)}>
              프로필
            </Link>
            <Link href="/settings" onClick={() => setOpen(false)}>
              학습 설정
            </Link>
            <Link href="/admin" onClick={() => setOpen(false)}>
              관리자
            </Link>
          </div>

          <button
            className="account-drawer-logout"
            type="button"
            disabled={signingOut}
            aria-busy={signingOut}
            onClick={handleLogout}
          >
            {signingOut ? "로그아웃 중" : "로그아웃"}
          </button>

          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatRoleLabel(role: string) {
  const labels: Record<string, string> = {
    ADMIN: "관리자",
    SUPER_ADMIN: "최고 관리자",
    COURSE_MANAGER: "과정 관리자",
    CONTENT_EDITOR: "콘텐츠 편집자",
    CONTENT_REVIEWER: "콘텐츠 검수자",
    USER: "학습자",
  };
  return labels[role] ?? "추가 권한";
}
