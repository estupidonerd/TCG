import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCardArtContext } from "@/lib/supabase/card-art";
import { DeckBuilder } from "@/app/mazos/deck-builder";
import type { BuilderCard } from "@/app/mazos/deck-builder";
import type { Deck, DeckCard } from "@/lib/supabase/types";

export default async function EditarMazoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: deck },
    { data: deckCards },
    { data: userCards },
    { data: cards },
    { data: genres },
    { data: traits },
    cardArt,
  ] = await Promise.all([
    supabase
      .from("decks")
      .select("id, user_id, name, is_complete, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase.from("deck_cards").select("deck_id, card_id, quantity").eq("deck_id", id),
    supabase.from("user_cards").select("card_id, quantity").eq("user_id", user!.id).gt("quantity", 0),
    supabase
      .from("cards")
      .select(
        "id, slug, name, rarity, image_front_url, genre_id, trait_id, power, score, use_card_name_as_display, display_line_1, display_line_2, display_line_3, apply_art_template, name_shadow_intensity, name_font_size, name_line_height",
      )
      .eq("is_active", true),
    supabase.from("genres").select("id, name, sort_order").order("sort_order"),
    supabase.from("traits").select("id, name, sort_order").order("sort_order"),
    getCardArtContext(supabase),
  ]);

  if (!deck) notFound();

  const ownedMap = new Map(
    ((userCards as { card_id: string; quantity: number }[] | null) ?? []).map((r) => [
      r.card_id,
      r.quantity,
    ]),
  );

  const myCards: BuilderCard[] = (
    (cards as Omit<BuilderCard, "owned" | "genre" | "trait">[] | null) ?? []
  )
    .filter((c) => ownedMap.has(c.id))
    .map((c) => ({
      ...c,
      owned: ownedMap.get(c.id)!,
      genre: c.genre_id ? (cardArt.genresById.get(c.genre_id) ?? null) : null,
      trait: c.trait_id ? (cardArt.traitsById.get(c.trait_id) ?? null) : null,
    }));

  const initialSelection = Object.fromEntries(
    ((deckCards as DeckCard[] | null) ?? []).map((dc) => [dc.card_id, dc.quantity]),
  );

  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <DeckBuilder
        deckId={(deck as Deck).id}
        initialName={(deck as Deck).name}
        initialSelection={initialSelection}
        myCards={myCards}
        genres={(genres as { id: string; name: string }[] | null) ?? []}
        traits={(traits as { id: string; name: string }[] | null) ?? []}
        cardTemplate={cardArt.cardTemplate}
      />
    </main>
  );
}
