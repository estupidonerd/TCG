import { createClient } from "@/lib/supabase/server";
import { CardForm } from "../card-form";
import type {
  BaseCardOption,
  CardSet,
  CardTemplate,
  GameSettings,
  Genre,
  Trait,
} from "@/lib/supabase/types";

export default async function NewCardPage() {
  const supabase = await createClient();
  const [{ data: sets }, { data: genres }, { data: traits }, { data: settings }, { data: baseCards }] =
    await Promise.all([
      supabase
        .from("card_sets")
        .select("id, name, slug, description, released_at, is_active")
        .order("name"),
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
      supabase
        .from("cards")
        .select(
          "id, name, description, chapter_info, genre_id, trait_id, power, score, set_id, sort_order, released_at",
        )
        .order("name"),
    ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Nueva carta</h1>
      <CardForm
        sets={(sets as CardSet[] | null) ?? []}
        genres={(genres as Genre[] | null) ?? []}
        traits={(traits as Trait[] | null) ?? []}
        baseCardOptions={(baseCards as BaseCardOption[] | null) ?? []}
        cardTemplate={(settings as GameSettings | null)?.card_template as CardTemplate | null}
      />
    </div>
  );
}
