"use client";

import { useMemo, useState } from "react";
import { RARITIES, RARITY_LABELS } from "@/lib/supabase/types";
import type { CardSet, CollectionCard, Genre, Rarity, Trait, TradeDefault } from "@/lib/supabase/types";
import { CollectionCardTile } from "@/components/coleccion/collection-card-tile";
import { TradeSettingsModal } from "@/components/coleccion/trade-settings-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

type OwnershipFilter = "todas" | "conseguidas" | "faltantes";

const selectClass =
  "rounded border border-marca-noche/20 bg-white px-3 py-2 text-sm text-marca-noche focus:border-marca-violeta focus:outline-none";

export function CollectionGrid({
  cards,
  sets,
  genres,
  traits,
  initialTradeDefault,
}: {
  cards: CollectionCard[];
  sets: CardSet[];
  genres: Genre[];
  traits: Trait[];
  initialTradeDefault: TradeDefault;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [showTradeSettings, setShowTradeSettings] = useState(false);
  const [expansionFilter, setExpansionFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "">("");
  const [genreFilter, setGenreFilter] = useState("");
  const [traitFilter, setTraitFilter] = useState("");
  // Default: solo conseguidas, a pedido.
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("conseguidas");

  const setsById = useMemo(() => new Map(sets.map((s) => [s.id, s])), [sets]);

  // Solo expansiones/géneros/rasgos que efectivamente tienen alguna carta
  // activa, en el orden en que aparecen las cartas (ya vienen ordenadas
  // del server).
  const setsInUse = useMemo(() => {
    const seen = new Set<string>();
    const list: CardSet[] = [];
    for (const card of cards) {
      if (!seen.has(card.set_id)) {
        seen.add(card.set_id);
        const set = setsById.get(card.set_id);
        if (set) list.push(set);
      }
    }
    return list;
  }, [cards, setsById]);

  const genresInUse = useMemo(() => {
    const idsInUse = new Set(cards.map((c) => c.genre_id).filter(Boolean));
    return genres.filter((g) => idsInUse.has(g.id));
  }, [cards, genres]);

  const traitsInUse = useMemo(() => {
    const idsInUse = new Set(cards.map((c) => c.trait_id).filter(Boolean));
    return traits.filter((t) => idsInUse.has(t.id));
  }, [cards, traits]);

  const totalObtained = useMemo(
    () => cards.filter((c) => c.quantity > 0).length,
    [cards],
  );

  const progressBySet = useMemo(() => {
    const map = new Map<string, { obtained: number; total: number }>();
    for (const card of cards) {
      const entry = map.get(card.set_id) ?? { obtained: 0, total: 0 };
      entry.total += 1;
      if (card.quantity > 0) entry.obtained += 1;
      map.set(card.set_id, entry);
    }
    return map;
  }, [cards]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (expansionFilter && card.set_id !== expansionFilter) return false;
      if (rarityFilter && card.rarity !== rarityFilter) return false;
      if (genreFilter && card.genre_id !== genreFilter) return false;
      if (traitFilter && card.trait_id !== traitFilter) return false;
      if (ownershipFilter === "conseguidas" && card.quantity === 0) return false;
      if (ownershipFilter === "faltantes" && card.quantity > 0) return false;
      return true;
    });
  }, [cards, expansionFilter, rarityFilter, genreFilter, traitFilter, ownershipFilter]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl sm:text-4xl">Colección</h1>
        <p className="text-lg font-semibold text-marca-noche">
          {totalObtained} / {cards.length} cartas conseguidas
        </p>
        {setsInUse.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {setsInUse.map((set) => {
              const progress = progressBySet.get(set.id) ?? {
                obtained: 0,
                total: 0,
              };
              return (
                <span
                  key={set.id}
                  className="rounded-full border border-marca-noche/15 bg-white px-3 py-1 text-xs font-semibold text-marca-noche/80"
                >
                  {set.name}: {progress.obtained}/{progress.total}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={expansionFilter}
          onChange={(event) => setExpansionFilter(event.target.value)}
          className={selectClass}
        >
          <option value="">Todas las expansiones</option>
          {setsInUse.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
        </select>

        <select
          value={rarityFilter}
          onChange={(event) => setRarityFilter(event.target.value as Rarity | "")}
          className={selectClass}
        >
          <option value="">Todas las rarezas</option>
          {RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {RARITY_LABELS[rarity]}
            </option>
          ))}
        </select>

        <select
          value={genreFilter}
          onChange={(event) => setGenreFilter(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos los géneros</option>
          {genresInUse.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.name}
            </option>
          ))}
        </select>

        <select
          value={traitFilter}
          onChange={(event) => setTraitFilter(event.target.value)}
          className={selectClass}
        >
          <option value="">Todos los rasgos</option>
          {traitsInUse.map((trait) => (
            <option key={trait.id} value={trait.id}>
              {trait.name}
            </option>
          ))}
        </select>

        <select
          value={ownershipFilter}
          onChange={(event) =>
            setOwnershipFilter(event.target.value as OwnershipFilter)
          }
          className={selectClass}
        >
          <option value="todas">Todas</option>
          <option value="conseguidas">Conseguidas</option>
          <option value="faltantes">Faltantes</option>
        </select>

        <button
          type="button"
          onClick={() => setShowTradeSettings(true)}
          className="ml-auto touch-manipulation rounded border border-marca-noche/20 bg-white px-3 py-2 text-sm font-semibold text-marca-noche hover:border-marca-violeta hover:text-marca-violeta"
        >
          Preferencia de intercambio
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {filteredCards.map((card, index) => (
          <CollectionCardTile key={card.id} card={card} index={index} reducedMotion={reducedMotion} />
        ))}
      </div>

      {filteredCards.length === 0 && (
        <EmptyState icon="🔍" message="No hay cartas que coincidan con los filtros." />
      )}

      {showTradeSettings && (
        <TradeSettingsModal
          initialTradeDefault={initialTradeDefault}
          onClose={() => setShowTradeSettings(false)}
        />
      )}
    </div>
  );
}
