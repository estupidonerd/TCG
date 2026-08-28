import { createClient } from "@/lib/supabase/server";
import { PackForm } from "../pack-form";
import type { CardSet } from "@/lib/supabase/types";

export default async function NewPackPage() {
  const supabase = await createClient();
  const { data: sets } = await supabase
    .from("card_sets")
    .select("id, name, slug, description, released_at, is_active")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Nuevo tipo de sobre</h1>
      <PackForm sets={(sets as CardSet[] | null) ?? []} />
    </div>
  );
}
