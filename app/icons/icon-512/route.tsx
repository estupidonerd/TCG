import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/utils/load-google-font";

// Estática a propósito: ver el comentario en icons/icon-192/route.tsx.
export const dynamic = "force-static";

// Mismo ícono que icon-192, a mayor resolución -- también sirve como
// versión "maskable" en el manifest (el fondo sólido con el texto
// centrado y con margen ya deja zona de seguridad para el recorte
// adaptativo de Android).
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
          fontSize: 224,
          fontFamily: font ? "Titillium Web" : undefined,
        }}
      >
        EN
      </div>
    ),
    {
      width: 512,
      height: 512,
      fonts: font ? [{ name: "Titillium Web", data: font, weight: 900, style: "normal" }] : [],
    },
  );
}
