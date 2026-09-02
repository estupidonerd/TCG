import { createClient } from "@/lib/supabase/server";
import { getCardArtContext } from "@/lib/supabase/card-art";
import { TradeInbox } from "./trade-inbox";
import type { Genre, Trade, TradeItem, PublicProfile, Rarity, Trait } from "@/lib/supabase/types";

export type TradeCardLite = {
  id: string;
  slug: string;
  name: string;
  rarity: Rarity;
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
};

export type TradeItemWithCard = TradeItem & { card: TradeCardLite | null };

export type TradeWithDetails = Trade & {
  myRole: "sender" | "receiver";
  otherParty: PublicProfile | null;
  otherPartyIsContact: boolean;
  senderItems: TradeItemWithCard[];
  receiverItems: TradeItemWithCard[];
};

export default async function IntercambiosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Barrido perezoso: si algún intercambio pendiente ya pasó los 7 días,
  // se marca como vencido acá antes de leer la lista. No hay pg_cron
  // configurado en este proyecto, así que esto (más la revalidación puntual
  // dentro de accept_trade/reject_trade) es lo que hace el vencimiento
  // "automático" sin depender de un job en background.
  await supabase.rpc("expire_old_trades");

  const { data: trades } = await supabase
    .from("trades")
    .select(
      "id, sender_id, receiver_id, status, message, created_at, resolved_at, expires_at, hidden_by_sender, hidden_by_receiver",
    )
    .or(`sender_id.eq.${user!.id},receiver_id.eq.${user!.id}`)
    .order("created_at", { ascending: false })
    .limit(100);

  // hidden_by_sender/hidden_by_receiver son por-lado: cada uno borra el
  // historial de SU vista sin afectar lo que ve el otro. Se filtran acá,
  // antes de armar TradeWithDetails, así el cliente ni se entera de que
  // existen esas columnas.
  const visibleTrades = (
    (trades as (Trade & { hidden_by_sender: boolean; hidden_by_receiver: boolean })[] | null) ?? []
  ).filter((t) => {
    if (t.sender_id === user!.id && t.hidden_by_sender) return false;
    if (t.receiver_id === user!.id && t.hidden_by_receiver) return false;
    return true;
  });

  const typedTrades = visibleTrades;
  const tradeIds = typedTrades.map((t) => t.id);

  const [{ data: items }, { data: contacts }] = await Promise.all([
    tradeIds.length > 0
      ? supabase
          .from("trade_items")
          .select("id, trade_id, user_id, card_id, quantity")
          .in("trade_id", tradeIds)
      : Promise.resolve({ data: [] as TradeItem[] }),
    supabase.from("contacts").select("contact_user_id").eq("user_id", user!.id),
  ]);

  const typedItems = (items as TradeItem[] | null) ?? [];
  const cardIds = Array.from(new Set(typedItems.map((i) => i.card_id)));

  const otherPartyIds = Array.from(
    new Set(
      typedTrades.map((t) => (t.sender_id === user!.id ? t.receiver_id : t.sender_id)),
    ),
  );

  const [{ data: cards }, { data: profiles }, cardArt] = await Promise.all([
    cardIds.length > 0
      ? supabase
          .from("cards")
          .select(
            "id, slug, name, rarity, image_front_url, power, score, use_card_name_as_display, display_line_1, display_line_2, display_line_3, apply_art_template, name_shadow_intensity, name_font_size, name_line_height, genre_id, trait_id",
          )
          .in("id", cardIds)
      : Promise.resolve({ data: [] as (TradeCardLite & { genre_id: string | null; trait_id: string | null })[] }),
    otherPartyIds.length > 0
      ? supabase.rpc("get_public_profiles", { p_user_ids: otherPartyIds })
      : Promise.resolve({ data: [] as PublicProfile[] }),
    getCardArtContext(supabase),
  ]);

  const cardsById = new Map(
    (
      (cards as (TradeCardLite & { genre_id: string | null; trait_id: string | null })[] | null) ?? []
    ).map((c) => [
      c.id,
      {
        ...c,
        genre: c.genre_id ? (cardArt.genresById.get(c.genre_id) ?? null) : null,
        trait: c.trait_id ? (cardArt.traitsById.get(c.trait_id) ?? null) : null,
      } as TradeCardLite,
    ]),
  );
  const profilesById = new Map(
    ((profiles as PublicProfile[] | null) ?? []).map((p) => [p.id, p]),
  );
  const contactIds = new Set(
    ((contacts as { contact_user_id: string }[] | null) ?? []).map((c) => c.contact_user_id),
  );

  const itemsByTrade = new Map<string, TradeItem[]>();
  for (const item of typedItems) {
    const list = itemsByTrade.get(item.trade_id) ?? [];
    list.push(item);
    itemsByTrade.set(item.trade_id, list);
  }

  const tradesWithDetails: TradeWithDetails[] = typedTrades.map((trade) => {
    const myRole = trade.sender_id === user!.id ? "sender" : "receiver";
    const otherId = myRole === "sender" ? trade.receiver_id : trade.sender_id;
    const tradeItems = itemsByTrade.get(trade.id) ?? [];

    const withCard = (item: TradeItem): TradeItemWithCard => ({
      ...item,
      card: cardsById.get(item.card_id) ?? null,
    });

    return {
      ...trade,
      myRole,
      otherParty: profilesById.get(otherId) ?? null,
      otherPartyIsContact: contactIds.has(otherId),
      senderItems: tradeItems.filter((i) => i.user_id === trade.sender_id).map(withCard),
      receiverItems: tradeItems.filter((i) => i.user_id === trade.receiver_id).map(withCard),
    };
  });

  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <TradeInbox trades={tradesWithDetails} cardTemplate={cardArt.cardTemplate} />
    </main>
  );
}
