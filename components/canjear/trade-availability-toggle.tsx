"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Interruptor binario para el resultado del sobre: a diferencia del
// selector fino de /coleccion (0 a quantity-1), acá "on" = todos los
// duplicados públicos (quantity - 1) y "off" = todos privados (0).
export function TradeAvailabilityToggle({
  cardId,
  quantity,
  initialAvailable,
}: {
  cardId: string;
  quantity: number;
  initialAvailable: boolean;
}) {
  const [available, setAvailable] = useState(initialAvailable);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    const next = !available;
    const previous = available;
    setAvailable(next);
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_card_public_quantity", {
      p_card_id: cardId,
      p_public_quantity: next ? quantity - 1 : 0,
    });
    setPending(false);
    if (error) setAvailable(previous);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={available}
      aria-label="Disponible para intercambio"
      className={`relative h-6 w-11 shrink-0 touch-manipulation rounded-full transition-colors disabled:opacity-50 ${
        available ? "bg-marca-violeta" : "bg-marca-noche/20"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          available ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
