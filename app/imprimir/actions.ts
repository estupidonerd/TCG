"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CardTemplate, Genre, Trait } from "@/lib/supabase/types";

const SIGNED_URL_TTL_SECONDS = 60 * 15;

export type PrintCardAsset = {
  id: string;
  name: string;
  frontUrl: string | null;
  isHighRes: boolean;
  power: number | null;
  score: number | null;
  useCardNameAsDisplay: boolean;
  displayLine1: string | null;
  displayLine2: string | null;
  displayLine3: string | null;
  chapterInfo: string | null;
  artist: string | null;
  genre: Pick<Genre, "color_hex" | "icon_url"> | null;
  trait: Pick<Trait, "color_hex" | "icon_url"> | null;
  applyArtTemplate: boolean;
  nameShadowIntensity: number;
  nameFontSize: number;
  nameLineHeight: number;
};

export type PrintAssets = {
  cards: PrintCardAsset[];
  backUrl: string | null;
  postalBackUrl: string | null;
  cardTemplate: CardTemplate | null;
};

// Único punto donde se resuelven las imágenes en resolución de impresión.
// Vuelve a verificar contra user_cards acá adentro (no confía en la
// selección que mandó el cliente): cualquier id pedido que el usuario no
// tenga realmente se descarta en silencio. Sirve tanto al modo "carta" como
// al modo "postal" -- ambos necesitan exactamente los mismos datos, la
// diferencia entre uno y otro es puramente de qué componente los dibuja.
export async function getPrintAssets(cardIds: string[]): Promise<PrintAssets> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tienes que iniciar sesión.");

  const empty: PrintAssets = { cards: [], backUrl: null, postalBackUrl: null, cardTemplate: null };
  if (cardIds.length === 0) return empty;

  const { data: ownedRows } = await supabase
    .from("user_cards")
    .select("card_id")
    .eq("user_id", user.id)
    .in("card_id", cardIds)
    .gt("quantity", 0);

  const ownedIds = (ownedRows ?? []).map((row) => row.card_id as string);
  if (ownedIds.length === 0) return empty;

  const [{ data: cardsData }, { data: settings }, { data: genresData }, { data: traitsData }] =
    await Promise.all([
      supabase
        .from("cards")
        .select(
          "id, name, print_front_url, image_front_url, power, score, artist, genre_id, trait_id, use_card_name_as_display, display_line_1, display_line_2, display_line_3, chapter_info, apply_art_template, name_shadow_intensity, name_font_size, name_line_height",
        )
        .in("id", ownedIds),
      supabase
        .from("game_settings")
        .select("card_back_print_url, postal_back_print_url, card_template")
        .eq("id", true)
        .single(),
      supabase.from("genres").select("id, color_hex, icon_url"),
      supabase.from("traits").select("id, color_hex, icon_url"),
    ]);

  const genresById = new Map((genresData ?? []).map((g) => [g.id as string, g]));
  const traitsById = new Map((traitsData ?? []).map((t) => [t.id as string, t]));

  // card-print es un bucket privado sin policies: hace falta el cliente
  // service_role para generar signed URLs de sus archivos, aun cuando la
  // propiedad ya se verificó arriba con el cliente normal.
  const admin = createAdminClient();

  const backPath = (settings?.card_back_print_url as string | null) ?? null;
  const postalBackPath = (settings?.postal_back_print_url as string | null) ?? null;
  const [backSigned, postalBackSigned] = await Promise.all([
    backPath
      ? admin.storage.from("card-print").createSignedUrl(backPath, SIGNED_URL_TTL_SECONDS)
      : Promise.resolve(null),
    postalBackPath
      ? admin.storage.from("card-print").createSignedUrl(postalBackPath, SIGNED_URL_TTL_SECONDS)
      : Promise.resolve(null),
  ]);

  const cards: PrintCardAsset[] = await Promise.all(
    (cardsData ?? []).map(async (card) => {
      const base = {
        id: card.id as string,
        name: card.name as string,
        power: card.power as number | null,
        score: card.score as number | null,
        useCardNameAsDisplay: card.use_card_name_as_display as boolean,
        displayLine1: card.display_line_1 as string | null,
        displayLine2: card.display_line_2 as string | null,
        displayLine3: card.display_line_3 as string | null,
        chapterInfo: card.chapter_info as string | null,
        artist: card.artist as string | null,
        genre: card.genre_id ? (genresById.get(card.genre_id as string) ?? null) : null,
        trait: card.trait_id ? (traitsById.get(card.trait_id as string) ?? null) : null,
        applyArtTemplate: card.apply_art_template as boolean,
        nameShadowIntensity: card.name_shadow_intensity as number,
        nameFontSize: card.name_font_size as number,
        nameLineHeight: card.name_line_height as number,
      };

      const printPath = card.print_front_url as string | null;
      if (printPath) {
        const signed = await admin.storage
          .from("card-print")
          .createSignedUrl(printPath, SIGNED_URL_TTL_SECONDS);
        if (signed.data?.signedUrl) {
          return { ...base, frontUrl: signed.data.signedUrl, isHighRes: true };
        }
      }
      return {
        ...base,
        frontUrl: (card.image_front_url as string | null) ?? null,
        isHighRes: false,
      };
    }),
  );

  return {
    cards,
    backUrl: backSigned?.data?.signedUrl ?? null,
    postalBackUrl: postalBackSigned?.data?.signedUrl ?? null,
    cardTemplate: (settings?.card_template as CardTemplate | null) ?? null,
  };
}
