"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";

function parseSetInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const releasedAt = String(formData.get("released_at") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (!name) throw new Error("El nombre es obligatorio.");

  return {
    name,
    slug: slugify(slugInput || name),
    description: description || null,
    released_at: releasedAt || null,
    is_active: isActive,
  };
}

export async function createSet(formData: FormData) {
  await requireAdmin();
  const input = parseSetInput(formData);

  const admin = createAdminClient();
  const { error } = await admin.from("card_sets").insert(input);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/sets");
  redirect("/admin/sets");
}

export async function updateSet(id: string, formData: FormData) {
  await requireAdmin();
  const input = parseSetInput(formData);

  const admin = createAdminClient();
  const { error } = await admin.from("card_sets").update(input).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/sets");
  redirect("/admin/sets");
}
