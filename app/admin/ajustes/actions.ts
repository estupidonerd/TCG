"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const SCREEN_MAX_BYTES = 8 * 1024 * 1024;
const PRINT_MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

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
    // El path es siempre el mismo (upsert a propósito, para no acumular
    // archivos huérfanos) -- sin esto, el navegador (o un CDN de por medio)
    // sigue sirviendo la imagen vieja desde caché porque la URL no cambió,
    // aunque el archivo en Storage ya se haya reemplazado.
    const publicUrl = admin.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;
    return `${publicUrl}?v=${Date.now()}`;
  }
  return fullPath;
}

// Dorso único para todo el juego: siempre pisa el mismo path (upsert),
// nunca se crea un archivo nuevo por carta.
export async function updateGameSettings(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const [screenUrl, printPath, postalBackPath, packImageUrl] = await Promise.all([
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
      "card-print",
      "game-settings/postal-back-print",
      formData.get("postal_back_print"),
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
  if (postalBackPath !== undefined) update.postal_back_print_url = postalBackPath;
  if (packImageUrl !== undefined) update.pack_image_url = packImageUrl;

  if (Object.keys(update).length === 0) {
    throw new Error("Elige al menos una imagen para actualizar.");
  }

  const { error } = await admin.from("game_settings").update(update).eq("id", true);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/ajustes");
}

function parseHex(raw: FormDataEntryValue | null, label: string): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (!HEX_PATTERN.test(value)) {
    throw new Error(`${label}: el color tiene que tener el formato #rrggbb.`);
  }
  return value;
}

// Catálogo cerrado (10 filas): se editan todas juntas en un solo submit,
// cada una con su propio ícono (opcional, sube solo si vino un archivo
// nuevo) y su color_hex.
export async function updateGenres(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: genres, error: fetchError } = await admin
    .from("genres")
    .select("id, name");
  if (fetchError) throw new Error(fetchError.message);

  await Promise.all(
    (genres ?? []).map(async (genre) => {
      const id = genre.id as string;
      const color_hex = parseHex(formData.get(`color_${id}`), genre.name as string);
      const iconUrl = await uploadIfPresent(
        admin,
        "card-images",
        `game-settings/genre-icons/${id}`,
        formData.get(`icon_${id}`),
        SCREEN_MAX_BYTES,
      );

      const update: Record<string, unknown> = { color_hex };
      if (iconUrl !== undefined) update.icon_url = iconUrl;

      const { error } = await admin.from("genres").update(update).eq("id", id);
      if (error) throw new Error(error.message);
    }),
  );

  revalidatePath("/admin/ajustes");
  revalidatePath("/admin/cards");
  revalidatePath("/coleccion");
}

// Catálogo cerrado (5 filas): mismo patrón que updateGenres.
export async function updateTraits(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: traits, error: fetchError } = await admin
    .from("traits")
    .select("id, name");
  if (fetchError) throw new Error(fetchError.message);

  await Promise.all(
    (traits ?? []).map(async (trait) => {
      const id = trait.id as string;
      const iconUrl = await uploadIfPresent(
        admin,
        "card-images",
        `game-settings/trait-icons/${id}`,
        formData.get(`icon_${id}`),
        SCREEN_MAX_BYTES,
      );

      // Los Rasgos ya no tienen color propio -- sus íconos se recolorean
      // con el color del Género de cada carta, así que acá solo se
      // actualiza el ícono.
      if (iconUrl === undefined) return;

      const { error } = await admin.from("traits").update({ icon_url: iconUrl }).eq("id", id);
      if (error) throw new Error(error.message);
    }),
  );

  revalidatePath("/admin/ajustes");
  revalidatePath("/admin/cards");
  revalidatePath("/coleccion");
}

function parsePercent(formData: FormData, name: string): number {
  const value = Number(formData.get(name));
  if (!Number.isFinite(value)) throw new Error(`${name}: tiene que ser un número.`);
  return value;
}

const FONT_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_FONT_EXT = new Set(["woff2", "woff", "ttf", "otf"]);

// La fuente del nombre la sube el admin (no un asset estático del
// proyecto): así un cambio de fuente se aplica a todo el juego sin tocar
// código. Se valida por extensión, no por MIME -- los navegadores/SO
// reportan tipos MIME de fuentes de forma inconsistente (muchos mandan
// application/octet-stream).
async function uploadFontIfPresent(
  admin: ReturnType<typeof createAdminClient>,
  path: string,
  file: FormDataEntryValue | null,
): Promise<string | null | undefined> {
  if (!(file instanceof File) || file.size === 0) return undefined;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_FONT_EXT.has(ext)) {
    throw new Error(
      `Formato de fuente no soportado: .${ext || "desconocido"}. Usa woff2, woff, ttf u otf.`,
    );
  }
  if (file.size > FONT_MAX_BYTES) {
    throw new Error(
      `La fuente supera el tamaño máximo permitido (${Math.round(FONT_MAX_BYTES / 1024 / 1024)}MB).`,
    );
  }

  const fullPath = `${path}.${ext}`;
  const { error } = await admin.storage.from("card-images").upload(fullPath, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw new Error(`Error subiendo fuente: ${error.message}`);

  const publicUrl = admin.storage.from("card-images").getPublicUrl(fullPath).data.publicUrl;
  return `${publicUrl}?v=${Date.now()}`;
}

// Plantilla general de composición del arte de carta -- todo en porcentaje
// relativo al tamaño de la carta, nunca píxeles fijos. El marco y la fuente
// son opcionales (suben solo si vino un archivo nuevo, upsert sobre el
// mismo path).
export async function updateCardTemplate(formData: FormData) {
  await requireAdmin();
  const admin = createAdminClient();

  const [marcoUrl, fontUrl] = await Promise.all([
    uploadIfPresent(
      admin,
      "card-images",
      "game-settings/card-template-marco",
      formData.get("marco"),
      SCREEN_MAX_BYTES,
    ),
    uploadFontIfPresent(admin, "game-settings/card-name-font", formData.get("card_name_font")),
  ]);

  const { data: current, error: fetchError } = await admin
    .from("game_settings")
    .select("card_template")
    .eq("id", true)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const cardTemplate = {
    marco_url: marcoUrl !== undefined ? marcoUrl : ((current?.card_template as { marco_url: string | null } | null)?.marco_url ?? null),
    zona_nombre: {
      x: parsePercent(formData, "zona_nombre_x"),
      y: parsePercent(formData, "zona_nombre_y"),
      ancho: parsePercent(formData, "zona_nombre_ancho"),
      alto: parsePercent(formData, "zona_nombre_alto"),
      angulo: parsePercent(formData, "zona_nombre_angulo"),
    },
    "tamaño_iconos": parsePercent(formData, "tamano_iconos"),
    "tamaño_poder": parsePercent(formData, "tamano_poder"),
    "tamaño_score": parsePercent(formData, "tamano_score"),
    "altura_poder_score": parsePercent(formData, "altura_poder_score"),
    icono_genero: {
      offset_x: parsePercent(formData, "icono_genero_offset_x"),
      offset_y: parsePercent(formData, "icono_genero_offset_y"),
    },
    icono_rasgo: {
      offset_x: parsePercent(formData, "icono_rasgo_offset_x"),
      offset_y: parsePercent(formData, "icono_rasgo_offset_y"),
    },
    poder: {
      offset_x: parsePercent(formData, "poder_offset_x"),
      offset_y: parsePercent(formData, "poder_offset_y"),
    },
    score: {
      offset_x: parsePercent(formData, "score_offset_x"),
      offset_y: parsePercent(formData, "score_offset_y"),
    },
    credito: {
      offset_y: parsePercent(formData, "credito_offset_y"),
      "tamaño": parsePercent(formData, "credito_tamano"),
    },
  };

  const update: Record<string, unknown> = { card_template: cardTemplate };
  if (fontUrl !== undefined) update.card_name_font_url = fontUrl;

  const { error } = await admin.from("game_settings").update(update).eq("id", true);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/ajustes");
  revalidatePath("/admin/cards");
  revalidatePath("/coleccion");
  revalidatePath("/imprimir");
  revalidatePath("/", "layout");
}
