import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DeckBuilder } from "@/app/mazos/deck-builder";
import type { BuilderCard } from "@/app/mazos/deck-builder";

export default async function NuevoMazoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count } = await supabase
    .from("decks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id);

  if ((count ?? 0) >= 3) {
    redirect("/mazos");
  }

  const [{ data: userCards }, { data: cards }, { data: genres }, { data: traits }] =
    await Promise.all([
      supabase.from("user_cards").select("card_id, quantity").eq("user_id", user!.id).gt("quantity", 0),
      supabase
        .from("cards")
        .select("id, slug, name, rarity, image_front_url, genre_id, trait_id, power")
        .eq("is_active", true),
      supabase.from("genres").select("id, name, sort_order").order("sort_order"),
      supabase.from("traits").select("id, name, sort_order").order("sort_order"),
    ]);

  const ownedMap = new Map(
    ((userCards as { card_id: string; quantity: number }[] | null) ?? []).map((r) => [
      r.card_id,
      r.quantity,
    ]),
  );

  const myCards: BuilderCard[] = ((cards as Omit<BuilderCard, "owned">[] | null) ?? [])
    .filter((c) => ownedMap.has(c.id))
    .map((c) => ({ ...c, owned: ownedMap.get(c.id)! }));

  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <DeckBuilder
        deckId={null}
        initialName=""
        initialSelection={{}}
        myCards={myCards}
        genres={(genres as { id: string; name: string }[] | null) ?? []}
        traits={(traits as { id: string; name: string }[] | null) ?? []}
      />
    </main>
  );
}
