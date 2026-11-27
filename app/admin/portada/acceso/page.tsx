import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseAccessState } from "@/lib/access/fetch-state";
import { AccessForm } from "./access-form";
import { ForceDisconnectPanel } from "./force-disconnect-panel";

export const metadata = { title: "Acceso y aviso" };

export default async function AccesoYAvisoPage() {
  // Mismo criterio que /admin/ajustes: se repite el guard acá y no solo en el
  // layout, porque esta página lee con service_role.
  await requireAdminOrRedirect();

  // Lectura directa (sin la caché de ~30 s): el admin tiene que ver el valor
  // real, no uno viejo.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("game_settings")
    .select("access_mode, notice_title, notice_body, notice_text_color, notice_return_text, session_epoch")
    .eq("id", true)
    .single();

  const state = error ? null : parseAccessState(data);

  if (!state) {
    return (
      <p className="rounded border border-marca-rojo/40 bg-marca-rojo/10 px-3 py-2 text-sm text-marca-rojo">
        No se pudo leer el estado de acceso ({error?.message ?? "datos inesperados"}). ¿Ya corriste la
        migración 20260921000000_access_notice.sql en este proyecto?
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <AccessForm initial={state} />
      <ForceDisconnectPanel initialEpoch={state.session_epoch} />
    </div>
  );
}
