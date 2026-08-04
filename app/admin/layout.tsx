import { AdminConsoleShell } from "@/components/admin-console-shell";
import { requireQuestionAdministrator } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireQuestionAdministrator("/admin");

  return (
    <AdminConsoleShell
      user={{
        displayName: user.displayName,
        roles: user.roles,
      }}
    >
      {children}
    </AdminConsoleShell>
  );
}
