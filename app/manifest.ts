import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Estúpido Nerd TCG",
    short_name: "TCG",
    description:
      "Canjea códigos, arma tu colección e intercambia cartas con otros jugadores del podcast Estúpido Nerd.",
    start_url: "/",
    display: "standalone",
    background_color: "#eaeff4",
    theme_color: "#eaeff4",
    icons: [
      { src: "/icons/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
