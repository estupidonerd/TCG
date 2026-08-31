import { createClient } from "@/lib/supabase/server";
import { CollectionGrid } from "./collection-grid";
import { WelcomeModal } from "@/components/coleccion/welcome-modal";
import { sortCardsBySet } from "@/lib/utils/sort-cards-by-set";
import type { Card, CardSet, CollectionCard, Genre, Trait, TradeDefault } from "@/lib/supabase/types";

export default async function ColeccionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: cards },
    { data: sets },
    { data: genres },
    { data: traits },
    { data: userCards },
    { data: profile },
  ] = await Promise.all([
      supabase
        .from("cards")
        .select(
          "id, set_id, slug, name, description, rarity, image_front_url, print_front_url, artist, is_active, released_at, sort_order, genre_id, trait_id, power, score, is_fandom",
        )
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("card_sets")
        .select("id, name, slug, description, released_at, is_active")
        .order("released_at"),
      supabase
        .from("genres")
        .select(
          "id, slug, name, sort_order, base_ability_name, base_ability_text, fandom_ability_name, fandom_ability_text",
        )
        .order("sort_order"),
      supabase
        .from("traits")
        .select("id, slug, name, sort_order, ability_name, ability_text")
        .order("sort_order"),
      // RLS ya limita esto a las propias filas, pero el filtro explícito deja
      // la intención clara en el código y evita depender solo de la policy.
      supabase.from("user_cards").select("card_id, quantity").eq("user_id", user!.id),
      supabase
        .from("profiles")
        .select("trade_default, has_seen_welcome")
        .eq("id", user!.id)
        .single(),
    ]);

  const quantityByCard = new Map(
    (userCards ?? []).map((row) => [row.card_id as string, row.quantity as number]),
  );

  const typedSets = (sets as CardSet[] | null) ?? [];
  // sort_order solo vale dentro de una expansión: se combina con el orden
  // de las expansiones (released_at) para que la grilla no mezcle cartas
  // de distintos sets de forma arbitraria.
  const orderedCards = sortCardsBySet((cards as Card[] | null) ?? [], typedSets);

  const collectionCards: CollectionCard[] = orderedCards.map((card) => ({
    ...card,
    quantity: quantityByCard.get(card.id) ?? 0,
  }));

  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <WelcomeModal show={!profile?.has_seen_welcome} />
      <CollectionGrid
        cards={collectionCards}
        sets={typedSets}
        genres={(genres as Genre[] | null) ?? []}
        traits={(traits as Trait[] | null) ?? []}
        initialTradeDefault={(profile?.trade_default as TradeDefault) ?? "publicas"}
      />
    </main>
  );
}
