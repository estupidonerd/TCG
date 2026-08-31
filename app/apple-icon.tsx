import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/utils/load-google-font";

// iOS no soporta SVG para el ícono de "Agregar a inicio", tiene que ser
// PNG -- 180x180 es el tamaño que recomienda Apple. Sin transparencia:
// iOS la ignora y puede rellenarla con negro, mejor un fondo sólido.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
          fontSize: 84,
          fontFamily: font ? "Titillium Web" : undefined,
        }}
      >
        EN
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: "Titillium Web", data: font, weight: 900, style: "normal" }] : [],
    },
  );
}
