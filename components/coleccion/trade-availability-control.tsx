"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Solo el stepper (-/cantidad/+) de public_quantity para una carta puntual,
// de 0 hasta quantity - 1 (siempre queda al menos 1 copia privada, lo
// garantiza el check de la tabla además de este límite en el cliente). El
// encabezado y el contenedor los pone el padre (card-detail.tsx), que
// también agrupa ahí los botones de Imprimir/Ofrecer.
export function TradeAvailabilityControl({
  cardId,
  maxPublicQuantity,
  initialPublicQuantity,
  darkPanel,
}: {
  cardId: string;
  maxPublicQuantity: number;
  initialPublicQuantity: number;
  darkPanel: boolean;
}) {
  const [publicQuantity, setPublicQuantity] = useState(initialPublicQuantity);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = maxPublicQuantity;

  const update = async (next: number) => {
    if (next < 0 || next > max || next === publicQuantity) return;
    const previous = publicQuantity;
    setPublicQuantity(next);
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_card_public_quantity", {
      p_card_id: cardId,
      p_public_quantity: next,
    });
    setPending(false);
    if (rpcError) {
      setPublicQuantity(previous);
      setError("No se pudo actualizar.");
    }
  };

  const buttonBorderClass = darkPanel ? "border-white/30" : "border-marca-noche/20";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => update(publicQuantity - 1)}
          disabled={pending || publicQuantity === 0}
          aria-label="Restar carta disponible para intercambio"
          className={`flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border text-lg font-bold leading-none disabled:cursor-not-allowed disabled:opacity-30 ${buttonBorderClass}`}
        >
          −
        </button>
        <span className="min-w-[4ch] text-center text-lg font-bold">
          {publicQuantity} / {max}
        </span>
        <button
          type="button"
          onClick={() => update(publicQuantity + 1)}
          disabled={pending || publicQuantity >= max}
          aria-label="Sumar carta disponible para intercambio"
          className={`flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border text-lg font-bold leading-none disabled:cursor-not-allowed disabled:opacity-30 ${buttonBorderClass}`}
        >
          +
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-marca-rojo">{error}</p>}
    </div>
  );
}
