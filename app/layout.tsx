import type { Metadata, Viewport } from "next";
import { Titillium_Web } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { UserProvider } from "@/components/providers/user-provider";
import { PackOpeningProvider } from "@/components/providers/pack-opening-provider";
import { VoteStatusProvider } from "@/components/providers/vote-status-provider";
import { VotePrompt } from "@/components/votes/vote-prompt";
import { isVoteOpen } from "@/lib/config/vote";
import { SiteHeader } from "@/components/nav/site-header";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import type { GameSettings } from "@/lib/supabase/types";

const titilliumWeb = Titillium_Web({
  variable: "--font-titillium-web",
  subsets: ["latin"],
  weight: ["300", "400", "900"],
});

const SITE_URL = "https://tcg.estupidonerd.com";
const SITE_NAME = "Estúpido Nerd TCG";
const SITE_DESCRIPTION =
  "Canjea códigos, arma tu colección e intercambia cartas con otros jugadores del podcast Estúpido Nerd.";

// opengraph-image.tsx / icon.tsx / apple-icon.tsx / manifest.ts (todos en
// este mismo directorio) se enlazan solos en el <head> -- Next los detecta
// por convención de archivo, no hace falta declararlos acá.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#eaeff4",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: settings },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("game_settings").select("card_name_font_url").eq("id", true).single(),
  ]);

  // La fuente del nombre la sube el admin desde /admin/ajustes (no un
  // asset del proyecto): se inyecta acá como @font-face apuntando a esa
  // URL pública, así un cambio de fuente se aplica a todo el juego al
  // instante, sin tocar código ni redesplegar. Sin fuente propia todavía,
  // --font-card-name (definida en globals.css) ya cae a Titillium Web.
  const cardNameFontUrl = (settings as GameSettings | null)?.card_name_font_url ?? null;

  // Votación "Próximas actualizaciones": fuera de la ventana de fechas (o
  // sin sesión) no se hace ninguna consulta y todo queda apagado. Dentro,
  // se leen solo dos cosas del propio jugador (RLS ya lo limita a él).
  // Si la consulta de respuestas falla (por ejemplo, la migración todavía
  // no se corrió en ese proyecto), se deja apagado en vez de mostrar un
  // popup que después no podría guardar nada.
  let voteStatus = { isOpen: false, hasVoted: true, welcomePending: false };
  if (user && isVoteOpen()) {
    const [{ data: profileRow }, { data: voteRow, error: voteError }] = await Promise.all([
      supabase.from("profiles").select("has_seen_welcome").eq("id", user.id).single(),
      supabase.from("vote_responses").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    if (voteError) {
      // Silencioso para el jugador, pero visible en la consola del servidor:
      // sin esto, una migración sin correr (o sin recargar el caché de
      // PostgREST) deja todo apagado sin ninguna pista de por qué.
      console.error("[votación] No se pudo leer vote_responses:", voteError.code, voteError.message);
    } else {
      voteStatus = {
        isOpen: true,
        hasVoted: Boolean(voteRow),
        welcomePending: !profileRow?.has_seen_welcome,
      };
    }
  }

  return (
    <html lang="es">
      {cardNameFontUrl && (
        <head>
          <style>{`
            @font-face {
              font-family: 'CardNameFont';
              src: url('${cardNameFontUrl}');
              font-display: swap;
            }
            :root {
              --font-card-name-local: 'CardNameFont';
            }
          `}</style>
        </head>
      )}
      <body className={`${titilliumWeb.variable} antialiased`}>
        <UserProvider initialUser={user}>
          <PackOpeningProvider>
            <VoteStatusProvider value={voteStatus}>
              <SiteHeader />
              {children}
              <FeedbackButton />
              <VotePrompt />
            </VoteStatusProvider>
          </PackOpeningProvider>
        </UserProvider>
      </body>
    </html>
  );
}
