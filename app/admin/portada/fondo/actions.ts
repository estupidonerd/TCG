"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { HEX_COLOR_PATTERN } from "@/lib/access/constants";
import { colombiaDayEndIso, colombiaDayStartIso } from "@/lib/utils/colombia-time";
import {
  SPLASH_ALLOWED_MIME,
  SPLASH_BODY_MAX,
  SPLASH_BUCKET,
  SPLASH_CACHE_CONTROL,
  SPLASH_FOLDER,
  SPLASH_MAX_BYTES,
  SPLASH_NAME_MAX,
  SPLASH_OVERLAY_MAX,
  SPLASH_TAG,
  SPLASH_TITLE_MAX,
  splashPathFromUrl,
} from "@/lib/splash/types";

type AdminClient = ReturnType<typeof createAdminClient>;

type SplashFields = {
  name: string;
  title: string | null;
  body: string | null;
  text_color: string;
  overlay_opacity: number;
  focus_x: number;
  focus_y: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

// ---- validación -----------------------------------------------------------

function text(formData: FormData, key: string, max: number, label: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length > max) throw new Error(`${label}: máximo ${max} caracteres.`);
  return value === "" ? null : value;
}

function integer(formData: FormData, key: string, min: number, max: number, label: string): number {
  const value = Number(formData.get(key));
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}: tiene que ser un número entero entre ${min} y ${max}.`);
  }
  return value;
}

// Las fechas llegan como día ("2026-12-24") y se interpretan SIEMPRE en hora de
// Colombia: el inicio cuenta desde las 00:00 de ese día y el fin cuenta el día
// completo, hasta las 23:59.
function date(formData: FormData, key: string, label: string, edge: "start" | "end"): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const iso = edge === "start" ? colombiaDayStartIso(raw) : colombiaDayEndIso(raw);
  if (!iso) throw new Error(`${label}: la fecha no es válida.`);
  return iso;
}

function parseFields(formData: FormData): SplashFields {
  const name = text(formData, "name", SPLASH_NAME_MAX, "Nombre");
  if (!name) throw new Error("Escribe un nombre para la portada.");

  const textColor = String(formData.get("text_color") ?? "").trim();
  if (!HEX_COLOR_PATTERN.test(textColor)) {
    throw new Error("El color del texto tiene que tener el formato #rrggbb.");
  }

  const startsAt = date(formData, "starts_at", "Fecha de inicio", "start");
  const endsAt = date(formData, "ends_at", "Fecha de fin", "end");
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new Error("La fecha de fin tiene que ser posterior a la de inicio.");
  }

  return {
    name,
    title: text(formData, "title", SPLASH_TITLE_MAX, "Título"),
    body: text(formData, "body", SPLASH_BODY_MAX, "Texto"),
    text_color: textColor,
    overlay_opacity: integer(formData, "overlay_opacity", 0, SPLASH_OVERLAY_MAX, "Oscurecido"),
    focus_x: integer(formData, "focus_x", 0, 100, "Enfoque horizontal"),
    focus_y: integer(formData, "focus_y", 0, 100, "Enfoque vertical"),
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: formData.get("is_active") === "on" || formData.get("is_active") === "true",
  };
}

// ---- Storage --------------------------------------------------------------

// Devuelve el archivo elegido, o null si no se eligió ninguno.
function pickFile(formData: FormData): File | null {
  const file = formData.get("image");
  return file instanceof File && file.size > 0 ? file : null;
}

async function uploadImage(admin: AdminClient, file: File): Promise<{ url: string; bytes: number }> {
  if (!(SPLASH_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    throw new Error("La imagen tiene que ser WebP, JPG o PNG.");
  }
  if (file.size > SPLASH_MAX_BYTES) {
    throw new Error(
      `La imagen pesa ${Math.round(file.size / 1024)} KB y el máximo es 1 MB. Comprímela o conviértela a WebP.`,
    );
  }

  // Nombre único por archivo (nunca se pisa uno existente) + caché larga: el
  // navegador la guarda un año y no la vuelve a descargar en cada visita.
  const path = `${SPLASH_FOLDER}/${randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error } = await admin.storage.from(SPLASH_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: SPLASH_CACHE_CONTROL,
    upsert: false,
  });
  if (error) throw new Error(`Error subiendo la imagen: ${error.message}`);

  return { url: admin.storage.from(SPLASH_BUCKET).getPublicUrl(path).data.publicUrl, bytes: file.size };
}

// Borra una imagen de Storage por su URL. Solo toca archivos de splash/ y solo
// si ninguna otra portada la sigue usando. Un fallo al borrar no rompe la
// acción: lo peor que pasa es un archivo huérfano, nunca una portada rota.
async function removeImage(admin: AdminClient, url: string | null, exceptId?: string) {
  const path = splashPathFromUrl(url);
  if (!path || !url) return;

  let query = admin.from("splash_themes").select("id", { count: "exact", head: true }).eq("image_url", url);
  if (exceptId) query = query.neq("id", exceptId);
  const { count } = await query;
  if ((count ?? 0) > 0) return;

  const { error } = await admin.storage.from(SPLASH_BUCKET).remove([path]);
  if (error) console.error("[portadas] No se pudo borrar la imagen anterior:", error.message);
}

// ---- refresco -------------------------------------------------------------

function refreshSplash() {
  revalidateTag(SPLASH_TAG);
  revalidatePath("/admin/portada/fondo");
  revalidatePath("/login");
}

// ---- acciones -------------------------------------------------------------

export async function createSplash(formData: FormData) {
  await requireAdmin();
  const fields = parseFields(formData);
  const file = pickFile(formData);
  const admin = createAdminClient();

  const uploaded = file ? await uploadImage(admin, file) : null;

  const { data, error } = await admin
    .from("splash_themes")
    .insert({ ...fields, image_url: uploaded?.url ?? null })
    .select("id")
    .single();
  if (error || !data) {
    // Si la fila no se creó, no queda la imagen suelta en Storage.
    await removeImage(admin, uploaded?.url ?? null);
    throw new Error(error?.message ?? "No se pudo crear la portada.");
  }

  refreshSplash();
  const weight = uploaded ? `&peso=${uploaded.bytes}` : "";
  redirect(`/admin/portada/fondo/${data.id}?guardada=1${weight}`);
}

export async function updateSplash(id: string, formData: FormData) {
  await requireAdmin();
  const fields = parseFields(formData);
  const file = pickFile(formData);
  const removeCurrent = formData.get("remove_image") === "on";
  const admin = createAdminClient();

  const { data: current, error: readError } = await admin
    .from("splash_themes")
    .select("image_url")
    .eq("id", id)
    .single();
  if (readError || !current) throw new Error("No se encontró la portada.");
  const oldUrl = current.image_url as string | null;

  const uploaded = file ? await uploadImage(admin, file) : null;
  const imageUrl = uploaded ? uploaded.url : removeCurrent ? null : oldUrl;

  const { error } = await admin
    .from("splash_themes")
    .update({ ...fields, image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    await removeImage(admin, uploaded?.url ?? null);
    throw new Error(error.message);
  }

  // Ya guardado: se borra la imagen anterior si se reemplazó o se quitó.
  if (oldUrl && oldUrl !== imageUrl) await removeImage(admin, oldUrl, id);

  refreshSplash();
  const weight = uploaded ? `&peso=${uploaded.bytes}` : "";
  redirect(`/admin/portada/fondo/${id}?guardada=1${weight}`);
}

export async function setSplashActive(id: string, active: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("splash_themes")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refreshSplash();
}

// Copia la portada (inactiva) con su propia copia de la imagen: así borrar una
// nunca deja sin imagen a la otra.
export async function duplicateSplash(id: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: source, error: readError } = await admin
    .from("splash_themes")
    .select("name, image_url, focus_x, focus_y, overlay_opacity, title, body, text_color, starts_at, ends_at")
    .eq("id", id)
    .single();
  if (readError || !source) throw new Error("No se encontró la portada.");

  let newUrl: string | null = null;
  const sourcePath = splashPathFromUrl(source.image_url as string | null);
  if (sourcePath) {
    const extension = sourcePath.split(".").pop() ?? "webp";
    const newPath = `${SPLASH_FOLDER}/${randomUUID()}.${extension}`;
    const { error: copyError } = await admin.storage.from(SPLASH_BUCKET).copy(sourcePath, newPath);
    if (copyError) throw new Error(`No se pudo copiar la imagen: ${copyError.message}`);
    newUrl = admin.storage.from(SPLASH_BUCKET).getPublicUrl(newPath).data.publicUrl;
  }

  const copyName = `${source.name as string} (copia)`.slice(0, SPLASH_NAME_MAX);
  const { data, error } = await admin
    .from("splash_themes")
    .insert({ ...source, name: copyName, image_url: newUrl, is_active: false })
    .select("id")
    .single();
  if (error || !data) {
    await removeImage(admin, newUrl);
    throw new Error(error?.message ?? "No se pudo duplicar la portada.");
  }

  refreshSplash();
  redirect(`/admin/portada/fondo/${data.id}`);
}

export async function deleteSplash(id: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: current } = await admin.from("splash_themes").select("image_url").eq("id", id).single();

  const { error } = await admin.from("splash_themes").delete().eq("id", id);
  if (error) throw new Error(error.message);

  // La fila ya no existe: se borra su imagen.
  await removeImage(admin, (current?.image_url as string | null) ?? null);

  refreshSplash();
}
