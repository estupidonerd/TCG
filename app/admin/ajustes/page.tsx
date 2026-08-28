import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "./settings-form";
import type { GameSettings } from "@/lib/supabase/types";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

export default async function AdminAjustesPage() {
  // Esta página usa el cliente service_role para generar la signed URL del
  // dorso de impresión (bucket privado). Se repite el guard acá -no solo
  // confiar en el layout- por la misma razón que en /admin/codes/stats:
  // Next puede renderizar esta página en paralelo con el layout.
  await requireAdminOrRedirect();

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("game_settings")
    .select("id, card_back_screen_url, card_back_print_url, pack_image_url")
    .eq("id", true)
    .single();

  const typedSettings = settings as GameSettings | null;

  const admin = createAdminClient();
  const printSigned = typedSettings?.card_back_print_url
    ? await admin.storage
        .from("card-print")
        .createSignedUrl(typedSettings.card_back_print_url, SIGNED_URL_TTL_SECONDS)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Ajustes del juego</h1>
      <SettingsForm
        initialScreenUrl={typedSettings?.card_back_screen_url ?? null}
        initialPrintPreviewUrl={printSigned?.data?.signedUrl ?? null}
        initialPackImageUrl={typedSettings?.pack_image_url ?? null}
      />
    </div>
  );
}
