"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DeleteDeckDialog } from "@/components/mazos/delete-deck-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import type { Deck, DeckCard } from "@/lib/supabase/types";

const MAX_DECKS = 3;
const DECK_SIZE = 40;

export function DecksList({
  decks,
  countByDeck,
  cardsByDeck,
}: {
  decks: Deck[];
  countByDeck: Record<string, number>;
  cardsByDeck: Record<string, DeckCard[]>;
}) {
  const router = useRouter();
  const [localDecks, setLocalDecks] = useState(decks);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingDeck, setDeletingDeck] = useState<Deck | null>(null);
  const [error, setError] = useState<string | null>(null);

  const atLimit = localDecks.length >= MAX_DECKS;

  const handleDuplicate = async (deck: Deck) => {
    setDuplicatingId(deck.id);
    setError(null);
    const supabase = createClient();
    const cards = (cardsByDeck[deck.id] ?? []).map((c) => ({
      card_id: c.card_id,
      quantity: c.quantity,
    }));
    const { error: rpcError } = await supabase.rpc("save_deck", {
      p_deck_id: null,
      p_name: `${deck.name} (copia)`,
      p_cards: cards,
    });
    setDuplicatingId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  };

  const handleDelete = async (releaseUnused: boolean) => {
    if (!deletingDeck) return;
    const deck = deletingDeck;
    setDeletingDeck(null);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("delete_deck", {
      p_deck_id: deck.id,
      p_release_unused: releaseUnused,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setLocalDecks((prev) => prev.filter((d) => d.id !== deck.id));
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl">Mazos</h1>
        {atLimit ? (
          <span
            className="cursor-not-allowed rounded-xl border border-marca-noche/15 px-4 py-2.5 text-sm font-semibold text-marca-noche/40"
            title="Ya tienes 3 mazos. Borra alguno para crear uno nuevo."
          >
            Crear mazo (máximo 3)
          </span>
        ) : (
          <Link
            href="/mazos/nuevo"
            className="touch-manipulation rounded-xl bg-marca-rojo px-4 py-2.5 text-sm font-bold text-marca-claro transition-opacity hover:opacity-90"
          >
            Crear mazo
          </Link>
        )}
      </div>

      {error && (
        <p className="rounded border border-marca-rojo/40 bg-marca-rojo/10 px-3 py-2 text-sm text-marca-rojo">
          {error}
        </p>
      )}

      {localDecks.length === 0 ? (
        <EmptyState
          icon="🗂️"
          message="Todavía no tienes ningún mazo. Crea el primero para empezar a armarlo."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {localDecks.map((deck) => {
            const count = countByDeck[deck.id] ?? 0;
            return (
              <li
                key={deck.id}
                className="flex flex-col gap-3 rounded-xl border border-marca-noche/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-marca-noche">{deck.name}</p>
                    {deck.is_complete ? (
                      <span className="shrink-0 rounded-full border border-green-400 bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                        Completo
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-marca-amarillo bg-marca-amarillo/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-marca-noche">
                        Borrador
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-marca-noche/60">
                    {count}/{DECK_SIZE} cartas
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/mazos/${deck.id}`}
                    className="touch-manipulation rounded-full bg-marca-rojo px-3 py-2 text-xs font-bold text-marca-claro transition-opacity hover:opacity-90"
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(deck)}
                    disabled={duplicatingId === deck.id || atLimit}
                    title={atLimit ? "Ya tienes 3 mazos. Borra alguno para duplicar." : undefined}
                    className="touch-manipulation rounded-full border border-marca-noche/20 px-3 py-2 text-xs font-semibold text-marca-noche disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {duplicatingId === deck.id ? "Duplicando…" : "Duplicar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingDeck(deck)}
                    className="touch-manipulation rounded-full border border-marca-noche/20 px-3 py-2 text-xs font-semibold text-marca-noche/60 hover:border-marca-rojo hover:text-marca-rojo"
                  >
                    Borrar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {deletingDeck && (
        <DeleteDeckDialog
          deckName={deletingDeck.name}
          onConfirm={handleDelete}
          onCancel={() => setDeletingDeck(null)}
        />
      )}
    </div>
  );
}
