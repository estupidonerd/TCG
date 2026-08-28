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

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 px-6 py-12">
      <h1 className="text-3xl sm:text-4xl">Canjear código</h1>
      <RedeemForm cardBackUrl={cardBackUrl} />
    </main>
  );
}
