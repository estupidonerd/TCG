import { createClient } from "@/lib/supabase/server";
import { sortCardsBySet } from "@/lib/utils/sort-cards-by-set";
import { TradeWizard } from "./trade-wizard";
import type { Card, PublicProfile } from "@/lib/supabase/types";
import type { ContactWithProfile } from "@/app/contactos/page";

export default async function NuevoIntercambioPage({
  searchParams,
}: {
  searchParams: Promise<{ con?: string }>;
}) {
  const { con } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: contacts },
    { data: myUserCards },
    { data: cards },
    { data: sets },
    { data: committedRows },
    preselected,
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, user_id, contact_user_id, nickname, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_cards")
      .select("card_id, quantity, public_quantity")
      .eq("user_id", user!.id),
    supabase
      .from("cards")
      .select("id, set_id, slug, name, description, rarity, image_front_url, artist, is_active, released_at, sort_order, genre_id, trait_id, power, score, is_fandom")
      .eq("is_active", true),
    supabase.from("card_sets").select("id, released_at").order("released_at"),
    // Cuánto de cada carta propia ya está comprometido en otras ofertas
    // pendientes (propias, como sender o receiver de esa otra oferta) --
    // acota el stepper de "ofrezco" para no chocar con la validación de
    // create_trade.
    supabase
      .from("trade_items")
      .select("card_id, quantity, trades!inner(status)")
      .eq("user_id", user!.id)
      .eq("trades.status", "pendiente"),
    con
      ? supabase.rpc("get_public_profiles", { p_user_ids: [con] }).then((r) => r.data?.[0] ?? null)
      : Promise.resolve(null),
  ]);

  const typedSets = (sets as { id: string; released_at: string | null }[] | null) ?? [];
  const orderedCards = sortCardsBySet((cards as Card[] | null) ?? [], typedSets);

  const ownedQuantityByCard = new Map(
    ((myUserCards as { card_id: string; quantity: number; public_quantity: number }[] | null) ?? []).map(
      (r) => [r.card_id, { quantity: r.quantity, public_quantity: r.public_quantity }],
    ),
  );

  const committedByCard = new Map<string, number>();
  for (const row of (committedRows as { card_id: string; quantity: number }[] | null) ?? []) {
    committedByCard.set(row.card_id, (committedByCard.get(row.card_id) ?? 0) + row.quantity);
  }

  const myCards = orderedCards
    .filter((c) => (ownedQuantityByCard.get(c.id)?.quantity ?? 0) > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      rarity: c.rarity,
      image_front_url: c.image_front_url,
      owned: ownedQuantityByCard.get(c.id)?.quantity ?? 0,
      committed: committedByCard.get(c.id) ?? 0,
      // Ya tiene descontada la reserva de mazo en origen (ver
      // set_card_public_quantity/set_all_cards_public): es el único límite
      // real que importa acá para ofrecer.
      publicQuantity: ownedQuantityByCard.get(c.id)?.public_quantity ?? 0,
    }));

  const catalogById = new Map(orderedCards.map((c) => [c.id, c]));

  const contactsWithProfile: ContactWithProfile[] = [];
  const contactIds = ((contacts as { contact_user_id: string }[] | null) ?? []).map(
    (c) => c.contact_user_id,
  );
  if (contactIds.length > 0) {
    const { data: profiles } = await supabase.rpc("get_public_profiles", {
      p_user_ids: contactIds,
    });
    const profilesById = new Map(((profiles as PublicProfile[] | null) ?? []).map((p) => [p.id, p]));
    for (const contact of (contacts as ContactWithProfile[] | null) ?? []) {
      contactsWithProfile.push({ ...contact, profile: profilesById.get(contact.contact_user_id) ?? null });
    }
  }

  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <TradeWizard
        contacts={contactsWithProfile}
        myCards={myCards}
        catalog={Array.from(catalogById.values()).map((c) => ({
          id: c.id,
          name: c.name,
          rarity: c.rarity,
          image_front_url: c.image_front_url,
        }))}
        preselectedProfile={preselected as PublicProfile | null}
      />
    </main>
  );
}
