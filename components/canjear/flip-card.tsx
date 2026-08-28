"use client";

import { motion } from "framer-motion";
import { RARITY_LABELS } from "@/lib/supabase/types";
import type { RedeemedCard } from "@/lib/supabase/types";
import { RARITY_BORDER_CLASS } from "@/lib/supabase/rarity-colors";

// Piden brillo especial solo para rara y legendaria (no épica): se respeta
// tal cual, es una decisión de diseño del juego, no un olvido nuestro.
const GLOW_RARITIES = new Set(["rara", "legendaria"]);

export function FlipCard({
  card,
  cardBackUrl,
  flipped,
  index,
  reducedMotion,
  onFlip,
}: {
  card: RedeemedCard;
  cardBackUrl: string | null;
  flipped: boolean;
  index: number;
  reducedMotion: boolean;
  onFlip: () => void;
}) {
  const hasGlow = flipped && GLOW_RARITIES.has(card.rarity);

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reducedMotion ? { duration: 0 } : { delay: index * 0.12, duration: 0.4 }
      }
      className="flex flex-col gap-1"
    >
      <div style={{ perspective: 1000 }}>
        <button
          type="button"
          onClick={onFlip}
          disabled={flipped}
          aria-label={flipped ? `${card.name}, ${RARITY_LABELS[card.rarity]}` : "Tocar para revelar la carta"}
          className={`relative aspect-[5/7] w-full touch-manipulation select-none rounded-xl ring-4 ring-transparent transition-all ${
            hasGlow
              ? "animate-pulse shadow-[0_0_24px_6px_var(--marca-amarillo)] ring-marca-amarillo"
              : ""
          }`}
        >
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.5 }}
          >
            {/* Dorso: único para todo el juego. Borde claro mientras no se
                reveló la rareza. El fondo de la página es el mismo color
                (marca-claro), así que sin sombra el borde quedaba
                invisible -- la sombra es lo que lo hace notarse. */}
            <div className="absolute inset-0 overflow-hidden rounded-xl border-2 border-marca-claro shadow-md [backface-visibility:hidden]">
              {cardBackUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagen remota, sin necesidad de next/image
                <img src={cardBackUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-marca-violeta text-3xl text-white">
                  ?
                </div>
              )}
            </div>

            {/* Frente: la carta obtenida. Borde según rareza una vez
                revelada (gris para común, color de marca para el resto). */}
            <div
              className={`absolute inset-0 overflow-hidden rounded-xl border-2 bg-white shadow-md [backface-visibility:hidden] ${RARITY_BORDER_CLASS[card.rarity]}`}
              style={{ transform: "rotateY(180deg)" }}
            >
              {card.image_front_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagen remota, sin necesidad de next/image
                <img
                  src={card.image_front_url}
                  alt={card.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
                  <span className="text-sm font-semibold text-marca-noche">
                    {card.name}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </button>
      </div>

      <p className="min-h-[1.5em] text-center text-xs font-medium text-marca-noche/70">
        {flipped ? `${card.name} · ${RARITY_LABELS[card.rarity]}` : ""}
      </p>
    </motion.div>
  );
}
