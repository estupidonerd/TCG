import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CardDetail } from "@/components/coleccion/card-detail";
import { sortCardsBySet } from "@/lib/utils/sort-cards-by-set";
import type { Card, Genre, Trait, GameSettings } from "@/lib/supabase/types";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: card } = await supabase
    .from("cards")
    .select(
      "id, set_id, slug, name, description, rarity, image_front_url, print_front_url, artist, is_active, released_at, sort_order, genre_id, trait_id, power, score, is_fandom",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!card) notFound();

  const typedCard = card as Card;

  const [
    { data: genre },
    { data: trait },
    { data: settings },
    { data: userCard },
    { data: allCards },
    { data: sets },
    { data: ownedRows },
  ] = await Promise.all([
    typedCard.genre_id
      ? supabase
          .from("genres")
          .select(
            "id, slug, name, sort_order, base_ability_name, base_ability_text, fandom_ability_name, fandom_ability_text",
          )
          .eq("id", typedCard.genre_id)
          .single()
      : Promise.resolve({ data: null }),
    typedCard.trait_id
      ? supabase
          .from("traits")
          .select("id, slug, name, sort_order, ability_name, ability_text")
          .eq("id", typedCard.trait_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("game_settings")
      .select("id, card_back_screen_url, card_back_print_url, pack_image_url")
      .eq("id", true)
      .single(),
    supabase
      .from("user_cards")
      .select("quantity, public_quantity")
      .eq("user_id", user!.id)
      .eq("card_id", typedCard.id)
      .maybeSingle(),
    // Liviano a propósito (solo lo necesario para ordenar y armar
    // anterior/siguiente), para no traer todos los datos de todas las
    // cartas activas en cada visita al detalle.
    supabase
      .from("cards")
      .select("id, slug, set_id, sort_order")
      .eq("is_active", true),
    supabase.from("card_sets").select("id, released_at").order("released_at"),
    // user_cards solo tiene filas para cartas que el usuario tiene (quantity
    // siempre > 0 por constraint), así que con que exista la fila alcanza.
    supabase.from("user_cards").select("card_id").eq("user_id", user!.id),
  ]);

  // Anterior/siguiente navegan solo entre las conseguidas, en el mismo
  // orden que la grilla (expansión por released_at, adentro por
  // sort_order) -- si la carta actual no está entre las conseguidas
  // (se llegó acá con el filtro "Faltantes" o "Todas"), igual busca la
  // conseguida más cercana antes/después en ese orden.
  const orderedCards = sortCardsBySet(
    (allCards ?? []) as { id: string; slug: string; set_id: string; sort_order: number }[],
    (sets ?? []) as { id: string }[],
  );
  const ownedIds = new Set((ownedRows ?? []).map((row) => row.card_id as string));
  const currentIndex = orderedCards.findIndex((c) => c.slug === slug);

  let prevSlug: string | null = null;
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (ownedIds.has(orderedCards[i].id)) {
      prevSlug = orderedCards[i].slug;
      break;
    }
  }

  let nextSlug: string | null = null;
  for (let i = currentIndex + 1; i < orderedCards.length; i++) {
    if (ownedIds.has(orderedCards[i].id)) {
      nextSlug = orderedCards[i].slug;
      break;
    }
  }

  return (
    <CardDetail
      card={typedCard}
      genre={genre as Genre | null}
      trait={trait as Trait | null}
      cardBackUrl={(settings as GameSettings | null)?.card_back_screen_url ?? null}
      quantity={userCard?.quantity ?? 0}
      publicQuantity={userCard?.public_quantity ?? 0}
      prevSlug={prevSlug}
      nextSlug={nextSlug}
    />
  );
}
