"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/components/providers/user-provider";
import { TradeBadge } from "./trade-badge";

const LINKS = [
  { href: "/coleccion", label: "Colección" },
  { href: "/canjear", label: "Canjear" },
  { href: "/intercambios", label: "Intercambios" },
  { href: "/contactos", label: "Amigos" },
  { href: "/imprimir", label: "Imprimir" },
];

// Nav mínima para las rutas que requieren sesión. Sin esto no había forma
// de llegar a /canjear (y al resto) más que escribiendo la URL a mano.
export function SiteNav() {
  const { user, loading } = useUser();
  const pathname = usePathname();

  // /admin tiene su propia nav (AdminNav) en flujo normal, arriba de todo
  // -- este nav flotante se superponía con ella. El panel de admin no
  // necesita el menú de navegación del jugador.
  if (loading || !user || pathname.startsWith("/admin")) return null;

  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex items-center ${
              active
                ? "text-marca-violeta underline underline-offset-2"
                : "text-marca-noche/70 hover:text-marca-violeta"
            }`}
          >
            {link.label}
            {link.href === "/intercambios" && <TradeBadge />}
          </Link>
        );
      })}
    </nav>
  );
}
