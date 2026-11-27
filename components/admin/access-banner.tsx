import Link from "next/link";
import { getAccessState } from "@/lib/access/get-access-state";

const LABELS = { notice: "Aviso", closed: "Cerrado" } as const;

// Banner rojo en todo /admin mientras el modo no sea Abierto, para que no se
// olvide reabrir el juego. Si no se pudo leer el estado, no muestra nada.
export async function AccessBanner() {
  const state = await getAccessState();
  if (state.access_mode === "open") return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-marca-rojo px-4 py-2 text-center text-sm font-bold text-marca-claro"
    >
      <span>{`El juego está en modo ${LABELS[state.access_mode]}`}</span>
      <Link href="/admin/portada/acceso" className="font-semibold underline underline-offset-2">
        Cambiar
      </Link>
    </div>
  );
}
