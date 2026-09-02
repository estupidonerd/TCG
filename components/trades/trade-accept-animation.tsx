"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { CardArtOverlay } from "@/components/cards/card-art-overlay";
import type { CardTemplate, Genre, Trait } from "@/lib/supabase/types";

export type CrossingCard = {
  id: string;
  name: string;
  image_front_url: string | null;
  power: number | null;
  score: number | null;
  use_card_name_as_display: boolean;
  display_line_1: string | null;
  display_line_2: string | null;
  display_line_3: string | null;
  apply_art_template: boolean;
  name_shadow_intensity: number;
  name_font_size: number;
  name_line_height: number;
  genre: Pick<Genre, "color_hex" | "icon_url"> | null;
  trait: Pick<Trait, "color_hex" | "icon_url"> | null;
};

const MAX_SHOWN = 4;

// Overlay de un solo uso (montado/desmontado por el padre con una condición
// simple, sin AnimatePresence -- ver la nota en pack-opening.tsx sobre el
// bug de framer-motion 13.1.1 con exit). El cierre se dispara por
// setTimeout en vez de onAnimationComplete para no depender de que un
// elemento puntual (que podría no existir si un lado viene vacío) dispare
// el callback.
export function TradeAcceptAnimation({
  offered,
  requested,
  cardTemplate,
  onComplete,
}: {
  offered: CrossingCard[];
  requested: CrossingCard[];
  cardTemplate: CardTemplate | null;
  onComplete: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const duration = reducedMotion ? 0.3 : 0.9;
  const stagger = reducedMotion ? 0 : 0.08;
  const shownOffered = offered.slice(0, MAX_SHOWN);
  const shownRequested = requested.slice(0, MAX_SHOWN);
  const maxCount = Math.max(shownOffered.length, shownRequested.length, 1);
  const totalMs = (duration + stagger * (maxCount - 1) + 0.4) * 1000;

  useEffect(() => {
    const timer = setTimeout(onComplete, totalMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 p-6"
      style={{ backgroundColor: "rgba(0, 0, 33, 0.9)" }}
    >
      <p className="text-lg font-bold text-white">¡Intercambio aceptado!</p>

      <div className="flex w-full max-w-md items-center justify-between">
        <div className="flex gap-2">
          {shownOffered.map((card, i) => (
            <motion.div
              key={card.id}
              className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md border-2 border-white shadow-lg"
              initial={{ x: 0, opacity: 1 }}
              animate={{ x: 200, opacity: [1, 1, 0] }}
              transition={{ duration, delay: i * stagger, ease: "easeInOut" }}
            >
              <CardFace card={card} cardTemplate={cardTemplate} />
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2">
          {shownRequested.map((card, i) => (
            <motion.div
              key={card.id}
              className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md border-2 border-white shadow-lg"
              initial={{ x: 0, opacity: 1 }}
              animate={{ x: -200, opacity: [1, 1, 0] }}
              transition={{ duration, delay: i * stagger, ease: "easeInOut" }}
            >
              <CardFace card={card} cardTemplate={cardTemplate} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CardFace({ card, cardTemplate }: { card: CrossingCard; cardTemplate: CardTemplate | null }) {
  if (!card.image_front_url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-400 text-xs text-white">
        ?
      </div>
    );
  }
  return (
    <>
      <Image
        src={card.image_front_url}
        alt={card.name}
        fill
        sizes="60px"
        className="object-cover"
        draggable={false}
        onContextMenu={(event) => event.preventDefault()}
      />
      <CardArtOverlay
        variant="coleccion"
        template={cardTemplate}
        applyArtTemplate={card.apply_art_template}
        name={card.name}
        useCardNameAsDisplay={card.use_card_name_as_display}
        displayLine1={card.display_line_1}
        displayLine2={card.display_line_2}
        displayLine3={card.display_line_3}
        nameShadowIntensity={card.name_shadow_intensity}
        nameFontSize={card.name_font_size}
        nameLineHeight={card.name_line_height}
        power={card.power}
        score={card.score}
        genre={card.genre}
        trait={card.trait}
      />
    </>
  );
}
