"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/providers/user-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { profileLabel } from "@/lib/utils/profile-label";
import type { PublicProfile } from "@/lib/supabase/types";

type BlockedEntry = { blockedId: string; profile: PublicProfile | null };

// Desbloquear es un delete directo por RLS (blocked_users_delete_own): a
// diferencia de bloquear, no tiene efectos secundarios que necesiten una
// función security definer.
export function BlockedUsersSection({
  initialBlockedUsers,
}: {
  initialBlockedUsers: BlockedEntry[];
}) {
  const { user } = useUser();
  const [blocked, setBlocked] = useState(initialBlockedUsers);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleUnblock = async (blockedId: string) => {
    if (!user) return;
    setRemovingId(blockedId);
    const supabase = createClient();
    const { error } = await supabase
      .from("blocked_users")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", blockedId);
    setRemovingId(null);
    if (!error) {
      setBlocked((prev) => prev.filter((b) => b.blockedId !== blockedId));
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-marca-noche/10 bg-white p-4">
      <h2 className="text-lg font-bold text-marca-noche">Usuarios bloqueados</h2>

      {blocked.length === 0 ? (
        <EmptyState icon="🛡️" message="No tienes a nadie bloqueado." compact />
      ) : (
        <ul className="flex flex-col gap-2">
          {blocked.map((entry) => (
            <li
              key={entry.blockedId}
              className="flex items-center justify-between gap-3 rounded-lg border border-marca-noche/10 px-3 py-2.5"
            >
              <span className="truncate text-sm font-semibold text-marca-noche">
                {entry.profile ? profileLabel(entry.profile) : "Jugador"}
              </span>
              <button
                type="button"
                onClick={() => handleUnblock(entry.blockedId)}
                disabled={removingId === entry.blockedId}
                className="shrink-0 touch-manipulation rounded-full border border-marca-noche/20 px-3 py-1.5 text-xs font-semibold text-marca-noche/60 transition-colors hover:border-marca-violeta hover:text-marca-violeta disabled:opacity-50"
              >
                {removingId === entry.blockedId ? "Desbloqueando…" : "Desbloquear"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
