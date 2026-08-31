import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/utils/load-google-font";

// Estática a propósito: sin esto, Next la trata como dinámica (a
// diferencia de la convención icon.tsx) y la regenera -- con el fetch a
// Google Fonts incluido -- en cada request, en vez de una sola vez en el
// build.
export const dynamic = "force-static";

// Ruta propia (no la convención icon.tsx de Next) para tener una URL fija
// y conocida que referenciar desde app/manifest.ts -- los archivos
// generados por la convención de íconos no garantizan una URL estable para
// hardcodear en el manifest.
export async function GET() {
  const font = await loadGoogleFont("Titillium Web", 900, "EN");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#8100cc",
          color: "#eaeff4",
          fontSize: 88,
          fontFamily: font ? "Titillium Web" : undefined,
        }}
      >
        EN
      </div>
    ),
    {
      width: 192,
      height: 192,
      fonts: font ? [{ name: "Titillium Web", data: font, weight: 900, style: "normal" }] : [],
    },
  );
}
