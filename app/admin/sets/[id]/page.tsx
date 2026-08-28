import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetForm } from "../set-form";
import type { CardSet } from "@/lib/supabase/types";

export default async function EditSetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: set } = await supabase
    .from("card_sets")
    .select("id, name, slug, description, released_at, is_active")
    .eq("id", id)
    .single();

  if (!set) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Editar expansión</h1>
      <SetForm initialSet={set as CardSet} />
    </div>
  );
}
