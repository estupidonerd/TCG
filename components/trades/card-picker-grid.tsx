"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { RARITY_BORDER_CLASS } from "@/lib/supabase/rarity-colors";
import { EmptyState } from "@/components/ui/empty-state";
import { CardArtOverlay } from "@/components/cards/card-art-overlay";
import type { CardTemplate, Genre, Rarity, Trait } from "@/lib/supabase/types";

export type PickableCard = {
  id: string;
  name: string;
  rarity: Rarity;
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

// Grilla de selección con stepper de cantidad por carta, usada tanto para
// elegir qué ofrezco (mi colección) como qué pido (la colección del otro).
// Pensada para el pulgar: los botones +/- son grandes y todo el tile es
// tocable.
//
// La separación entre tiles se logra con PADDING en un wrapper por celda,
// no con la propiedad gap del grid: en el Safari donde se probó esto, gap
// no se estaba aplicando y las cartas quedaban pegadas unas a otras.
// padding es universal (no depende de que el navegador soporte gap en
// grid), así que funciona siempre, incluso si gap también anduviera bien.
export function CardPickerGrid({
  cards,
  maxByCard,
  selected,
  onChange,
  emptyMessage,
  cardTemplate,
}: {
  cards: PickableCard[];
  maxByCard: Record<string, number>;
  selected: Map<string, number>;
  onChange: (cardId: string, quantity: number) => void;
  emptyMessage: string;
  cardTemplate: CardTemplate | null;
}) {
  const [query, setQuery] = useState("");

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) => card.name.toLowerCase().includes(q));
  }, [cards, query]);

  if (cards.length === 0) {
    return <EmptyState icon="🃏" message={emptyMessage} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.length > 6 && (
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar carta por nombre…"
          className="w-full rounded-lg border border-marca-noche/20 px-3 py-2.5 text-sm focus:border-marca-violeta focus:outline-none"
        />
      )}

      {filteredCards.length === 0 ? (
        <EmptyState icon="🔍" message={`Ninguna carta coincide con "${query}".`} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5">
          {filteredCards.map((card) => {
            const max = maxByCard[card.id] ?? 0;
            const qty = selected.get(card.id) ?? 0;
            const isSelected = qty > 0;

            return (
              <div key={card.id} className="p-1.5">
                <div
                  className={`flex flex-col overflow-hidden rounded-lg border-2 ${
                    isSelected ? "border-marca-violeta" : RARITY_BORDER_CLASS[card.rarity]
                  }`}
                >
                  <div className="relative aspect-[5/7] w-full bg-gray-200">
                    {card.image_front_url ? (
                      <>
                        <Image
                          src={card.image_front_url}
                          alt={card.name}
                          fill
                          sizes="150px"
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
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-400 text-white">
                        ?
                      </div>
                    )}
                    {max > 0 && (
                      <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        x{max}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate px-1.5 text-center text-xs font-medium text-marca-noche">
                    {card.name}
                  </p>

                  <div className="mb-1.5 mt-1 flex items-center justify-center gap-2 px-1.5">
                    <button
                      type="button"
                      onClick={() => onChange(card.id, Math.max(0, qty - 1))}
                      disabled={qty === 0}
                      className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-marca-noche/20 text-lg font-bold leading-none disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Restar ${card.name}`}
                    >
                      −
                    </button>
                    <span className="w-4 shrink-0 text-center text-sm font-bold">{qty}</span>
                    <button
                      type="button"
                      onClick={() => onChange(card.id, Math.min(max, qty + 1))}
                      disabled={qty >= max}
                      className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-marca-noche/20 text-lg font-bold leading-none disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Sumar ${card.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
