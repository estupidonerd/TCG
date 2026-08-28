"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@/components/providers/user-provider";
import { createClient } from "@/lib/supabase/client";

export function UserMenu() {
  const { user, profile, loading } = useUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Nada que mostrar mientras se resuelve la sesión, ni si no hay usuario.
  // En /admin se oculta también: se superponía con AdminNav, y ese panel
  // ya tiene su propio acceso a cerrar sesión.
  if (loading || !user || pathname.startsWith("/admin")) return null;

  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const displayName =
    profile?.display_name ||
    (metadata?.full_name as string | undefined) ||
    (metadata?.name as string | undefined) ||
    user.email ||
    "Jugador";

  const avatarUrl =
    profile?.avatar_url ||
    (metadata?.avatar_url as string | undefined) ||
    (metadata?.picture as string | undefined) ||
    null;

  const initial = displayName.charAt(0).toUpperCase();

  const handleCopy = async () => {
    if (!profile?.player_code) return;
    try {
      await navigator.clipboard.writeText(profile.player_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard puede fallar por permisos del navegador; no es crítico.
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menú de usuario"
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-marca-noche bg-marca-violeta text-sm font-bold text-white shadow-sm"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar remoto (Google), sin necesidad de optimización de next/image
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-black/10 bg-marca-claro p-4 text-left shadow-lg"
        >
          <p className="truncate text-sm font-semibold text-marca-noche">
            {displayName}
          </p>

          {profile?.player_code && (
            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 flex w-full items-center justify-between gap-2 rounded border border-black/10 bg-white px-3 py-2 text-left transition-colors hover:bg-black/[.03]"
            >
              <span className="font-mono text-sm tracking-wider text-marca-noche">
                {profile.player_code}
              </span>
              <span className="shrink-0 text-xs font-medium text-marca-violeta">
                {copied ? "¡Copiado!" : "Copiar"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="mt-3 w-full rounded border border-marca-rojo px-3 py-2 text-sm font-semibold text-marca-rojo transition-colors hover:bg-marca-rojo hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </div>
      )}
    </div>
  );
}
