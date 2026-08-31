"use server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminStats = {
  totalUsers: number;
  totalCodes: number;
  redeemedCodes: number;
  cardsInCirculation: number;
  savedDecks: number;
  completedTrades: number;
};

// Todas las consultas son de conteo (o una suma simple sobre lo que ya
// devuelve el conteo): ninguna tabla nueva, solo lectura agregada vía
// service_role para no depender de qué políticas de RLS ve cada admin.
export async function getAdminStats(): Promise<AdminStats> {
  await requireAdmin();
  const admin = createAdminClient();

  const [
    { count: totalUsers },
    { count: totalCodes },
    { count: redeemedCodes },
    { data: userCardRows },
    { count: savedDecks },
    { count: completedTrades },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("codes").select("*", { count: "exact", head: true }),
    admin.from("codes").select("*", { count: "exact", head: true }).gt("uses_count", 0),
    admin.from("user_cards").select("quantity"),
    admin.from("decks").select("*", { count: "exact", head: true }),
    admin
      .from("trades")
      .select("*", { count: "exact", head: true })
      .eq("status", "aceptado"),
  ]);

  const cardsInCirculation = ((userCardRows as { quantity: number }[] | null) ?? []).reduce(
    (sum, row) => sum + row.quantity,
    0,
  );

  return {
    totalUsers: totalUsers ?? 0,
    totalCodes: totalCodes ?? 0,
    redeemedCodes: redeemedCodes ?? 0,
    cardsInCirculation,
    savedDecks: savedDecks ?? 0,
    completedTrades: completedTrades ?? 0,
  };
}
