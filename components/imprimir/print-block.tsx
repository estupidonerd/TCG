import type { CSSProperties } from "react";

// 63x88mm, tamaño estándar tipo Magic. Cada bloque impreso es una columna
// vertical de 63x176mm: el frente abajo en orientación normal, el dorso
// arriba rotado 180°, compartiendo el borde superior del frente. Al
// recortar el bloque y doblarlo por esa línea, el dorso rotado queda
// derecho al dar vuelta la carta ya doblada.
const CARD_W_MM = 63;
const CARD_H_MM = 88;
const SAFE_MARGIN_MM = 3;
const CROP_MARK_LEN_MM = 3;
const CROP_MARK_THICKNESS_MM = 0.15;

// El margen de seguridad va en los tres bordes que se recortan (los dos
// costados y el borde exterior), pero NO en el borde que comparten frente
// y dorso: ahí no se corta, se dobla, y si el arte no llega hasta ese
// borde queda una franja blanca de papel visible en el pliegue. Por eso el
// arte se posiciona con inset 0 arriba (en el marco local, sin rotar) y
// SAFE_MARGIN_MM en los otros tres lados -- ver nota en CardFace sobre
// cómo la rotación del dorso hace que esto termine del lado correcto.
const ART_W_MM = CARD_W_MM - SAFE_MARGIN_MM * 2;
const ART_H_MM = CARD_H_MM - SAFE_MARGIN_MM;

function CropMark({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const len = `${CROP_MARK_LEN_MM}mm`;
  const thickness = `${CROP_MARK_THICKNESS_MM}mm`;
  const offset = `-${CROP_MARK_LEN_MM}mm`;
  const isTop = corner === "tl" || corner === "tr";
  const isLeft = corner === "tl" || corner === "bl";

  const horizontal: CSSProperties = {
    position: "absolute",
    width: len,
    height: thickness,
    background: "#000",
    [isTop ? "top" : "bottom"]: 0,
    [isLeft ? "left" : "right"]: offset,
  };
  const vertical: CSSProperties = {
    position: "absolute",
    width: thickness,
    height: len,
    background: "#000",
    [isLeft ? "left" : "right"]: 0,
    [isTop ? "top" : "bottom"]: offset,
  };

  return (
    <>
      <div style={horizontal} />
      <div style={vertical} />
    </>
  );
}

function CardFace({ url, placeholderClass }: { url: string | null; placeholderClass: string }) {
  if (!url) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center text-white ${placeholderClass}`}
      >
        ?
      </div>
    );
  }
  return (
    // Resolución completa a propósito: next/image redimensiona pensando en
    // viewport de pantalla, y acá se necesita el archivo tal cual para que
    // la impresión salga nítida.
    //
    // top: 0 (sin margen) a propósito -- este mismo componente se usa para
    // el dorso, cuyo contenedor está rotado 180°. El borde "top" local (sin
    // rotar) es el que termina apoyado contra la línea de pliegue una vez
    // aplicada la rotación del contenedor, así que dejarlo en 0 hace que el
    // arte llegue justo hasta el pliegue tanto en el frente como en el
    // dorso, sin blanco de por medio al doblar.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      style={{
        position: "absolute",
        left: `${SAFE_MARGIN_MM}mm`,
        top: 0,
        width: `${ART_W_MM}mm`,
        height: `${ART_H_MM}mm`,
        objectFit: "cover",
      }}
    />
  );
}

export function PrintBlock({
  frontUrl,
  backUrl,
  label,
  lowRes,
}: {
  frontUrl: string | null;
  backUrl: string | null;
  label: string;
  lowRes: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative"
        style={{ width: `${CARD_W_MM}mm`, height: `${CARD_H_MM * 2}mm` }}
      >
        {/* Dorso: arriba, rotado 180° */}
        <div
          className="absolute left-0 top-0 overflow-hidden"
          style={{
            width: `${CARD_W_MM}mm`,
            height: `${CARD_H_MM}mm`,
            transform: "rotate(180deg)",
          }}
        >
          <CardFace url={backUrl} placeholderClass="bg-marca-violeta" />
        </div>

        {/* Frente: abajo, orientación normal */}
        <div
          className="absolute left-0 overflow-hidden"
          style={{ top: `${CARD_H_MM}mm`, width: `${CARD_W_MM}mm`, height: `${CARD_H_MM}mm` }}
        >
          <CardFace url={frontUrl} placeholderClass="bg-gray-400" />
        </div>

        {/* Línea de pliegue, suave y punteada */}
        <div
          className="absolute left-0"
          style={{
            top: `${CARD_H_MM}mm`,
            width: `${CARD_W_MM}mm`,
            borderTop: "0.3mm dashed #999",
          }}
        />

        <CropMark corner="tl" />
        <CropMark corner="tr" />
        <CropMark corner="bl" />
        <CropMark corner="br" />
      </div>
      <span
        className="mt-1 max-w-[63mm] truncate text-center text-[7px] leading-tight text-marca-noche/50 print:hidden"
        style={{ width: `${CARD_W_MM}mm` }}
      >
        {label}
        {lowRes ? " (baja resolución)" : ""}
      </span>
    </div>
  );
}
