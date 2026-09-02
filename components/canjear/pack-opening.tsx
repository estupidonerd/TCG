"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { usePackOpening } from "@/components/providers/pack-opening-provider";
import { RARITY_LABELS } from "@/lib/supabase/types";
import type { CardTemplate, Genre, RedeemedCard, Trait, TradeDefault } from "@/lib/supabase/types";
import { FlipCard } from "./flip-card";
import { TradeAvailabilityToggle } from "./trade-availability-toggle";

type Phase = "envelope" | "cards" | "summary";

export function PackOpening({
  cards,
  cardBackUrl,
  cardTemplate,
  genresById,
  traitsById,
  packImageUrl,
  tradeDefault,
  onReset,
}: {
  cards: RedeemedCard[];
  cardBackUrl: string | null;
  cardTemplate: CardTemplate | null;
  genresById: Map<string, Genre>;
  traitsById: Map<string, Trait>;
  packImageUrl: string | null;
  tradeDefault: TradeDefault;
  onReset: () => void;
}) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const { setIsOpeningPack } = usePackOpening();

  // El botón flotante de feedback se esconde mientras esta pantalla está
  // montada, para no taparle el botón de "Toca para abrir" ni el resumen.
  useEffect(() => {
    setIsOpeningPack(true);
    return () => setIsOpeningPack(false);
  }, [setIsOpeningPack]);

  const [phase, setPhase] = useState<Phase>(() =>
    reducedMotion ? "cards" : "envelope",
  );
  // Indexado por posición en el array, no por card_id: un mismo sobre puede
  // traer la misma carta repetida (dos copias), y si se trackeara por
  // card_id las dos instancias comparten estado -> se giran juntas, y
  // React tira "two children with the same key" porque el key del map
  // también usaba card_id.
  const [flipped, setFlipped] = useState<Set<number>>(
    () => new Set(reducedMotion ? cards.map((_, i) => i) : []),
  );

  const flipCard = (index: number) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const skip = () => {
    setFlipped(new Set(cards.map((_, i) => i)));
    setPhase("summary");
  };

  const allFlipped = flipped.size === cards.length;

  return (
    // Momento inmersivo (regla de marca): fondo #000021 a pantalla completa
    // mientras se abre el sobre, en vez del fondo claro general de la app.
    <div className="flex min-h-svh w-full flex-col items-center gap-6 bg-marca-noche px-6 py-12 text-marca-claro">
      <div className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6">
      {phase !== "summary" && (
        <button
          type="button"
          onClick={skip}
          className="touch-manipulation self-end text-sm font-medium text-marca-claro/60 hover:text-marca-claro"
        >
          Saltear
        </button>
      )}

      {/*
        A propósito NO usa AnimatePresence acá: en framer-motion 13.1.1 (la
        versión instalada) probamos exit + mode="wait" para que el sobre se
        desvaneciera antes de montar las cartas, y el exit nunca terminaba
        de resolverse -- "cards" no llegaba a montarse jamás. Se reprodujo
        hasta en un ejemplo mínimo de dos pasos sin nada específico de este
        componente, y persistía incluso sin mode="wait" (el nodo exiting
        quedaba invisible pero vivo en el DOM para siempre, un problema de
        foco/accesibilidad). Con desmontaje directo de React (sin exit) el
        sobre desaparece al toque y las cartas entran con su propio fade,
        sin depender de ese mecanismo.
      */}
      {phase === "envelope" && (
        // El rebote (y infinito) va en este mismo botón: como ya no está
        // envuelto en AnimatePresence (ver comentario de arriba), no hay
        // riesgo de que choque con un exit -- así que ahora sube y baja el
        // sobre entero, no solo la etiqueta.
        <motion.button
          type="button"
          onClick={() => setPhase("cards")}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, y: reducedMotion ? 0 : [0, -8, 0] }}
          transition={
            reducedMotion
              ? { duration: 0.3 }
              : {
                  scale: { duration: 0.3 },
                  opacity: { duration: 0.3 },
                  y: { repeat: Infinity, duration: 1.6, ease: "easeInOut", delay: 0.3 },
                }
          }
          whileTap={{ scale: 0.95 }}
          className={`relative flex h-64 w-48 touch-manipulation select-none flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl text-white shadow-xl sm:h-80 sm:w-60 ${
            packImageUrl ? "" : "bg-gradient-to-br from-marca-violeta to-marca-rojo"
          }`}
        >
          {packImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- imagen remota, sin necesidad de next/image
            <img
              src={packImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div
            className={`relative flex flex-col items-center gap-3 ${
              packImageUrl ? "mt-auto bg-marca-noche/60 px-4 py-2 backdrop-blur-sm" : ""
            }`}
          >
            {!packImageUrl && (
              <span className="text-5xl" aria-hidden="true">
                📦
              </span>
            )}
            <span className="text-sm font-bold uppercase tracking-wide">
              Toca para abrir
            </span>
          </div>
        </motion.button>
      )}

      {phase === "cards" && (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.3 }}
          className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3"
        >
          {cards.map((card, index) => (
            <FlipCard
              key={`${card.card_id}-${index}`}
              card={card}
              cardBackUrl={cardBackUrl}
              cardTemplate={cardTemplate}
              genre={card.genre_id ? (genresById.get(card.genre_id) ?? null) : null}
              trait={card.trait_id ? (traitsById.get(card.trait_id) ?? null) : null}
              flipped={flipped.has(index)}
              index={index}
              reducedMotion={reducedMotion}
              onFlip={() => flipCard(index)}
            />
          ))}
        </motion.div>
      )}

      {phase === "cards" && allFlipped && (
        <button
          type="button"
          onClick={() => setPhase("summary")}
          className="touch-manipulation rounded-xl bg-marca-rojo px-6 py-3 font-bold text-marca-claro"
        >
          Ver resumen
        </button>
      )}

      {phase === "summary" && (
        <div className="flex w-full flex-col items-center gap-4">
          <h2 className="text-2xl">Obtuviste {cards.length} cartas</h2>
          <ul className="flex w-full flex-col gap-2">
            {cards.map((card, index) => (
              <li
                key={`${card.card_id}-${index}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-marca-noche/10 bg-white px-4 py-2"
              >
                <span className="font-semibold text-marca-noche">{card.name}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-marca-noche/60">
                  {RARITY_LABELS[card.rarity]}
                  {card.is_new ? (
                    <span className="rounded-full bg-marca-amarillo px-2 py-0.5 font-bold text-marca-noche">
                      Nueva
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      Disponible para intercambio
                      <TradeAvailabilityToggle
                        cardId={card.card_id}
                        quantity={card.quantity}
                        initialAvailable={tradeDefault === "publicas"}
                      />
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/coleccion")}
              className="touch-manipulation rounded-xl bg-marca-rojo px-6 py-3 font-bold text-marca-claro"
            >
              Ir a mi colección
            </button>
            <button
              type="button"
              onClick={onReset}
              className="touch-manipulation rounded-xl border border-marca-claro/30 px-6 py-3 font-semibold text-marca-claro hover:bg-marca-claro/10"
            >
              Canjear otro código
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
