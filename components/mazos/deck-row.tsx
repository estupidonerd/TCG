"use client";

import Link from "next/link";
import Image from "next/image";
import { CardArtOverlay } from "@/components/cards/card-art-overlay";
import type { CardTemplate, Genre, Trait } from "@/lib/supabase/types";

export function copyLimit(power: number | null): number {
  const p = power ?? 5;
  if (p === 0) return Infinity;
  if (p === 10) return 1;
  return 3;
}

export function copyLimitLabel(power: number | null): string {
  const p = power ?? 5;
  if (p === 0) return "Ilimitado";
  if (p === 10) return "Máx. 1";
  return "Máx. 3";
}

export type DeckRowCard = {
  id: string;
  slug: string;
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
  owned: number;
};

// Fila compacta pensada para elegir rápido entre 100 cartas: sin la
// tarjeta grande de /coleccion, con el selector +/- directo acá. Tocar la
// miniatura o el nombre abre el detalle grande en una pestaña nueva (para
// no perder el armado en curso), pero nunca es el único camino para
// agregar la carta -- el selector alcanza solo.
export function DeckRow({
  card,
  genreName,
  traitName,
  cardTemplate,
  quantity,
  max,
  onChange,
}: {
  card: DeckRowCard;
  genreName: string | null;
  traitName: string | null;
  cardTemplate: CardTemplate | null;
  quantity: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const atMax = quantity >= max;
  const isSelected = quantity > 0;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-2 ${
        isSelected ? "border-marca-violeta bg-marca-violeta/5" : "border-marca-noche/10 bg-white"
      }`}
    >
      <Link
        href={`/coleccion/${card.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="relative h-14 w-10 shrink-0 overflow-hidden rounded border border-marca-noche/10 bg-gray-200"
      >
        {card.image_front_url ? (
          <>
            <Image
              src={card.image_front_url}
              alt={card.name}
              fill
              sizes="40px"
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
          <div className="flex h-full w-full items-center justify-center bg-gray-400 text-[10px] text-white">
            ?
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/coleccion/${card.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm font-semibold text-marca-noche hover:underline"
        >
          {card.name}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {genreName && (
            <span className="rounded-full bg-marca-noche/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-marca-noche/70">
              {genreName}
            </span>
          )}
          {traitName && (
            <span className="rounded-full bg-marca-noche/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-marca-noche/70">
              {traitName}
            </span>
          )}
          <span className="rounded-full border border-marca-noche/15 px-1.5 py-0.5 text-[10px] font-semibold text-marca-noche/60">
            {copyLimitLabel(card.power)}
          </span>
        </div>
      </div>

      <span className="shrink-0 text-xs text-marca-noche/50">
        Tienes {card.owned}
      </span>

      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(quantity - 1)}
            disabled={quantity === 0}
            aria-label={`Quitar ${card.name} del mazo`}
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-marca-noche/20 text-lg font-bold leading-none disabled:cursor-not-allowed disabled:opacity-30"
          >
            −
          </button>
          <span className="w-4 text-center text-sm font-bold">{quantity}</span>
          <button
            type="button"
            onClick={() => onChange(quantity + 1)}
            disabled={atMax}
            aria-label={`Agregar ${card.name} al mazo`}
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-marca-noche/20 text-lg font-bold leading-none disabled:cursor-not-allowed disabled:opacity-30"
          >
            +
          </button>
        </div>
        {atMax && (
          <span className="text-[9px] font-semibold text-marca-rojo">
            {card.owned <= copyLimit(card.power) ? "No tienes más" : "Máximo del mazo"}
          </span>
        )}
      </div>
    </div>
  );
}
