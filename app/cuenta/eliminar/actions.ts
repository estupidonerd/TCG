"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Server Action: la única forma de borrar un auth.users es con el cliente
// service_role (admin.auth.admin.deleteUser), así que esto NUNCA puede
// correr en el cliente. El texto de confirmación se revalida acá también
// -- el frontend ya lo exige para habilitar el botón, pero esta es la
// verificación que realmente cuenta.
export async function deleteAccount(confirmText: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (confirmText.trim().toLowerCase() !== "borrar") {
    throw new Error('Escribe "Borrar" para confirmar.');
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    throw new Error("No se pudo eliminar la cuenta. Intenta de nuevo.");
  }

  // El auth.users ya no existe -- el resto de las tablas (user_cards,
  // decks, deck_cards, trades, trade_items, redemptions, contacts,
  // feedback, blocked_users) se limpian solas vía ON DELETE CASCADE.
  try {
    await supabase.auth.signOut();
  } catch {
    // La cuenta ya no existe: el request de logout al servidor puede
    // fallar, pero para entonces las cookies locales ya se limpiaron. No
    // es crítico si esto falla.
  }

  redirect("/?cuenta_eliminada=1");
}
