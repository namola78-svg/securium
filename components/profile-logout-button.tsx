"use client";

import { useState } from "react";

export function ProfileLogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const form = new FormData();
      form.set("returnTo", "/dashboard");
      const response = await fetch("/api/auth/supabase/logout", { method: "POST", body: form });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      window.location.assign(response.url || "/");
    } catch {
      setError("로그아웃하지 못했습니다. 잠시 후 다시 시도해주세요.");
      setPending(false);
    }
  }

  return (
    <div>
      <button className="button button-ghost" type="button" disabled={pending} aria-busy={pending} onClick={logout}>{pending ? "로그아웃 중" : "로그아웃"}</button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
