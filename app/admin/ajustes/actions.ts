"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const SCREEN_MAX_BYTES = 8 * 1024 * 1024;
const PRINT_MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function uploadIfPresent(
  admin: ReturnType<typeof createAdminClient>,
  bucket: "card-images" | "card-print",
  path: string,
  file: FormDataEntryValue | null,
  maxBytes: number,
): Promise<string | null | undefined> {
  if (!(file instanceof File) || file.size === 0) return undefined;

  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Formato de imagen no soportado: ${file.type || "desconocido"}.`);
  }
  if (file.size > maxBytes) {
    throw new Error(
      `La imagen supera el tamaño máximo permitido (${Math.round(maxBytes / 1024 / 1024)}MB).`,
    );
  }

  const fullPath = `${path}.${extFromMime(file.type)}`;
  const { error } = await admin.storage.from(bucket).upload(fullPath, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(`Error subiendo imagen: ${error.message}`);

  if (bucket === "card-images") {
    return admin.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;
  }
  return fullPath;
}

// Dorso único para todo el juego: siempre pisa el mismo path (upsert),
// nunca se crea un archivo nuevo por carta.
export async function updateGameSettings(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const [screenUrl, printPath, packImageUrl] = await Promise.all([
    uploadIfPresent(
      admin,
      "card-images",
      "game-settings/card-back-screen",
      formData.get("card_back_screen"),
      SCREEN_MAX_BYTES,
    ),
    uploadIfPresent(
      admin,
      "card-print",
      "game-settings/card-back-print",
      formData.get("card_back_print"),
      PRINT_MAX_BYTES,
    ),
    uploadIfPresent(
      admin,
      "card-images",
      "game-settings/pack-image",
      formData.get("pack_image"),
      SCREEN_MAX_BYTES,
    ),
  ]);

  const update: Record<string, unknown> = {};
  if (screenUrl !== undefined) update.card_back_screen_url = screenUrl;
  if (printPath !== undefined) update.card_back_print_url = printPath;
  if (packImageUrl !== undefined) update.pack_image_url = packImageUrl;

  if (Object.keys(update).length === 0) {
    throw new Error("Elegí al menos una imagen para actualizar.");
  }

  const { error } = await admin.from("game_settings").update(update).eq("id", true);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/ajustes");
}
