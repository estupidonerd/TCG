import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersTable, type AdminPlayer } from "./users-table";

export default async function AdminUsuariosPage() {
  // Repite el guard del layout: esta página lee profiles completo con el
  // cliente service_role (para ver banned_until de todos, no solo el
  // propio), y Next puede empezar a renderizarla en paralelo con el layout.
  await requireAdminOrRedirect();
  const admin = createAdminClient();

  const { data: players } = await admin.rpc("admin_list_players");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Usuarios</h1>
      <UsersTable players={(players as AdminPlayer[] | null) ?? []} />
    </div>
  );
}
