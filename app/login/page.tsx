import { redirect } from "next/navigation";
import { preload } from "react-dom";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";
import { getAccessState } from "@/lib/access/get-access-state";
import { getActiveSplash } from "@/lib/splash/get-active-splash";
import { AccessNoticeCard } from "@/components/access/access-notice-card";
import { TeamAccessLink } from "@/components/access/team-access-link";
import { LoginPanel } from "@/components/auth/login-panel";
import { SplashLayer } from "@/components/splash/splash-layer";

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

  // Si falla alguna de las dos lecturas, la pantalla se ve como siempre: el
  // login abierto y sin portada.
  const [access, splash] = await Promise.all([getAccessState(), getActiveSplash()]);

  // Hay una portada vigente: su imagen se pide ya, en paralelo con el HTML, que
  // es lo primero que se ve en celular.
  if (splash?.image_url) {
    preload(splash.image_url, { as: "image", fetchPriority: "high" });
  }
  const layer = splash && (
    <SplashLayer
      imageUrl={splash.image_url}
      focusX={splash.focus_x}
      focusY={splash.focus_y}
      overlayOpacity={splash.overlay_opacity}
      priority
    />
  );

  const notice = (
    <AccessNoticeCard
      title={access.notice_title}
      body={access.notice_body}
      textColor={access.notice_text_color}
      returnText={access.notice_return_text}
    />
  );

  // Cerrado: la pantalla de entrada es el aviso, sin botones de login. El
  // equipo entra por el enlace discreto de abajo (/acceso-equipo). Con portada,
  // la imagen va de fondo (el texto del cartel es el del aviso, no el de la
  // portada).
  if (access.access_mode === "closed") {
    return (
      <main className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-marca-noche px-6 py-12">
        {layer}
        <div className="relative z-10 flex w-full flex-col items-center">
          <div className="w-full max-w-xl">{notice}</div>
          <TeamAccessLink />
        </div>
      </main>
    );
  }

  // Sin portada: exactamente como siempre. Con portada, fondo de la imagen (o
  // azul casi negro si la portada no trae imagen, para que el texto, que por
  // defecto es blanco, siempre se lea) y el título y texto de la portada.
  return (
    <main
      className={`flex min-h-svh flex-col items-center justify-center px-6 py-12 ${
        splash ? "relative isolate overflow-hidden bg-marca-noche" : ""
      }`}
    >
      {layer}
      <div className={splash ? "relative z-10 flex w-full justify-center" : "contents"}>
        <LoginPanel
          title={splash?.title ?? undefined}
          subtitle={splash?.body ?? undefined}
          textColor={splash?.text_color ?? null}
          next={next}
          error={Boolean(error)}
          notice={access.access_mode === "notice" ? notice : undefined}
        />
      </div>
    </main>
  );
}
