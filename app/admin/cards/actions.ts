"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";
import { CHAPTER_INFO_MAX_LENGTH, RARITIES, type Rarity } from "@/lib/supabase/types";

const SCREEN_MAX_BYTES = 8 * 1024 * 1024;
const PRINT_MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function parseCardFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const setId = String(formData.get("set_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rarity = String(formData.get("rarity") ?? "") as Rarity;
  const artist = String(formData.get("artist") ?? "").trim();
  const isActive = formData.get("is_active") === "on";
  const isFandom = formData.get("is_fandom") === "on";
  const releasedAt = String(formData.get("released_at") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  const genreId = String(formData.get("genre_id") ?? "").trim();
  const traitId = String(formData.get("trait_id") ?? "").trim();
  const power = Number(formData.get("power") ?? NaN);
  const scoreRaw = String(formData.get("score") ?? "").trim();
  const useCardNameAsDisplay = formData.get("use_card_name_as_display") === "on";
  const displayLine1 = String(formData.get("display_line_1") ?? "").trim();
  const displayLine2 = String(formData.get("display_line_2") ?? "").trim();
  const displayLine3 = String(formData.get("display_line_3") ?? "").trim();
  const chapterInfo = String(formData.get("chapter_info") ?? "").trim();
  const applyArtTemplate = formData.get("apply_art_template") === "on";
  const nameShadowIntensity = Number(formData.get("name_shadow_intensity") ?? 50);
  const nameFontSize = Number(formData.get("name_font_size") ?? 10);
  const nameLineHeight = Number(formData.get("name_line_height") ?? 110);

  if (!name) throw new Error("El nombre es obligatorio.");
  if (!setId) throw new Error("Elige una expansión.");
  if (!RARITIES.includes(rarity)) throw new Error("Rareza inválida.");
  if (!Number.isFinite(sortOrder)) throw new Error("El orden tiene que ser un número.");
  if (!genreId) throw new Error("Elige un Género.");
  if (!traitId) throw new Error("Elige un Rasgo.");
  if (!Number.isInteger(power) || power < 0 || power > 10) {
    throw new Error("Poder tiene que ser un entero entre 0 y 10.");
  }

  // Puntaje es opcional -- a diferencia de Poder, no se exige. Si viene
  // vacío queda null y el jugador ve "X".
  let score: number | null = null;
  if (scoreRaw !== "") {
    const parsedScore = Number(scoreRaw);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 10) {
      throw new Error("Puntaje tiene que ser un número entre 0 y 10, o quedar vacío.");
    }
    score = parsedScore;
  }

  if (chapterInfo.length > CHAPTER_INFO_MAX_LENGTH) {
    throw new Error(
      `El texto de capítulo no puede superar los ${CHAPTER_INFO_MAX_LENGTH} caracteres.`,
    );
  }
  if (!Number.isFinite(nameShadowIntensity) || nameShadowIntensity < 0 || nameShadowIntensity > 100) {
    throw new Error("La sombra del texto tiene que ser un número entre 0 y 100.");
  }
  if (!Number.isFinite(nameFontSize) || nameFontSize <= 0) {
    throw new Error("El tamaño del nombre tiene que ser un número mayor que 0.");
  }
  if (!Number.isFinite(nameLineHeight) || nameLineHeight <= 0) {
    throw new Error("El interlineado del nombre tiene que ser un número mayor que 0.");
  }

  return {
    name,
    slug: slugify(slugInput || name),
    set_id: setId,
    description: description || null,
    rarity,
    artist: artist || null,
    is_active: isActive,
    is_fandom: isFandom,
    released_at: releasedAt || null,
    sort_order: sortOrder,
    genre_id: genreId,
    trait_id: traitId,
    power,
    score,
    use_card_name_as_display: useCardNameAsDisplay,
    display_line_1: displayLine1 || null,
    display_line_2: displayLine2 || null,
    display_line_3: displayLine3 || null,
    chapter_info: chapterInfo || null,
    apply_art_template: applyArtTemplate,
    name_shadow_intensity: nameShadowIntensity,
    name_font_size: nameFontSize,
    name_line_height: nameLineHeight,
  };
}

// Sube el archivo si vino uno nuevo en el form. Devuelve undefined cuando no
// hay archivo nuevo (el caller no tiene que tocar esa columna), o el valor a
// guardar cuando sí subió algo: una URL pública para card-images, o el path
// dentro del bucket para card-print (privado, sin URL pública estable).
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
    // El path es siempre el mismo (upsert a propósito, para no acumular
    // archivos huérfanos) -- sin esto, el navegador (o un CDN de por medio)
    // sigue sirviendo la imagen vieja desde caché porque la URL no cambió,
    // aunque el archivo en Storage ya se haya reemplazado.
    const publicUrl = admin.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;
    return `${publicUrl}?v=${Date.now()}`;
  }
  return fullPath;
}

export async function createCard(formData: FormData) {
  await requireAdmin();
  const fields = parseCardFields(formData);
  const admin = createAdminClient();
  const cardId = randomUUID();

  const [imageFront, printFront] = await Promise.all([
    uploadIfPresent(admin, "card-images", `${cardId}/image-front`, formData.get("image_front"), SCREEN_MAX_BYTES),
    uploadIfPresent(admin, "card-print", `${cardId}/print-front`, formData.get("print_front"), PRINT_MAX_BYTES),
  ]);

  const { error } = await admin.from("cards").insert({
    id: cardId,
    ...fields,
    image_front_url: imageFront ?? null,
    print_front_url: printFront ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/cards");
  redirect("/admin/cards");
}

export async function updateCard(id: string, formData: FormData) {
  await requireAdmin();
  const fields = parseCardFields(formData);
  const admin = createAdminClient();

  const [imageFront, printFront] = await Promise.all([
    uploadIfPresent(admin, "card-images", `${id}/image-front`, formData.get("image_front"), SCREEN_MAX_BYTES),
    uploadIfPresent(admin, "card-print", `${id}/print-front`, formData.get("print_front"), PRINT_MAX_BYTES),
  ]);

  const update: Record<string, unknown> = { ...fields };
  if (imageFront !== undefined) update.image_front_url = imageFront;
  if (printFront !== undefined) update.print_front_url = printFront;

  const { error } = await admin.from("cards").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/cards");
  redirect("/admin/cards");
}
