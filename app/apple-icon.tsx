import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/utils/logo-data-uri";

// iOS no soporta SVG para el ícono de "Agregar a inicio", tiene que ser
// PNG -- 180x180 es el tamaño que recomienda Apple. Sin transparencia:
// iOS la ignora y puede rellenarla con negro, así que el logo va sobre un
// fondo sólido de la marca (#eaeff4).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#eaeff4",
        }}
      >
        <img src={logoDataUri()} width={130} height={130} alt="" />
      </div>
    ),
    { ...size },
  );
}
