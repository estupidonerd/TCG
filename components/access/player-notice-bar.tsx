"use client";

import { usePathname } from "next/navigation";
import { DEFAULT_NOTICE_BODY, DEFAULT_NOTICE_TITLE } from "@/lib/access/constants";

// Franja roja que ven los jugadores con sesión mientras el modo es Aviso. Los
// que ya iniciaron sesión no pasan por /login, así que sin esto nunca verían el
// cartel. El color de fondo y del texto son fijos de la marca (no el color del
// cartel): así siempre se lee. Se esconde en /admin, que tiene su propio
// banner, y en /baneado, que es una pantalla aparte.
export function PlayerNoticeBar({
  title,
  body,
  returnText,
}: {
  title: string | null;
  body: string | null;
  returnText: string | null;
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin") || pathname === "/baneado") return null;

  const shownTitle = title?.trim() || DEFAULT_NOTICE_TITLE;
  const shownBody = body?.trim() || DEFAULT_NOTICE_BODY;
  const shownReturn = returnText?.trim() || null;

  return (
    <div
      role="status"
      className="bg-marca-rojo px-4 py-3 text-center text-marca-claro [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))] print:hidden"
    >
      <p className="text-sm font-black uppercase tracking-wide">{shownTitle}</p>
      <p className="mt-0.5 whitespace-pre-line text-sm font-light">{shownBody}</p>
      {shownReturn && <p className="mt-1 text-xs font-bold">{shownReturn}</p>}
    </div>
  );
}
