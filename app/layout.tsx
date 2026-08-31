import type { Metadata, Viewport } from "next";
import { Titillium_Web } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { UserProvider } from "@/components/providers/user-provider";
import { PackOpeningProvider } from "@/components/providers/pack-opening-provider";
import { SiteHeader } from "@/components/nav/site-header";
import { FeedbackButton } from "@/components/feedback/feedback-button";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="es">
      <body className={`${titilliumWeb.variable} antialiased`}>
        <UserProvider initialUser={user}>
          <PackOpeningProvider>
            <SiteHeader />
            {children}
            <FeedbackButton />
          </PackOpeningProvider>
        </UserProvider>
      </body>
    </html>
  );
}
