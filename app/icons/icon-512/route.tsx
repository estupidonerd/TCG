import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/utils/logo-data-uri";

// Estática a propósito: sin esto, Next la trata como dinámica (a
// diferencia de la convención icon.tsx) y la regenera en cada request, en
// vez de una sola vez en el build.
export const dynamic = "force-static";

// Ruta propia (no la convención icon.tsx de Next) para tener una URL fija
// y conocida que referenciar desde app/manifest.ts -- los archivos
// generados por la convención de íconos no garantizan una URL estable para
// hardcodear en el manifest. El logo ocupa ~68% del lado para respetar la
// zona segura del ícono "maskable" (Android recorta los bordes).
export async function GET() {
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
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (Satori) no usa next/image */}
        <img src={logoDataUri()} width={348} height={348} alt="" />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
