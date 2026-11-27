import Link from "next/link";
import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickActiveSplash, splashStatus } from "@/lib/splash/pick";
import type { SplashTheme } from "@/lib/splash/types";
import { SplashList, type SplashListItem } from "./splash-list";

export const metadata = { title: "Fondo y textos" };

export default async function FondoPage() {
  // Se repite el guard acá (no solo en el layout): esta página lee con
  // service_role.
  await requireAdminOrRedirect();

  const admin = createAdminClient();
  const [{ data, error }, clock] = await Promise.all([
    admin.from("splash_themes").select("*").order("created_at", { ascending: false }),
    admin.rpc("game_now"),
  ]);

  if (error) {
    return (
      <p className="rounded border border-marca-rojo/40 bg-marca-rojo/10 px-3 py-2 text-sm text-marca-rojo">
        No se pudieron leer las portadas ({error.message}). ¿Ya corriste la migración
        20260922000000_splash_themes.sql en este proyecto?
      </p>
    );
  }

  // Las etiquetas usan la hora del juego (en Pruebas, la del reloj de pruebas);
  // si no se puede leer, la hora real.
  const now = typeof clock.data === "string" ? new Date(clock.data) : new Date();
  const themes = (data ?? []) as SplashTheme[];
  const showing = pickActiveSplash(themes, now);

  const items: SplashListItem[] = themes.map((theme) => ({
    theme,
    status: splashStatus(theme, now, showing?.id === theme.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 className="text-xl">Portadas de temporada</h2>
          <p className="text-sm text-marca-noche/70">
            Cambian el fondo y el texto de la pantalla de entrada. Sin ninguna portada activa, la pantalla se
            ve como siempre. Si hay varias activas a la vez, se muestra la que empezó más recientemente.
          </p>
        </div>
        <Link
          href="/admin/portada/fondo/nueva"
          className="touch-manipulation rounded bg-marca-rojo px-4 py-2 text-sm font-semibold text-marca-claro transition-opacity hover:opacity-90"
        >
          Nueva portada
        </Link>
      </div>

      <SplashList items={items} />
    </div>
  );
}
