import { AdminConsoleTopBar } from "@/components/admin-console-top-bar";
import { AdminNav } from "@/components/admin-nav";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireQuestionAdministrator("/admin");

  return (
    <main className="admin-shell">
      <div className="shell admin-layout">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <p className="eyebrow">CONSOLE NAVIGATION</p>
            <strong>SECURIUM</strong>
            <span>운영 · 콘텐츠 · AI 지식 관리</span>
          </div>
          <AdminNav />
        </aside>

        <section className="admin-workspace" aria-label="관리자 작업 영역">
          <AdminConsoleTopBar
            user={{
              displayName: user.displayName,
              roles: user.roles,
            }}
          />
          <div className="admin-content">{children}</div>
        </section>
      </div>
    </main>
  );
}
