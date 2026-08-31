import { createClient } from "@/lib/supabase/server";
import { DecksList } from "./decks-list";
import type { Deck, DeckCard } from "@/lib/supabase/types";

export default async function MazosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: decks }, { data: deckCards }] = await Promise.all([
    supabase
      .from("decks")
      .select("id, user_id, name, is_complete, created_at, updated_at")
      .eq("user_id", user!.id)
      .order("created_at"),
    // RLS ya limita esto a deck_cards de mazos propios (la policy hace el
    // join contra decks.user_id), así que no hace falta filtrar por
    // deck_id acá.
    supabase.from("deck_cards").select("deck_id, card_id, quantity"),
  ]);

  const typedDecks = (decks as Deck[] | null) ?? [];
  const typedDeckCards = (deckCards as DeckCard[] | null) ?? [];

  const cardsByDeck = new Map<string, DeckCard[]>();
  for (const row of typedDeckCards) {
    const list = cardsByDeck.get(row.deck_id) ?? [];
    list.push(row);
    cardsByDeck.set(row.deck_id, list);
  }

  const countByDeck = new Map<string, number>();
  for (const row of typedDeckCards) {
    countByDeck.set(row.deck_id, (countByDeck.get(row.deck_id) ?? 0) + row.quantity);
  }

  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <DecksList
        decks={typedDecks}
        countByDeck={Object.fromEntries(countByDeck)}
        cardsByDeck={Object.fromEntries(cardsByDeck)}
      />
    </main>
  );
}
