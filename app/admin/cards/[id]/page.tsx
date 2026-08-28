import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CardForm } from "../card-form";
import type { Card, CardSet, Genre, Trait } from "@/lib/supabase/types";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: card }, { data: sets }, { data: genres }, { data: traits }] =
    await Promise.all([
      supabase
        .from("cards")
        .select(
          "id, set_id, slug, name, description, rarity, image_front_url, print_front_url, artist, is_active, released_at, sort_order, genre_id, trait_id, power, score, is_fandom",
        )
        .eq("id", id)
        .single(),
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

  if (!card) notFound();

  const typedCard = card as Card;

  // card-print es privado: print_front_url guarda el path dentro del
  // bucket, no una URL usable directamente. Para mostrar la previsualización
  // de lo ya guardado hace falta una signed URL, generada acá con el
  // cliente service_role (esta página ya está detrás del guard de is_admin
  // en app/admin/layout.tsx).
  const admin = createAdminClient();
  const printFrontSigned = typedCard.print_front_url
    ? await admin.storage
        .from("card-print")
        .createSignedUrl(typedCard.print_front_url, SIGNED_URL_TTL_SECONDS)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Editar carta</h1>
      <CardForm
        initialCard={typedCard}
        sets={(sets as CardSet[] | null) ?? []}
        genres={(genres as Genre[] | null) ?? []}
        traits={(traits as Trait[] | null) ?? []}
        initialPrintFrontPreviewUrl={printFrontSigned?.data?.signedUrl ?? null}
      />
    </div>
  );
}
