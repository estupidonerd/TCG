import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { DiscordLoginButton } from "@/components/auth/discord-login-button";
import { TwitchLoginButton } from "@/components/auth/twitch-login-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeRedirectPath(rawNext);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si ya hay sesión, no tiene sentido mostrar el login: lo mandamos
  // directo a donde iba.
  if (user) {
    redirect(next);
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl">Estúpido Nerd TCG</h1>
          <p className="text-sm font-light text-marca-noche/70">
            Inicia sesión para armar tu colección
          </p>
        </div>

        {error && (
          <p className="w-full rounded border border-marca-rojo/40 bg-marca-rojo/10 px-4 py-2 text-sm text-marca-rojo">
            No pudimos completar el login. Intenta de nuevo.
          </p>
        )}

        <div className="flex w-full flex-col gap-3">
          <GoogleLoginButton next={next} />
          <DiscordLoginButton next={next} />
          <TwitchLoginButton next={next} />
        </div>
      </div>
    </main>
  );
}
