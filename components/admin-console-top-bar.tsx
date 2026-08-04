"use client";

import { AccountDrawer } from "@/components/account-drawer";
import { EnvironmentBadge } from "@/components/design-system-primitives";

type AdminConsoleTopBarProps = {
  user: {
    displayName: string;
    roles: string[];
  };
};

export function AdminConsoleTopBar({ user }: AdminConsoleTopBarProps) {
  return (
    <header className="admin-console-top-bar">
      <div className="admin-console-title">
        <p className="eyebrow">SECURIUM ADMIN</p>
        <h1>관리자 콘솔</h1>
      </div>

      <div className="admin-console-actions" aria-label="관리자 콘솔 상태와 계정">
        <EnvironmentBadge />
        <AccountDrawer user={user} />
      </div>
    </header>
  );
}
