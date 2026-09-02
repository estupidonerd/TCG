"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import type { CardTemplate, CollectionCard, Genre, Trait } from "@/lib/supabase/types";
import { RARITY_BORDER_CLASS } from "@/lib/supabase/rarity-colors";
import { CardArtOverlay } from "@/components/cards/card-art-overlay";

// El delay de entrada escalonada se cubre solo para las primeras ~24
// cartas (más o menos una pantalla): con cientos de cartas, seguir sumando
// delay por índice haría que las últimas tardaran varios segundos en
// aparecer sin necesidad, ya que de todos modos entran lazy.
const MAX_STAGGER_INDEX = 24;
const STAGGER_STEP = 0.02;

export function CollectionCardTile({
  card,
  index,
  reducedMotion,
  genre,
  trait,
  cardTemplate,
}: {
  card: CollectionCard;
  index: number;
  reducedMotion: boolean;
  genre: Genre | null;
  trait: Trait | null;
  cardTemplate: CardTemplate | null;
}) {
  const owned = card.quantity > 0;

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 16, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { delay: Math.min(index, MAX_STAGGER_INDEX) * STAGGER_STEP, duration: 0.3 }
      }
    >
      <Link href={`/coleccion/${card.slug}`} className="group block">
        <div style={{ perspective: reducedMotion ? undefined : 600 }}>
          <motion.div
            whileHover={reducedMotion ? undefined : { rotateX: 5, rotateY: -5, scale: 1.04 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`relative aspect-[5/7] w-full overflow-hidden rounded-lg border-2 shadow-sm ${RARITY_BORDER_CLASS[card.rarity]}`}
          >
            {owned && card.image_front_url ? (
              <Image
                src={card.image_front_url}
                alt={card.name}
                fill
                loading="lazy"
                sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 23vw, (max-width: 1280px) 18vw, 15vw"
                className="object-cover"
                draggable={false}
                onContextMenu={(event) => event.preventDefault()}
              />
            ) : (
              // Sin dueño: ni siquiera se pide la imagen (son cientos de
              // cartas potencialmente, no tiene sentido bajar el arte de
              // las que el jugador no tiene solo para taparla).
              <div className="flex h-full w-full items-center justify-center bg-gray-400">
                <span className="text-2xl text-white" aria-hidden="true">
                  ?
                </span>
              </div>
            )}

            {owned && (
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
                genre={genre}
                trait={trait}
              />
            )}

            {card.quantity > 1 && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-marca-rojo px-2 py-0.5 text-xs font-bold text-white shadow">
                x{card.quantity}
              </span>
            )}
          </motion.div>
        </div>
        <p
          className={`mt-1 truncate text-center text-xs font-medium ${
            owned ? "text-marca-noche" : "text-marca-noche/40"
          }`}
        >
          {card.name}
        </p>
      </Link>
    </motion.div>
  );
}
