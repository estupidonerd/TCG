import { ImageResponse } from "next/og";
import { loadGoogleFont } from "@/lib/utils/load-google-font";

export const alt = "Estúpido Nerd TCG";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TITLE = "ESTÚPIDO NERD TCG";
const SUBTITLE = "Canjea, colecciona e intercambia cartas";

export default async function OpengraphImage() {
  const bold = await loadGoogleFont("Titillium Web", 900, TITLE);
  const light = await loadGoogleFont("Titillium Web", 300, SUBTITLE);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          backgroundColor: "#000021",
        }}
      >
        <div
          style={{
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: 2,
            color: "#FF3333",
            textTransform: "uppercase",
            fontFamily: bold ? "Titillium Web" : undefined,
          }}
        >
          {TITLE}
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 300,
            color: "#EAEFF4",
            fontFamily: light ? "Titillium Web" : undefined,
          }}
        >
          {SUBTITLE}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(bold ? [{ name: "Titillium Web", data: bold, weight: 900 as const, style: "normal" as const }] : []),
        ...(light ? [{ name: "Titillium Web", data: light, weight: 300 as const, style: "normal" as const }] : []),
      ],
    },
  );
}
