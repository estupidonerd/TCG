"use server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

// current_date + N días, calculado en UTC (mismo criterio que usa Postgres
// por defecto para current_date) para que coincida exactamente con
// is_banned() del lado de la base: banear hoy por 1 día deja banned_until
// en mañana, y la persona puede volver a entrar apenas empiece ese día.
function bannedUntilInDays(days: number): string {
  const today = new Date();
  const target = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days),
  );
  return target.toISOString().slice(0, 10);
}

export async function banPlayer(userId: string, days: number): Promise<string> {
  const { user } = await requireAdmin();

  if (userId === user.id) {
    throw new Error("No puedes banearte a ti mismo.");
  }

  if (!Number.isInteger(days) || days < 1) {
    throw new Error("La cantidad de días tiene que ser un entero mayor o igual a 1.");
  }

  const bannedUntil = bannedUntilInDays(days);
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ banned_until: bannedUntil })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  return bannedUntil;
}

export async function unbanPlayer(userId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ banned_until: null }).eq("id", userId);
  if (error) throw new Error(error.message);
}
