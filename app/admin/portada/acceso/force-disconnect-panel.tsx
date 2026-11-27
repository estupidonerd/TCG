"use client";

import { useState, useTransition } from "react";
import { ErrorMessage } from "@/components/admin/submit-button";
import { disconnectAllPlayers } from "./actions";

// Botón con confirmación en línea (no un modal): funciona bien en celular y no
// depende de window.confirm.
export function ForceDisconnectPanel({ initialEpoch }: { initialEpoch: number }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [epoch, setEpoch] = useState(initialEpoch);

  const confirm = () => {
    setError(null);
    setDone(false);
    startTransition(async () => {
      try {
        const result = await disconnectAllPlayers();
        setEpoch(result.epoch);
        setConfirming(false);
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl">Desconexión forzada</h2>
      <p className="max-w-xl text-sm text-marca-noche/70">
        Cierra la sesión de todos los jugadores la próxima vez que carguen una página. Quien tenga
        una pestaña abierta puede seguir hasta que la recargue. Los administradores no se desconectan.
      </p>

      <ErrorMessage message={error} />
      {done && (
        <p
          role="status"
          className="rounded border border-marca-violeta/40 bg-marca-violeta/10 px-3 py-2 text-sm text-marca-violeta"
        >
          Listo: todos los jugadores tendrán que volver a iniciar sesión.
        </p>
      )}

      {!confirming ? (
        <div>
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setConfirming(true);
            }}
            className="touch-manipulation rounded border border-marca-rojo px-4 py-2 text-sm font-semibold text-marca-rojo transition-colors hover:bg-marca-rojo/10"
          >
            Desconectar a todos los jugadores
          </button>
        </div>
      ) : (
        <div className="flex max-w-xl flex-col gap-3 rounded-lg border border-marca-rojo/40 bg-marca-rojo/5 p-4">
          <p className="text-sm font-semibold text-marca-noche">
            Todos tendrán que volver a iniciar sesión. Tú no serás desconectado.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="touch-manipulation rounded bg-marca-rojo px-4 py-2 text-sm font-semibold text-marca-claro transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Desconectando…" : "Sí, desconectar a todos"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="touch-manipulation rounded border border-marca-noche/30 bg-white px-4 py-2 text-sm font-semibold text-marca-noche transition-colors hover:bg-marca-noche/5 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-marca-noche/50">Desconexiones forzadas hasta ahora: {epoch}</p>
    </section>
  );
}
