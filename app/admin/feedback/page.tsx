import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEEDBACK_TYPE_LABELS } from "@/lib/supabase/types";
import type { Feedback } from "@/lib/supabase/types";
import { profileLabel } from "@/lib/utils/profile-label";
import { EmptyState } from "@/components/ui/empty-state";
import type { PublicProfile } from "@/lib/supabase/types";

const TYPE_COLORS: Record<Feedback["type"], string> = {
  falla: "bg-marca-rojo/10 text-marca-rojo",
  sugerencia: "bg-marca-violeta/10 text-marca-violeta",
  otro: "bg-marca-noche/10 text-marca-noche/70",
};

export default async function AdminFeedbackPage() {
  // Repite el guard del layout: esta página lee `feedback` (sin policy de
  // SELECT para nadie salvo service_role) directo con el cliente admin.
  await requireAdminOrRedirect();
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("feedback")
    .select("id, user_id, type, page_path, message, created_at")
    .order("created_at", { ascending: false });

  const feedback = (rows as Feedback[] | null) ?? [];

  const userIds = Array.from(
    new Set(feedback.map((f) => f.user_id).filter((id): id is string => id !== null)),
  );

  const profilesById = new Map<string, PublicProfile>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, player_code, avatar_url")
      .in("id", userIds);
    for (const p of (profiles as PublicProfile[] | null) ?? []) {
      profilesById.set(p.id, p);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Feedback</h1>

      <div className="flex flex-col gap-3">
        {feedback.map((item) => {
          const profile = item.user_id ? profilesById.get(item.user_id) : null;
          return (
            <div key={item.id} className="rounded-lg border border-marca-noche/10 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${TYPE_COLORS[item.type]}`}
                  >
                    {FEEDBACK_TYPE_LABELS[item.type]}
                  </span>
                  <span className="text-xs text-marca-noche/60">
                    {profile ? profileLabel(profile) : "Jugador sin sesión"}
                  </span>
                </div>
                <span className="text-xs text-marca-noche/50">
                  {new Date(item.created_at).toLocaleString("es-CO")}
                </span>
              </div>
              <p className="mt-2 text-sm text-marca-noche">{item.message}</p>
              <p className="mt-2 font-mono text-xs text-marca-noche/40">{item.page_path}</p>
            </div>
          );
        })}
        {feedback.length === 0 && (
          <EmptyState icon="💬" message="Todavía no llegó feedback de ningún jugador." compact />
        )}
      </div>
    </div>
  );
}
