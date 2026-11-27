import Link from "next/link";
import { getAccessState } from "@/lib/access/get-access-state";

// Aviso = amarillo, Cerrado = rojo: así el admin distingue de un vistazo en
// qué modo está el juego.
const MODES = {
  notice: { label: "Aviso", className: "bg-marca-amarillo text-marca-noche" },
  closed: { label: "Cerrado", className: "bg-marca-rojo text-marca-claro" },
} as const;

// Banner en todo /admin mientras el modo no sea Abierto, para que no se
// olvide reabrir el juego. Si no se pudo leer el estado, no muestra nada.
export async function AccessBanner() {
  const state = await getAccessState();
  if (state.access_mode === "open") return null;
  const mode = MODES[state.access_mode];

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-bold ${mode.className}`}
    >
      <span>{`El juego está en modo ${mode.label}`}</span>
      <Link href="/admin/portada/acceso" className="font-semibold underline underline-offset-2">
        Cambiar
      </Link>
    </div>
  );
}
