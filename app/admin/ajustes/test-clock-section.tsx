import { createAdminClient } from "@/lib/supabase/admin";
import { TestClockPanel } from "./test-clock-panel";

// Server Component: solo se renderiza (desde page.tsx) cuando
// NEXT_PUBLIC_APP_ENV vale "test". Lee con service_role, la página ya pasó
// por requireAdminOrRedirect(). Se consulta aparte, no dentro del select
// principal de ajustes: así /admin/ajustes sigue funcionando en un proyecto
// donde la migración del reloj todavía no se haya corrido.
export async function TestClockSection() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("game_settings")
    .select("allow_test_clock, test_clock_offset_minutes")
    .eq("id", true)
    .single();

  if (error || !data) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Reloj de pruebas</h2>
        <p className="rounded border border-marca-rojo/40 bg-marca-rojo/10 px-3 py-2 text-sm text-marca-rojo">
          No se pudo leer el reloj ({error?.message ?? "sin datos"}). ¿Ya corriste la migración
          20260920000000_test_clock.sql en este proyecto?
        </p>
      </section>
    );
  }

  const offsetMinutes = data.test_clock_offset_minutes as number;
  const allowed = data.allow_test_clock as boolean;
  const realNow = new Date();
  const simulatedNow = allowed ? new Date(realNow.getTime() + offsetMinutes * 60_000) : realNow;

  return (
    <TestClockPanel
      allowed={allowed}
      offsetMinutes={allowed ? offsetMinutes : 0}
      realNowIso={realNow.toISOString()}
      simulatedNowIso={simulatedNow.toISOString()}
    />
  );
}
