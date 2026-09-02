import { createClient } from "@/lib/supabase/server";
import { RedeemForm } from "./redeem-form";
import type { GameSettings, Genre, Trait } from "@/lib/supabase/types";

export default async function CanjearPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: genres }, { data: traits }] = await Promise.all([
    supabase
      .from("game_settings")
      .select("id, card_back_screen_url, card_back_print_url, card_template")
      .eq("id", true)
      .single(),
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
  ]);

  const typedSettings = settings as GameSettings | null;

  // Sin padding/fondo propios a propósito: la apertura de sobre es un
  // momento inmersivo (fondo #000021 de marca) que necesita ocupar toda la
  // pantalla sin el padding/centrado que sí quiere el formulario de antes
  // -- cada uno de los dos estados de RedeemForm controla su propio fondo.
  return (
    <main className="min-h-svh">
      <RedeemForm
        cardBackUrl={typedSettings?.card_back_screen_url ?? null}
        cardTemplate={typedSettings?.card_template ?? null}
        genres={(genres as Genre[] | null) ?? []}
        traits={(traits as Trait[] | null) ?? []}
      />
    </main>
  );
}
