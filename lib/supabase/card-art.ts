import type { createClient } from "./server";
import type { CardTemplate, Genre, Trait } from "./types";

const GENRE_COLUMNS =
  "id, slug, name, sort_order, base_ability_name, base_ability_text, fandom_ability_name, fandom_ability_text, color_hex, icon_url";
const TRAIT_COLUMNS = "id, slug, name, sort_order, ability_name, ability_text, color_hex, icon_url";

// El jugador siempre ve la carta completa (marco, íconos, Poder, Score) en
// cualquier lugar donde aparezca -- colección, sobre, intercambios, mazos.
// La única excepción es la vista de impresión tipo postal. Este helper
// centraliza el fetch de género/rasgo (con color_hex/icon_url) + la
// plantilla general que cada una de esas pantallas necesita para montar
// CardArtOverlay, en vez de repetir la misma consulta en cada page.tsx.
export async function getCardArtContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: genres }, { data: traits }, { data: settings }] = await Promise.all([
    supabase.from("genres").select(GENRE_COLUMNS).order("sort_order"),
    supabase.from("traits").select(TRAIT_COLUMNS).order("sort_order"),
    supabase.from("game_settings").select("card_template").eq("id", true).single(),
  ]);

  const genresById = new Map(((genres ?? []) as Genre[]).map((g) => [g.id, g]));
  const traitsById = new Map(((traits ?? []) as Trait[]).map((t) => [t.id, t]));
  const cardTemplate = (settings?.card_template as CardTemplate | null) ?? null;

  return { genresById, traitsById, cardTemplate };
}
