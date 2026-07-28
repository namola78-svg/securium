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
          <p className="eyebrow">ADMIN CONSOLE</p>
          <h2>과정 운영</h2>
          <p>{user.displayName}</p>
          <AdminNav />
        </aside>
        <div className="admin-content">{children}</div>
      </div>
    </main>
  );
}
