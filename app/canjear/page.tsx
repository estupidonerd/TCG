import { createClient } from "@/lib/supabase/server";
import { RedeemForm } from "./redeem-form";
import type { GameSettings } from "@/lib/supabase/types";

export default async function CanjearPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("game_settings")
    .select("id, card_back_screen_url, card_back_print_url")
    .eq("id", true)
    .single();

  const cardBackUrl = (settings as GameSettings | null)?.card_back_screen_url ?? null;

  // Sin padding/fondo propios a propósito: la apertura de sobre es un
  // momento inmersivo (fondo #000021 de marca) que necesita ocupar toda la
  // pantalla sin el padding/centrado que sí quiere el formulario de antes
  // -- cada uno de los dos estados de RedeemForm controla su propio fondo.
  return (
    <main className="min-h-svh">
      <RedeemForm cardBackUrl={cardBackUrl} />
    </main>
  );
}
