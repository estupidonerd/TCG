import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccessState } from "@/lib/access/get-access-state";
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

  const state = await getAccessState();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-marca-noche px-6 py-12">
      <div className="w-full max-w-xl">
        <AccessNoticeCard
          title={state.notice_title}
          body={state.notice_body}
          textColor={state.notice_text_color}
          returnText={state.notice_return_text}
        />
      </div>
      <TeamAccessLink />
    </main>
  );
}
