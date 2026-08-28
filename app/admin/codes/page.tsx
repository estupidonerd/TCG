import { createClient } from "@/lib/supabase/server";
import { CodesForm } from "./codes-form";
import type { PackType } from "@/lib/supabase/types";

export default async function AdminCodesPage() {
  const supabase = await createClient();
  const { data: packTypes } = await supabase
    .from("pack_types")
    .select("id, name, cards_count, rarity_weights, allowed_set_ids, guaranteed_rarity")
    .order("name");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Generar códigos</h1>
      <CodesForm packTypes={(packTypes as PackType[] | null) ?? []} />
    </div>
  );
}
