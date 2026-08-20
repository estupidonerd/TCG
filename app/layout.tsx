import type { Metadata } from "next";
import { Titillium_Web } from "next/font/google";
import "./globals.css";

const titilliumWeb = Titillium_Web({
  variable: "--font-titillium-web",
  subsets: ["latin"],
  weight: ["300", "400", "900"],
});

export const metadata: Metadata = {
  title: "Estúpido Nerd TCG",
  description: "El juego de cartas coleccionables de Estúpido Nerd",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${titilliumWeb.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
