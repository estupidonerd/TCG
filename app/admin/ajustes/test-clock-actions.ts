"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTestEnv } from "@/lib/config/app-env";

export type TestClockStep = "day" | "week" | "month" | "reset";

type ClockRow = { allow_test_clock: boolean; test_clock_offset_minutes: number };

// Minutos que hay que sumar a la hora simulada actual para avanzar
// "un mes" de calendario (no 30 días fijos): se calcula sobre la fecha
// simulada, igual que lo vería un jugador.
function minutesToAdd(step: Exclude<TestClockStep, "reset">, simulatedNow: Date): number {
  if (step === "day") return 24 * 60;
  if (step === "week") return 7 * 24 * 60;
  const target = new Date(simulatedNow);
  target.setUTCMonth(target.getUTCMonth() + 1);
  return Math.round((target.getTime() - simulatedNow.getTime()) / 60_000);
}

export async function moveTestClock(step: TestClockStep) {
  // Segundo seguro: aunque alguien invoque la acción directo, fuera del
  // entorno de pruebas no hace nada.
  if (!isTestEnv) {
    throw new Error("El reloj de pruebas solo está disponible en el entorno de pruebas.");
  }
  await requireAdmin();

  const admin = createAdminClient();
  const { data, error: readError } = await admin
    .from("game_settings")
    .select("allow_test_clock, test_clock_offset_minutes")
    .eq("id", true)
    .single();
  if (readError) throw new Error(readError.message);

  const row = data as ClockRow;
  if (!row.allow_test_clock) {
    throw new Error(
      "El reloj de pruebas está desactivado: allow_test_clock es false en este proyecto.",
    );
  }

  let offset = 0;
  if (step !== "reset") {
    const simulatedNow = new Date(Date.now() + row.test_clock_offset_minutes * 60_000);
    offset = row.test_clock_offset_minutes + minutesToAdd(step, simulatedNow);
  }

  // La función valida allow_test_clock otra vez y es el único camino de
  // escritura del desplazamiento.
  const { error } = await admin.rpc("admin_set_test_clock", { p_offset_minutes: offset });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/ajustes");
}
