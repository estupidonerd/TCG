"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DeckRow, copyLimit } from "@/components/mazos/deck-row";
import type { Rarity } from "@/lib/supabase/types";

const DECK_SIZE = 40;

export type BuilderCard = {
  id: string;
  slug: string;
  name: string;
  rarity: Rarity;
  image_front_url: string | null;
  genre_id: string | null;
  trait_id: string | null;
  power: number | null;
  owned: number;
};

type LimitFilter = "" | "unlimited" | "3" | "1";
type SortBy = "name" | "genre" | "limit";

export function DeckBuilder({
  deckId,
  initialName,
  initialSelection,
  myCards,
  genres,
  traits,
}: {
  deckId: string | null;
  initialName: string;
  initialSelection: Record<string, number>;
  myCards: BuilderCard[];
  genres: { id: string; name: string }[];
  traits: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [currentDeckId, setCurrentDeckId] = useState(deckId);
  const [name, setName] = useState(initialName);
  const [selection, setSelection] = useState<Map<string, number>>(
    () => new Map(Object.entries(initialSelection)),
  );
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [traitFilter, setTraitFilter] = useState("");
  const [limitFilter, setLimitFilter] = useState<LimitFilter>("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [autoRelease, setAutoRelease] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const genresById = useMemo(() => new Map(genres.map((g) => [g.id, g.name])), [genres]);
  const traitsById = useMemo(() => new Map(traits.map((t) => [t.id, t.name])), [traits]);
  const cardsById = useMemo(() => new Map(myCards.map((c) => [c.id, c])), [myCards]);

  const total = useMemo(
    () => Array.from(selection.values()).reduce((sum, qty) => sum + qty, 0),
    [selection],
  );

  const maxByCard = useMemo(() => {
    const map: Record<string, number> = {};
    for (const card of myCards) {
      map[card.id] = Math.min(card.owned, copyLimit(card.power));
    }
    return map;
  }, [myCards]);

  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = myCards.filter((card) => {
      if (q && !card.name.toLowerCase().includes(q)) return false;
      if (genreFilter && card.genre_id !== genreFilter) return false;
      if (traitFilter && card.trait_id !== traitFilter) return false;
      if (limitFilter) {
        const limit = copyLimit(card.power);
        if (limitFilter === "unlimited" && limit !== Infinity) return false;
        if (limitFilter === "3" && limit !== 3) return false;
        if (limitFilter === "1" && limit !== 1) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "genre") {
        const ga = a.genre_id ? (genresById.get(a.genre_id) ?? "") : "";
        const gb = b.genre_id ? (genresById.get(b.genre_id) ?? "") : "";
        return ga.localeCompare(gb) || a.name.localeCompare(b.name);
      }
      if (sortBy === "limit") {
        const la = copyLimit(a.power);
        const lb = copyLimit(b.power);
        const na = la === Infinity ? -1 : la; // ilimitado primero
        const nb = lb === Infinity ? -1 : lb;
        return na - nb || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [myCards, query, genreFilter, traitFilter, limitFilter, sortBy, genresById]);

  const changeQty = (cardId: string, next: number) => {
    const max = maxByCard[cardId] ?? 0;
    const clamped = Math.max(0, Math.min(max, next));
    const prevQty = selection.get(cardId) ?? 0;
    if (clamped === prevQty) return;

    setSelection((prev) => {
      const nextMap = new Map(prev);
      if (clamped === 0) nextMap.delete(cardId);
      else nextMap.set(cardId, clamped);
      return nextMap;
    });

    // Solo cuando la carta se saca del todo (a 0) y el interruptor está
    // prendido: liberar esa carta si ningún otro mazo la sigue usando.
    if (autoRelease && prevQty > 0 && clamped === 0) {
      const supabase = createClient();
      supabase.rpc("release_unused_reservation", { p_card_id: cardId });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const cards = Array.from(selection.entries()).map(([card_id, quantity]) => ({
      card_id,
      quantity,
    }));
    const { data, error } = await supabase.rpc("save_deck", {
      p_deck_id: currentDeckId,
      p_name: name,
      p_cards: cards,
    });
    setSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    setSavedAt(Date.now());
    if (!currentDeckId && data) {
      setCurrentDeckId(data as string);
      router.replace(`/mazos/${data}`);
    }
  };

  const selectedEntries = Array.from(selection.entries());

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-48 lg:flex-row lg:items-start lg:gap-6 lg:pb-8">
      <div className="min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del mazo"
              className="min-w-0 flex-1 rounded-xl border border-marca-noche/20 bg-white px-4 py-2.5 text-lg font-semibold focus:border-marca-violeta focus:outline-none"
            />
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-marca-noche/70">
            <input
              type="checkbox"
              checked={autoRelease}
              onChange={(event) => setAutoRelease(event.target.checked)}
              className="h-4 w-4 accent-marca-violeta"
            />
            Liberar cartas automáticamente al quitarlas (si no las usa otro mazo)
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar carta por nombre…"
              className="min-w-0 flex-1 rounded-lg border border-marca-noche/20 px-3 py-2 text-sm focus:border-marca-violeta focus:outline-none sm:flex-none sm:w-56"
            />
            <select
              value={genreFilter}
              onChange={(event) => setGenreFilter(event.target.value)}
              className="rounded border border-marca-noche/20 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todos los géneros</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              value={traitFilter}
              onChange={(event) => setTraitFilter(event.target.value)}
              className="rounded border border-marca-noche/20 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todos los rasgos</option>
              {traits.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <select
                value={limitFilter}
                onChange={(event) => setLimitFilter(event.target.value as LimitFilter)}
                className="rounded border border-marca-noche/20 bg-white px-3 py-2 text-sm"
              >
                <option value="">Todos los límites</option>
                <option value="unlimited">Ilimitado</option>
                <option value="3">Máx. 3</option>
                <option value="1">Máx. 1</option>
              </select>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowInfo((v) => !v)}
                  aria-label="Qué significa el límite de copias"
                  className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-marca-noche/30 text-xs font-bold text-marca-noche/60"
                >
                  i
                </button>
                {showInfo && (
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-marca-noche/10 bg-white p-3 text-xs leading-relaxed text-marca-noche shadow-lg">
                    Cada carta tiene un límite de copias por mazo: algunas son ilimitadas, otras
                    admiten hasta 3 y unas pocas hasta 1 sola.
                    <button
                      type="button"
                      onClick={() => setShowInfo(false)}
                      className="mt-2 block font-semibold text-marca-violeta"
                    >
                      Entendido
                    </button>
                  </div>
                )}
              </div>
            </div>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortBy)}
              className="rounded border border-marca-noche/20 bg-white px-3 py-2 text-sm"
            >
              <option value="name">Ordenar por nombre</option>
              <option value="genre">Ordenar por género</option>
              <option value="limit">Ordenar por límite de copias</option>
            </select>
          </div>
        </div>

        {filteredCards.length === 0 ? (
          <p className="py-12 text-center text-sm text-marca-noche/50">
            Ninguna carta coincide con los filtros.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filteredCards.map((card) => (
              <li key={card.id}>
                <DeckRow
                  card={card}
                  genreName={card.genre_id ? (genresById.get(card.genre_id) ?? null) : null}
                  traitName={card.trait_id ? (traitsById.get(card.trait_id) ?? null) : null}
                  quantity={selection.get(card.id) ?? 0}
                  max={maxByCard[card.id] ?? 0}
                  onChange={(next) => changeQty(card.id, next)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Panel fijo: total + chips + guardar. Abajo en móvil, al costado
          (sticky) en escritorio. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-marca-noche/10 bg-marca-claro/95 backdrop-blur-sm lg:static lg:w-72 lg:shrink-0 lg:rounded-xl lg:border lg:bg-white lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 p-3 lg:sticky lg:top-20 lg:p-4">
          <div className="flex items-center justify-between">
            <p
              className={`text-sm font-bold ${total === DECK_SIZE ? "text-green-600" : "text-marca-noche"}`}
            >
              {total} / {DECK_SIZE} cartas
            </p>
            {savedAt && !saveError && (
              <span className="text-xs font-semibold text-green-600">Guardado ✓</span>
            )}
          </div>

          {selectedEntries.length > 0 && (
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto lg:max-h-56">
              {selectedEntries.map(([cardId, qty]) => {
                const card = cardsById.get(cardId);
                if (!card) return null;
                return (
                  <button
                    key={cardId}
                    type="button"
                    onClick={() => changeQty(cardId, 0)}
                    className="touch-manipulation rounded-full border border-marca-violeta bg-marca-violeta/10 px-2 py-1 text-[11px] font-semibold text-marca-violeta"
                    title={`Quitar ${card.name}`}
                  >
                    {card.name} ×{qty} ✕
                  </button>
                );
              })}
            </div>
          )}

          {saveError && <p className="text-xs font-semibold text-marca-rojo">{saveError}</p>}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || name.trim() === ""}
            className={`touch-manipulation rounded-xl px-4 py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
              total === DECK_SIZE
                ? "bg-marca-violeta text-white"
                : "bg-marca-amarillo text-marca-noche"
            }`}
          >
            {saving ? "Guardando…" : "Guardar mazo"}
          </button>

          <p className="text-[11px] leading-snug text-marca-noche/50">
            Al guardar, estas cartas quedan protegidas de intercambios automáticamente. Puedes
            liberarlas después desde tu colección.
          </p>
        </div>
      </div>
    </div>
  );
}
