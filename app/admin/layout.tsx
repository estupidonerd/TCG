import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sin sesión -> /login. Con sesión pero sin is_admin -> /.
  await requireAdminOrRedirect();

  return (
    <div className="min-h-svh bg-marca-claro">
      <AdminNav />
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}
