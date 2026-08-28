import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PackForm } from "../pack-form";
import type { CardSet, PackType } from "@/lib/supabase/types";

export default async function EditPackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: pack }, { data: sets }] = await Promise.all([
    supabase
      .from("pack_types")
      .select(
        "id, name, cards_count, rarity_weights, allowed_set_ids, guaranteed_rarity, image_url",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("card_sets")
      .select("id, name, slug, description, released_at, is_active")
      .order("name"),
  ]);

  if (!pack) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Editar tipo de sobre</h1>
      <PackForm initialPack={pack as PackType} sets={(sets as CardSet[] | null) ?? []} />
    </div>
  );
}
