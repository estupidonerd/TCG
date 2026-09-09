import { createClient } from "@/lib/supabase/server";
import { CollectionGrid } from "./collection-grid";
import { WelcomeModal } from "@/components/coleccion/welcome-modal";
import { sortCardsBySet } from "@/lib/utils/sort-cards-by-set";
import type {
  Card,
  CardSet,
  CardTemplate,
  CollectionCard,
  GameSettings,
  Genre,
  Trait,
  TradeDefault,
} from "@/lib/supabase/types";

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
    { data: settings },
    { data: userCards },
    { data: profile },
  ] = await Promise.all([
      supabase
        .from("cards")
        .select(
          "id, set_id, slug, name, description, rarity, image_front_url, print_front_url, artist, is_active, released_at, sort_order, genre_id, trait_id, power, score, is_fandom, use_card_name_as_display, display_line_1, display_line_2, display_line_3, chapter_info, apply_art_template, name_shadow_intensity, name_font_size, name_line_height, variant_of",
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
          "id, slug, name, sort_order, base_ability_name, base_ability_text, fandom_ability_name, fandom_ability_text, color_hex, icon_url",
        )
        .order("sort_order"),
      supabase
        .from("traits")
        .select("id, slug, name, sort_order, ability_name, ability_text, color_hex, icon_url")
        .order("sort_order"),
      supabase.from("game_settings").select("card_template").eq("id", true).single(),
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

  // Una variante (variant_of no nulo) que el jugador todavía no tiene no
  // aparece en absoluto -- ni como silueta -- y no cuenta en el total de
  // arriba. Filtrar acá (no solo en el cliente) alcanza para las dos cosas
  // a la vez: ni el array ni su .length incluyen esa carta hasta que se
  // consigue al menos 1 copia. Las cartas con variant_of null (el caso de
  // siempre) nunca se filtran, sin importar su rareza.
  const collectionCards: CollectionCard[] = orderedCards
    .map((card) => ({
      ...card,
      quantity: quantityByCard.get(card.id) ?? 0,
    }))
    .filter((card) => card.variant_of === null || card.quantity > 0);

  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <WelcomeModal show={!profile?.has_seen_welcome} />
      <CollectionGrid
        cards={collectionCards}
        sets={typedSets}
        genres={(genres as Genre[] | null) ?? []}
        traits={(traits as Trait[] | null) ?? []}
        cardTemplate={(settings as GameSettings | null)?.card_template as CardTemplate | null}
        initialTradeDefault={(profile?.trade_default as TradeDefault) ?? "publicas"}
      />
    </main>
  );
}
