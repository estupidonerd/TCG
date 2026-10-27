"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";

const LABEL_MAX = 80;
const DESCRIPTION_MAX = 200;

// vote_options solo la escribe el admin con service_role (los jugadores
// solo tienen SELECT), así que cada acción repite requireAdmin().

function cleanLabel(raw: string) {
  const label = raw.replace(/\s+/g, " ").trim();
  if (!label) throw new Error("El nombre es obligatorio.");
  if (label.length > LABEL_MAX) throw new Error(`El nombre no puede pasar de ${LABEL_MAX} caracteres.`);
  return label;
}

// Una línea: sin saltos de línea.
function cleanDescription(raw: string) {
  const description = raw.replace(/\s+/g, " ").trim();
  if (description.length > DESCRIPTION_MAX) {
    throw new Error(`La descripción no puede pasar de ${DESCRIPTION_MAX} caracteres.`);
  }
  return description;
}

export async function createVoteOption(formData: FormData) {
  await requireAdmin();
  const label = cleanLabel(String(formData.get("label") ?? ""));
  const description = cleanDescription(String(formData.get("description") ?? ""));

  const baseSlug = slugify(label);
  if (!baseSlug) throw new Error("El nombre necesita al menos una letra o un número.");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("vote_options")
    .select("slug, sort_order")
    .order("sort_order", { ascending: false });

  const rows = (existing as { slug: string; sort_order: number }[] | null) ?? [];
  const taken = new Set(rows.map((row) => row.slug));
  let slug = baseSlug;
  for (let suffix = 2; taken.has(slug); suffix++) slug = `${baseSlug}-${suffix}`;

  const nextOrder = (rows[0]?.sort_order ?? 0) + 1;
  const { error } = await admin
    .from("vote_options")
    .insert({ slug, label, description, sort_order: nextOrder, is_active: true });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/votos");
}

export async function updateVoteOption(
  id: string,
  input: { label: string; description: string; is_active: boolean },
) {
  await requireAdmin();
  const label = cleanLabel(input.label);
  const description = cleanDescription(input.description);

  const admin = createAdminClient();
  const { error } = await admin
    .from("vote_options")
    .update({ label, description, is_active: input.is_active })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/votos");
}

export async function moveVoteOption(id: string, direction: "up" | "down") {
  await requireAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("vote_options")
    .select("id")
    .order("sort_order")
    .order("label");
  const ids = ((data as { id: string }[] | null) ?? []).map((row) => row.id);

  const index = ids.indexOf(id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= ids.length) return;

  [ids[index], ids[target]] = [ids[target], ids[index]];

  // Se renumera todo 1..n (son pocas filas) en vez de intercambiar solo
  // dos valores: así nunca quedan dos opciones con el mismo sort_order.
  for (let i = 0; i < ids.length; i++) {
    const { error } = await admin
      .from("vote_options")
      .update({ sort_order: i + 1 })
      .eq("id", ids[i]);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/votos");
}
