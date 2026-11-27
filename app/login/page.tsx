import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { DiscordLoginButton } from "@/components/auth/discord-login-button";
import { TwitchLoginButton } from "@/components/auth/twitch-login-button";
import { getAccessState } from "@/lib/access/get-access-state";
import { AccessNoticeCard } from "@/components/access/access-notice-card";
import { TeamAccessLink } from "@/components/access/team-access-link";

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

  // Si falla la lectura, getAccessState() devuelve "abierto": el login se ve
  // como siempre.
  const access = await getAccessState();
  const notice = (
    <AccessNoticeCard
      title={access.notice_title}
      body={access.notice_body}
      textColor={access.notice_text_color}
      returnText={access.notice_return_text}
    />
  );

  // Cerrado: la pantalla de entrada es el aviso, sin botones de login. El
  // equipo entra por el enlace discreto de abajo (/acceso-equipo).
  if (access.access_mode === "closed") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-marca-noche px-6 py-12">
        <div className="w-full max-w-xl">{notice}</div>
        <TeamAccessLink />
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        {access.access_mode === "notice" && notice}

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
