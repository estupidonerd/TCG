"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/providers/user-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { profileLabel } from "@/lib/utils/profile-label";
import type { PublicProfile } from "@/lib/supabase/types";

// Botón reutilizable para bloquear a otro jugador desde cualquier perfil
// público que se vea en la app (la otra parte de un intercambio, un
// contacto guardado). block_user() cancela intercambios pendientes entre
// los dos y saca al bloqueado de mis contactos, todo en una sola
// transacción -- por eso pasa por RPC y no por un insert directo.
export function BlockUserButton({
  profile,
  onBlocked,
}: {
  profile: PublicProfile;
  onBlocked?: () => void;
}) {
  const { user } = useUser();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.id === profile.id) return null;

  if (blocked) {
    return (
      <span className="text-xs font-semibold text-marca-noche/40">
        Jugador bloqueado ·{" "}
        <Link href="/ajustes" className="text-marca-violeta hover:underline">
          Desbloquear
        </Link>
      </span>
    );
  }

  const handleConfirm = async () => {
    setConfirming(false);
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("block_user", { p_blocked_id: profile.id });
    setPending(false);
    if (rpcError) {
      setError("No se pudo bloquear.");
      return;
    }
    setBlocked(true);
    onBlocked?.();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="touch-manipulation rounded-full border border-marca-noche/20 px-3 py-1.5 text-xs font-semibold text-marca-noche/60 transition-colors hover:border-marca-rojo hover:text-marca-rojo disabled:cursor-not-allowed disabled:opacity-50"
      >
        Bloquear
      </button>
      {error && <span className="ml-2 text-xs text-marca-rojo">{error}</span>}

      {confirming && (
        <ConfirmDialog
          message={`¿Bloquear a ${profileLabel(profile)}? Se van a cancelar los intercambios pendientes que tengan entre ustedes, y lo vamos a sacar de tus amigos si lo tenías guardado. No va a poder proponerte más intercambios hasta que lo desbloquees desde Ajustes.`}
          confirmLabel="Bloquear"
          destructive
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
