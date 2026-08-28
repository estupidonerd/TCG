import type { Metadata } from "next";
import { Titillium_Web } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { UserProvider } from "@/components/providers/user-provider";
import { SiteHeader } from "@/components/nav/site-header";

const titilliumWeb = Titillium_Web({
  variable: "--font-titillium-web",
  subsets: ["latin"],
  weight: ["300", "400", "900"],
});

export const metadata: Metadata = {
  title: "Estúpido Nerd TCG",
  description: "El juego de cartas coleccionables de Estúpido Nerd",
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
          <SiteHeader />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
