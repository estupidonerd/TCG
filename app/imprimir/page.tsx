import { createClient } from "@/lib/supabase/server";
import { sortCardsBySet } from "@/lib/utils/sort-cards-by-set";
import { PrintStudio } from "./print-studio";

export type OwnedPrintableCard = {
  id: string;
  slug: string;
  name: string;
  set_id: string;
  sort_order: number;
  image_front_url: string | null;
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
  if (ownedIds.length > 0) {
    const [{ data: cardsData }, { data: sets }] = await Promise.all([
      supabase
        .from("cards")
        .select("id, slug, name, set_id, sort_order, image_front_url")
        .in("id", ownedIds)
        .eq("is_active", true),
      supabase.from("card_sets").select("id, released_at").order("released_at"),
    ]);
    ownedCards = sortCardsBySet(
      (cardsData ?? []) as OwnedPrintableCard[],
      (sets ?? []) as { id: string }[],
    );
  }

  return (
    <main className="min-h-svh px-4 py-8 sm:px-6 print:p-0">
      <PrintStudio ownedCards={ownedCards} initialSelectedSlug={carta ?? null} />
    </main>
  );
}
