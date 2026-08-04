"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type AccountDrawerProps = {
  user: {
    displayName: string;
    roles: string[];
  };
};

export function AccountDrawer({ user }: AccountDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
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
        // HttpOnly session cookies are cleared by the server endpoint below.
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
        throw new Error("LOGOUT_FAILED");
      }

      setOpen(false);
      router.replace("/login");
      router.refresh();
    } catch {
      setError("로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.");
      setSigningOut(false);
    }
  }

  const initials = user.displayName.slice(0, 1).toUpperCase();
  const visibleRoles = user.roles.length ? user.roles.join(" · ") : "관리자";

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
          <small>계정</small>
        </span>
      </button>

      {open ? (
        <div
          className="account-drawer"
          id="admin-account-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal="false"
          aria-label="관리자 계정 메뉴"
        >
          <header className="account-drawer-header">
            <span className="account-avatar large" aria-hidden="true">
              {initials}
            </span>
            <div>
              <p className="eyebrow">ACCOUNT</p>
              <h2>{user.displayName}</h2>
              <p>{visibleRoles}</p>
            </div>
          </header>

          <div className="account-drawer-links">
            <Link href="/profile" onClick={() => setOpen(false)}>
              프로필
            </Link>
            <Link href="/settings" onClick={() => setOpen(false)}>
              학습 설정
            </Link>
            <Link href="/admin" onClick={() => setOpen(false)}>
              관리자 홈
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
