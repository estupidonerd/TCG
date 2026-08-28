"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { RARITIES, type Rarity } from "@/lib/supabase/types";

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

// Devuelve undefined si no vino archivo nuevo (no tocar la columna), o la
// URL pública si se subió uno.
async function uploadPackImageIfPresent(
  admin: ReturnType<typeof createAdminClient>,
  packId: string,
  file: FormDataEntryValue | null,
): Promise<string | null | undefined> {
  if (!(file instanceof File) || file.size === 0) return undefined;

  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Formato de imagen no soportado: ${file.type || "desconocido"}.`);
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(
      `La imagen supera el tamaño máximo permitido (${Math.round(IMAGE_MAX_BYTES / 1024 / 1024)}MB).`,
    );
  }

  const fullPath = `pack-types/${packId}/image.${extFromMime(file.type)}`;
  const { error } = await admin.storage.from("card-images").upload(fullPath, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new Error(`Error subiendo imagen: ${error.message}`);

  return admin.storage.from("card-images").getPublicUrl(fullPath).data.publicUrl;
}

function parsePackInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const cardsCount = Number(formData.get("cards_count") ?? 0);
  const guaranteedRarity = String(formData.get("guaranteed_rarity") ?? "");
  const allowedSetIds = formData.getAll("allowed_set_ids").map(String);

  if (!name) throw new Error("El nombre es obligatorio.");
  if (!Number.isInteger(cardsCount) || cardsCount <= 0) {
    throw new Error("La cantidad de cartas tiene que ser un entero positivo.");
  }
  if (allowedSetIds.length === 0) {
    throw new Error("Elegí al menos una expansión permitida.");
  }

  const rarityWeights: Record<string, number> = {};
  for (const rarity of RARITIES) {
    const weight = Number(formData.get(`weight_${rarity}`) ?? 0);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(`El peso de "${rarity}" tiene que ser un número mayor o igual a 0.`);
    }
    rarityWeights[rarity] = weight;
  }
  if (Object.values(rarityWeights).every((weight) => weight === 0)) {
    throw new Error("Al menos una rareza tiene que tener peso mayor a 0.");
  }

  return {
    name,
    cards_count: cardsCount,
    rarity_weights: rarityWeights,
    allowed_set_ids: allowedSetIds,
    guaranteed_rarity: (RARITIES as string[]).includes(guaranteedRarity)
      ? (guaranteedRarity as Rarity)
      : null,
  };
}

export async function createPackType(formData: FormData) {
  await requireAdmin();
  const input = parsePackInput(formData);
  const admin = createAdminClient();
  const packId = randomUUID();

  const imageUrl = await uploadPackImageIfPresent(admin, packId, formData.get("image"));

  const { error } = await admin.from("pack_types").insert({
    id: packId,
    ...input,
    image_url: imageUrl ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/packs");
  redirect("/admin/packs");
}

export async function updatePackType(id: string, formData: FormData) {
  await requireAdmin();
  const input = parsePackInput(formData);
  const admin = createAdminClient();

  const imageUrl = await uploadPackImageIfPresent(admin, id, formData.get("image"));

  const update: Record<string, unknown> = { ...input };
  if (imageUrl !== undefined) update.image_url = imageUrl;

  const { error } = await admin.from("pack_types").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/packs");
  redirect("/admin/packs");
}
