"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/sets", label: "Expansiones" },
  { href: "/admin/cards", label: "Cartas" },
  { href: "/admin/packs", label: "Sobres" },
  { href: "/admin/codes", label: "Códigos" },
  { href: "/admin/codes/stats", label: "Estadísticas" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

export function AdminNav() {
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <nav className="border-b border-marca-noche/10 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <span className="mr-2 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
          Admin
        </span>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-marca-noche hover:text-marca-violeta"
          >
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          className="ml-auto text-sm font-medium text-marca-rojo hover:underline disabled:opacity-60"
        >
          {signingOut ? "Cerrando…" : "Cerrar sesión"}
        </button>
      </div>
    </nav>
  );
}
