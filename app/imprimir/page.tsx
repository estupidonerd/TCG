import { createClient } from "@/lib/supabase/server";
import { getCardArtContext } from "@/lib/supabase/card-art";
import { sortCardsBySet } from "@/lib/utils/sort-cards-by-set";
import { PrintStudio } from "./print-studio";
import type { Genre, Trait } from "@/lib/supabase/types";

export type OwnedPrintableCard = {
  id: string;
  slug: string;
  name: string;
  set_id: string;
  sort_order: number;
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

export default async function ImprimirPage({
  searchParams,
}: {
  searchParams: Promise<{ carta?: string }>;
}) {
  const { carta } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Solo se muestran para elegir las cartas que el usuario efectivamente
  // tiene (quantity > 0 por constraint, así que con que exista la fila en
  // user_cards alcanza). La verificación fuerte -- la que importa de
  // verdad -- se repite del lado del servidor en actions.ts justo antes de
  // generar las signed URLs de impresión.
  const { data: userCards } = await supabase
    .from("user_cards")
    .select("card_id")
    .eq("user_id", user!.id)
    .gt("quantity", 0);

  const ownedIds = (userCards ?? []).map((row) => row.card_id as string);

  let ownedCards: OwnedPrintableCard[] = [];
  let cardTemplate = null;
  if (ownedIds.length > 0) {
    const [{ data: cardsData }, { data: sets }, cardArt] = await Promise.all([
      supabase
        .from("cards")
        .select(
          "id, slug, name, set_id, sort_order, image_front_url, genre_id, trait_id, power, score, use_card_name_as_display, display_line_1, display_line_2, display_line_3, apply_art_template, name_shadow_intensity, name_font_size, name_line_height",
        )
        .in("id", ownedIds)
        .eq("is_active", true),
      supabase.from("card_sets").select("id, released_at").order("released_at"),
      getCardArtContext(supabase),
    ]);
    cardTemplate = cardArt.cardTemplate;
    const withArt = ((cardsData ?? []) as (OwnedPrintableCard & {
      genre_id: string | null;
      trait_id: string | null;
    })[]).map((c) => ({
      ...c,
      genre: c.genre_id ? (cardArt.genresById.get(c.genre_id) ?? null) : null,
      trait: c.trait_id ? (cardArt.traitsById.get(c.trait_id) ?? null) : null,
    }));
    ownedCards = sortCardsBySet(withArt, (sets ?? []) as { id: string }[]);
  }

  return (
    <main className="min-h-svh px-4 py-8 sm:px-6 print:p-0">
      <PrintStudio ownedCards={ownedCards} initialSelectedSlug={carta ?? null} cardTemplate={cardTemplate} />
    </main>
  );
}
