import { createClient } from "@/lib/supabase/server";
import { CardForm } from "../card-form";
import type { CardSet, Genre, Trait } from "@/lib/supabase/types";

export default async function NewCardPage() {
  const supabase = await createClient();
  const [{ data: sets }, { data: genres }, { data: traits }] = await Promise.all([
    supabase
      .from("card_sets")
      .select("id, name, slug, description, released_at, is_active")
      .order("name"),
    supabase
      .from("genres")
      .select("id, slug, name, sort_order, base_ability_name, base_ability_text, fandom_ability_name, fandom_ability_text")
      .order("sort_order"),
    supabase
      .from("traits")
      .select("id, slug, name, sort_order, ability_name, ability_text")
      .order("sort_order"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Nueva carta</h1>
      <CardForm
        sets={(sets as CardSet[] | null) ?? []}
        genres={(genres as Genre[] | null) ?? []}
        traits={(traits as Trait[] | null) ?? []}
      />
    </div>
  );
}
