import Link from "next/link";

// Enlace pequeño y discreto hacia el acceso del equipo, para la pantalla de
// aviso. Pensado para fondo azul casi negro.
export function TeamAccessLink() {
  return (
    <Link
      href="/acceso-equipo"
      className="mt-10 text-xs font-light text-white/40 underline-offset-4 transition-colors hover:text-white/70 hover:underline focus-visible:text-white/70 focus-visible:underline"
    >
      Acceso del equipo
    </Link>
  );
}
