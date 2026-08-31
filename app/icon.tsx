import { ImageResponse } from "next/og";

// Favicon de pestaña: 32px es demasiado chico para que valga la pena traer
// una tipografía custom (ver opengraph-image.tsx / apple-icon.tsx, donde sí
// importa), así que usa la fuente por defecto de Satori.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 18,
        }}
      >
        EN
      </div>
    ),
    { ...size },
  );
}
