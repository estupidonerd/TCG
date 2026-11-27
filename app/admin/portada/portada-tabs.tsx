"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Para agregar una pestaña nueva (por ejemplo "Fondo y textos"): suma una
// entrada acá y crea su carpeta dentro de app/admin/portada/ con su page.tsx.
// El resto (layout, ruta base, menú) no cambia.
const TABS = [{ href: "/admin/portada/acceso", label: "Acceso y aviso" }];

export function PortadaTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de la portada" className="flex flex-wrap gap-2 border-b border-marca-noche/10">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px touch-manipulation border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? "border-marca-violeta text-marca-violeta"
                : "border-transparent text-marca-noche/70 hover:text-marca-noche"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
