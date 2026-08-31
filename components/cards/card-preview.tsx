import type { Genre, Rarity, Trait } from "@/lib/supabase/types";
import { RARITY_LABELS } from "@/lib/supabase/types";
import { RARITY_ACCENT_CLASS } from "@/lib/supabase/rarity-colors";
import { capitalizeFirst } from "@/lib/utils/capitalize";

// Cómo un jugador va a ver una carta. La usa tanto el form de /admin/cards
// (para previsualizar antes de guardar) como /coleccion/[slug] (el detalle
// real) -- por eso no tiene nada admin-específico.
//
// Muestra las dos habilidades del género (Base y Fandom) siempre, a
// pedido: is_fandom se sigue guardando por carta (para cuando exista el
// motor de juego que lo use), pero hoy el jugador ve las dos igual.
export function CardPreview({
  imageUrl,
  name,
  rarity,
  score,
  genre,
  trait,
  artist,
}: {
  imageUrl: string | null;
  name: string;
  rarity: Rarity;
  // OJO: no recibe power a propósito. power está oculto para el jugador
  // por decisión de diseño -- este componente simula lo que el jugador ve,
  // así que ni siquiera debería ser posible que termine mostrándolo.
  score: number | null;
  genre: Genre | null;
  trait: Trait | null;
  artist?: string | null;
}) {
  return (
    <div
      className={`w-full max-w-xs overflow-hidden rounded-xl border-2 bg-white shadow-sm ${RARITY_ACCENT_CLASS[rarity]}`}
    >
      {/* 2.5x3.5in / 63.5x88.9mm, el tamaño estándar de TCG (Magic/Pokémon/Yu-Gi-Oh). */}
      <div className="aspect-[5/7] w-full bg-marca-noche/10">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview de un archivo local (object URL) o remoto, sin necesidad de optimización
          <img
            src={imageUrl}
            alt={name || "Carta"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-marca-noche/40">
            Sin imagen
          </div>
        )}
      </div>

      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg leading-tight">{name || "Nombre de la carta"}</h3>
          <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold normal-case tracking-wide">
            {RARITY_LABELS[rarity]}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-marca-noche/80">
          {genre && <span>{genre.name}</span>}
          {trait && <span>{trait.name}</span>}
          <span>Puntaje {score !== null ? score.toFixed(1) : "SP"}</span>
        </div>

        {trait && (
          <div className="rounded border border-marca-noche/10 bg-marca-noche/5 p-2 text-xs leading-snug text-marca-noche/90">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-marca-noche/50">
              Habilidad de Rasgo
            </p>
            <p className="mt-0.5">
              <strong>{trait.ability_name}</strong>: {capitalizeFirst(trait.ability_text)}
            </p>
          </div>
        )}

        {genre && (
          <div className="rounded border border-marca-noche/10 bg-marca-noche/5 p-2 text-xs leading-snug text-marca-noche/90">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-marca-noche/50">
              Habilidad de Género
            </p>
            <p className="mt-0.5">
              <strong>{genre.base_ability_name}</strong>{" "}
              <span className="font-light text-marca-noche/50">- Base</span>:{" "}
              {capitalizeFirst(genre.base_ability_text)}
            </p>
            <p className="mt-1">
              <strong>{genre.fandom_ability_name}</strong>{" "}
              <span className="font-light text-marca-noche/50">- Fandom</span>:{" "}
              {capitalizeFirst(genre.fandom_ability_text)}
            </p>
          </div>
        )}

        {artist && (
          <p className="text-right text-[10px] normal-case text-marca-noche/50">
            Arte: {artist}
          </p>
        )}
      </div>
    </div>
  );
}
