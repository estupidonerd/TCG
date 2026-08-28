"use client";

import { usePathname } from "next/navigation";
import { useUser } from "@/components/providers/user-provider";
import { SiteNav } from "./site-nav";
import { UserMenu } from "@/components/auth/user-menu";

// Antes SiteNav y UserMenu eran dos <div> "fixed" flotando sobre el
// contenido, y cada página tenía que adivinar cuánto padding-top necesitaba
// para no quedar tapada -- ese número variaba según cuánto ocupaba el nav
// (que además renderiza distinto entre navegadores), y en Safari terminaba
// solapado. Este header ocupa espacio real en el flujo del documento
// (position: sticky, no fixed), así que el resto de la página cae debajo
// sola, sin adivinar nada ni depender del navegador.
export function SiteHeader() {
  const { user, loading } = useUser();
  const pathname = usePathname();

  // /admin tiene su propia nav (AdminNav) -- este header es solo para las
  // rutas de jugador.
  if (loading || !user || pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-marca-noche/5 bg-marca-claro px-4 py-3 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] [padding-top:max(0.75rem,env(safe-area-inset-top))] print:hidden sm:px-6">
      <SiteNav />
      <UserMenu />
    </header>
  );
}
