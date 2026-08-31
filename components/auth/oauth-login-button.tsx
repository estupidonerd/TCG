"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function OAuthLoginButton({
  provider,
  label,
  next = "/",
  icon,
}: {
  provider: Provider;
  label: string;
  next?: string;
  icon: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    // Si signInWithOAuth falla antes de redirigir (ej. provider mal
    // configurado en Supabase), se reactiva el botón para reintentar.
    if (error) {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex h-11 w-full items-center justify-center gap-3 rounded border border-marca-noche/15 bg-white px-4 text-sm font-semibold text-marca-noche transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-violeta disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icon}
      <span>{loading ? "Conectando…" : label}</span>
    </button>
  );
}
