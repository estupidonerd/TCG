import type { NextConfig } from "next";

// Se lee del mismo env var que usan los clientes de Supabase, en vez de
// hardcodear el hostname: así next/image sigue funcionando sin tocar este
// archivo si el proyecto de Supabase cambia.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default es 1MB. El form de /admin/cards manda imágenes (frente de
      // pantalla + frente de impresión en alta res) dentro del mismo
      // FormData que recibe el Server Action, así que con el default
      // cualquier archivo de más de ~1MB hacía fallar el fetch entero
      // ("Failed to fetch" en el navegador, sin ni siquiera llegar a
      // ejecutarse la función). 40mb cubre el caso más pesado (25MB de
      // impresión + 8MB de pantalla) con margen.
      bodySizeLimit: "40mb",
    },
  },
  images: {
    // Las imágenes de cartas viven en Supabase Storage (bucket público
    // card-images), no en este dominio -- next/image rechaza por defecto
    // cualquier host externo que no esté acá.
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
