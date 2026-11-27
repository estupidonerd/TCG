import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { preload } from "react-dom";
import { getAccessState } from "@/lib/access/get-access-state";
import { getActiveSplash } from "@/lib/splash/get-active-splash";
import { SplashLayer } from "@/components/splash/splash-layer";
import { AccessNoticeCard } from "@/components/access/access-notice-card";
import { TeamAccessLink } from "@/components/access/team-access-link";

export const metadata: Metadata = {
  title: "Aviso",
  robots: { index: false, follow: false },
};

// Pantalla que ve cualquiera que pida una ruta del juego mientras el modo es
// Cerrado. El middleware NO redirige: reescribe la petición hasta acá (la URL
// del navegador no cambia) y marca el header x-access-blocked. Si alguien abre
// /aviso directamente, sin ese header, no hay nada que mostrar.
export default async function AvisoPage() {
  const blocked = (await headers()).get("x-access-blocked") === "1";
  if (!blocked) redirect("/");

  const [state, splash] = await Promise.all([getAccessState(), getActiveSplash()]);
  if (splash?.image_url) {
    preload(splash.image_url, { as: "image", fetchPriority: "high" });
  }

  // Con una portada vigente, su imagen es el fondo del aviso; sin ella, el
  // azul casi negro de siempre. El texto es el del aviso, no el de la portada.
  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-marca-noche px-6 py-12">
      {splash && (
        <SplashLayer
          imageUrl={splash.image_url}
          focusX={splash.focus_x}
          focusY={splash.focus_y}
          overlayOpacity={splash.overlay_opacity}
          priority
        />
      )}
      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="w-full max-w-xl">
          <AccessNoticeCard
            title={state.notice_title}
            body={state.notice_body}
            textColor={state.notice_text_color}
            returnText={state.notice_return_text}
          />
        </div>
        <TeamAccessLink />
      </div>
    </main>
  );
}
