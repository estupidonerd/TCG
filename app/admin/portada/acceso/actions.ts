"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACCESS_MODES,
  ACCESS_STATE_TAG,
  HEX_COLOR_PATTERN,
  NOTICE_BODY_MAX,
  NOTICE_RETURN_MAX,
  NOTICE_TITLE_MAX,
  type AccessMode,
} from "@/lib/access/constants";

export type SaveAccessInput = {
  mode: AccessMode;
  title: string;
  body: string;
  returnText: string;
  textColor: string;
  // Solo cuenta si mode es "closed".
  disconnectAll: boolean;
};

function cleanText(value: unknown, max: number, label: string): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > max) {
    throw new Error(`${label}: máximo ${max} caracteres.`);
  }
  return text === "" ? null : text;
}

// Todo lo que cambia el estado de acceso invalida la caché de Next y vuelve a
// pintar el panel (el banner rojo vive en el layout de /admin).
function refreshAccess() {
  revalidateTag(ACCESS_STATE_TAG);
  revalidatePath("/admin", "layout");
  revalidatePath("/login");
}

// Sube session_epoch en 1. Lectura + escritura (no hay un "incrementar" en la
// API); si dos admins lo hicieran a la vez ambos escriben N+1, que desconecta
// igual. Devuelve el valor nuevo.
async function bumpSessionEpoch(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data, error } = await admin
    .from("game_settings")
    .select("session_epoch")
    .eq("id", true)
    .single();
  if (error) throw new Error(error.message);

  const next = (data.session_epoch as number) + 1;
  const { error: updateError } = await admin
    .from("game_settings")
    .update({ session_epoch: next })
    .eq("id", true);
  if (updateError) throw new Error(updateError.message);
  return next;
}

export async function saveAccessSettings(input: SaveAccessInput): Promise<{ epoch: number | null }> {
  await requireAdmin();

  if (!ACCESS_MODES.includes(input.mode)) {
    throw new Error("El modo elegido no es válido.");
  }
  if (!HEX_COLOR_PATTERN.test(input.textColor)) {
    throw new Error("El color tiene que tener el formato #rrggbb.");
  }

  const update: Record<string, unknown> = {
    access_mode: input.mode,
    notice_title: cleanText(input.title, NOTICE_TITLE_MAX, "Título"),
    notice_body: cleanText(input.body, NOTICE_BODY_MAX, "Texto"),
    notice_return_text: cleanText(input.returnText, NOTICE_RETURN_MAX, "Volvemos aproximadamente"),
    notice_text_color: input.textColor,
  };

  const admin = createAdminClient();
  const { error } = await admin.from("game_settings").update(update).eq("id", true);
  if (error) throw new Error(error.message);

  // Casilla opcional al cerrar: desconectar también a todos los jugadores.
  let epoch: number | null = null;
  if (input.mode === "closed" && input.disconnectAll) {
    epoch = await bumpSessionEpoch(admin);
  }

  refreshAccess();
  return { epoch };
}

// Botón "Desconectar a todos los jugadores". Los admins quedan exentos (lo
// decide el middleware, no esta acción).
export async function disconnectAllPlayers(): Promise<{ epoch: number }> {
  await requireAdmin();
  const epoch = await bumpSessionEpoch(createAdminClient());
  refreshAccess();
  return { epoch };
}
