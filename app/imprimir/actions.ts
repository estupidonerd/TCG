"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SIGNED_URL_TTL_SECONDS = 60 * 15;

export type PrintCardAsset = {
  id: string;
  name: string;
  frontUrl: string | null;
  isHighRes: boolean;
};

export type PrintAssets = {
  cards: PrintCardAsset[];
  backUrl: string | null;
};

// Único punto donde se resuelven las imágenes en resolución de impresión.
// Vuelve a verificar contra user_cards acá adentro (no confía en la
// selección que mandó el cliente): cualquier id pedido que el usuario no
// tenga realmente se descarta en silencio.
export async function getPrintAssets(cardIds: string[]): Promise<PrintAssets> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tienes que iniciar sesión.");

  if (cardIds.length === 0) return { cards: [], backUrl: null };

  const { data: ownedRows } = await supabase
    .from("user_cards")
    .select("card_id")
    .eq("user_id", user.id)
    .in("card_id", cardIds)
    .gt("quantity", 0);

  const ownedIds = (ownedRows ?? []).map((row) => row.card_id as string);
  if (ownedIds.length === 0) return { cards: [], backUrl: null };

  const [{ data: cardsData }, { data: settings }] = await Promise.all([
    supabase
      .from("cards")
      .select("id, name, print_front_url, image_front_url")
      .in("id", ownedIds),
    supabase.from("game_settings").select("card_back_print_url").eq("id", true).single(),
  ]);

  // card-print es un bucket privado sin policies: hace falta el cliente
  // service_role para generar signed URLs de sus archivos, aun cuando la
  // propiedad ya se verificó arriba con el cliente normal.
  const admin = createAdminClient();

  const backPath = (settings?.card_back_print_url as string | null) ?? null;
  const backSigned = backPath
    ? await admin.storage.from("card-print").createSignedUrl(backPath, SIGNED_URL_TTL_SECONDS)
    : null;

  const cards: PrintCardAsset[] = await Promise.all(
    (cardsData ?? []).map(async (card) => {
      const printPath = card.print_front_url as string | null;
      if (printPath) {
        const signed = await admin.storage
          .from("card-print")
          .createSignedUrl(printPath, SIGNED_URL_TTL_SECONDS);
        if (signed.data?.signedUrl) {
          return {
            id: card.id as string,
            name: card.name as string,
            frontUrl: signed.data.signedUrl,
            isHighRes: true,
          };
        }
      }
      return {
        id: card.id as string,
        name: card.name as string,
        frontUrl: (card.image_front_url as string | null) ?? null,
        isHighRes: false,
      };
    }),
  );

  return { cards, backUrl: backSigned?.data?.signedUrl ?? null };
}
