"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/providers/user-provider";
import type { PublicProfile } from "@/lib/supabase/types";

// Botón reutilizable para guardar a alguien en la libreta de contactos
// desde cualquier perfil público que se vea en la app (por ejemplo, la
// otra parte de un intercambio). contacts tiene policies de RLS directas
// (user_id = auth.uid()), así que el insert va directo desde el cliente,
// sin Server Action.
export function SaveContactButton({
  profile,
  alreadySaved,
}: {
  profile: PublicProfile;
  alreadySaved: boolean;
}) {
  const { user } = useUser();
  const [saved, setSaved] = useState(alreadySaved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user || user.id === profile.id) return null;

  if (saved) {
    return (
      <span className="text-xs font-semibold text-marca-noche/40">
        ✓ En tus amigos
      </span>
    );
  }

  const handleSave = async () => {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("contacts")
      .insert({ user_id: user.id, contact_user_id: profile.id });
    setPending(false);

    if (insertError) {
      setError("No se pudo guardar.");
      return;
    }
    setSaved(true);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="touch-manipulation rounded-full border border-marca-violeta px-3 py-1.5 text-xs font-semibold text-marca-violeta transition-colors hover:bg-marca-violeta hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Agregando…" : "Agregar amigo"}
      </button>
      {error && <span className="text-xs text-marca-rojo">{error}</span>}
    </div>
  );
}
