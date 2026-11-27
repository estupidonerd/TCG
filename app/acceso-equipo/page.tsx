import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { DiscordLoginButton } from "@/components/auth/discord-login-button";
import { TwitchLoginButton } from "@/components/auth/twitch-login-button";

export const metadata: Metadata = {
  title: "Acceso del equipo",
  robots: { index: false, follow: false },
};

// Login para el equipo (administradores) que sigue funcionando aunque el juego
// esté cerrado y la pantalla de entrada tenga los botones ocultos.
//
// Después de iniciar sesión se va a /admin. Si quien entró NO es admin, /admin
// lo manda a "/", y en modo Cerrado "/" muestra el aviso: la sesión queda
// intacta, nadie se desconecta.
export default async function AccesoEquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ya hay sesión: admin -> panel; cualquier otro -> inicio (que en modo
  // Cerrado es el aviso).
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    redirect(profile?.is_admin ? "/admin" : "/");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl">Acceso del equipo</h1>
          <p className="text-sm font-light text-marca-noche/70">
            Solo para administradores. Inicia sesión con tu cuenta del equipo.
          </p>
        </div>

        {error && (
          <p className="w-full rounded border border-marca-rojo/40 bg-marca-rojo/10 px-4 py-2 text-sm text-marca-rojo">
            No pudimos completar el login. Intenta de nuevo.
          </p>
        )}

        <div className="flex w-full flex-col gap-3">
          <GoogleLoginButton next="/admin" />
          <DiscordLoginButton next="/admin" />
          <TwitchLoginButton next="/admin" />
        </div>

        <Link href="/" className="text-sm text-marca-noche/60 hover:underline">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
