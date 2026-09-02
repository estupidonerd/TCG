import type { CSSProperties, ReactNode } from "react";
import { CardArtOverlay } from "@/components/cards/card-art-overlay";
import { useFitText } from "@/lib/hooks/use-fit-text";
import type { CardTemplate } from "@/lib/supabase/types";
import type { PrintCardAsset } from "@/app/imprimir/actions";

// Postal: 10x15cm. A diferencia de la carta normal (que dobla por el borde
// corto, frente abajo / dorso arriba, dando un bloque de 63x176mm que SÍ
// entra en una hoja vertical), doblar una postal de 150mm de alto por ese
// mismo esquema daría un bloque de 100x300mm -- más alto que cualquier hoja
// estándar, incluso en horizontal. Por eso acá el frente y el dorso van
// lado a lado, compartiendo el borde VERTICAL (el lado largo de 150mm) en
// vez del horizontal: el bloque resultante es 200x150mm, que sí entra en
// una hoja en orientación horizontal (postal-sheet.tsx fuerza esa
// orientación). Se dobla por la línea vertical del medio.
const POSTAL_W_MM = 100;
const POSTAL_H_MM = 150;
const SAFE_MARGIN_MM = 3;
const CROP_MARK_LEN_MM = 3;
const CROP_MARK_THICKNESS_MM = 0.15;

export const POSTAL_BLOCK_W_MM = POSTAL_W_MM * 2;
export const POSTAL_BLOCK_H_MM = POSTAL_H_MM;

const ART_W_MM = POSTAL_W_MM - SAFE_MARGIN_MM * 2;
const ART_H_MM = POSTAL_H_MM - SAFE_MARGIN_MM * 2;

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

function PostalFace({
  url,
  placeholderClass,
  overlay,
}: {
  url: string | null;
  placeholderClass: string;
  overlay?: ReactNode;
}) {
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
    <div
      className="absolute"
      style={{
        left: `${SAFE_MARGIN_MM}mm`,
        top: `${SAFE_MARGIN_MM}mm`,
        width: `${ART_W_MM}mm`,
        height: `${ART_H_MM}mm`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- resolución completa a propósito, ver la misma nota en print-block.tsx */}
      <img
        src={url}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      {overlay}
    </div>
  );
}

// Crédito en el reverso de la postal, no en el frente: posición y rotación
// fijas (sin slider, a pedido). Se monta AFUERA del contenedor del dorso (que
// está rotado 180° para que, una vez recortado y doblado, quede derecho) --
// si fuera adentro, esa rotación se sumaría a la propia y el resultado en
// pantalla/impreso sería impredecible (así terminó mal la primera vez). Acá
// se posiciona directo en las coordenadas planas del bloque completo (0 a
// 100mm = mitad del dorso), sin ninguna rotación heredada de por medio:
// arriba a la izquierda del dorso, girado 90° en sentido horario, se lee de
// arriba hacia abajo.
function PostalBackCredit({
  chapterInfo,
  artist,
}: {
  chapterInfo: string | null;
  artist: string | null;
}) {
  const full = [chapterInfo?.trim(), artist ? `Arte de ${artist.trim()}.` : null]
    .filter(Boolean)
    .join(chapterInfo?.trim() ? ". " : "");
  const { ref, fitted } = useFitText(full, 2);

  if (!full) return null;

  return (
    <span
      ref={ref}
      className="absolute select-text overflow-hidden leading-tight"
      style={{
        top: `${SAFE_MARGIN_MM + 3.5}mm`,
        left: `${SAFE_MARGIN_MM + 7}mm`,
        transform: "rotate(90deg)",
        transformOrigin: "top left",
        // Más ancho que antes (era 60mm y todavía recortaba texto real):
        // esto es el largo del recorrido vertical una vez rotado, no el
        // ancho visual de la columna.
        width: "85mm",
        // Un poco más holgado que lo que mide useFitText (lineHeight*2 + 1px)
        // para que el recorte de CSS nunca alcance a comerse una línea que
        // el propio cálculo en JS ya dio por válida.
        maxHeight: "calc(2.5em + 2px)",
        fontSize: "2.8mm",
        color: "#999999",
      }}
    >
      {fitted}
    </span>
  );
}

export function PostalBlock({
  card,
  backUrl,
  cardTemplate,
  label,
}: {
  card: PrintCardAsset;
  backUrl: string | null;
  cardTemplate: CardTemplate | null;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: `${POSTAL_BLOCK_W_MM}mm`, height: `${POSTAL_BLOCK_H_MM}mm` }}>
        {/* Dorso: izquierda, rotado 180° -- al doblar por la línea vertical
            del medio, queda derecho detrás del frente. */}
        <div
          className="absolute left-0 top-0 overflow-hidden"
          style={{ width: `${POSTAL_W_MM}mm`, height: `${POSTAL_H_MM}mm`, transform: "rotate(180deg)" }}
        >
          <PostalFace url={backUrl} placeholderClass="bg-marca-violeta" />
        </div>

        {/* Crédito del dorso: en coordenadas planas del bloque completo,
            fuera del contenedor rotado de arriba -- ver nota en
            PostalBackCredit sobre por qué no puede ir adentro. */}
        <PostalBackCredit chapterInfo={card.chapterInfo} artist={card.artist} />

        {/* Frente: derecha, solo arte + nombre + crédito */}
        <div
          className="absolute top-0 overflow-hidden"
          style={{ left: `${POSTAL_W_MM}mm`, width: `${POSTAL_W_MM}mm`, height: `${POSTAL_H_MM}mm` }}
        >
          <PostalFace
            url={card.frontUrl}
            placeholderClass="bg-gray-400"
            overlay={
              <CardArtOverlay
                variant="postal"
                template={cardTemplate}
                applyArtTemplate={card.applyArtTemplate}
                name={card.name}
                useCardNameAsDisplay={card.useCardNameAsDisplay}
                displayLine1={card.displayLine1}
                displayLine2={card.displayLine2}
                displayLine3={card.displayLine3}
                nameShadowIntensity={card.nameShadowIntensity}
              />
            }
          />
        </div>

        {/* Línea de pliegue vertical, en el medio */}
        <div
          className="absolute top-0"
          style={{ left: `${POSTAL_W_MM}mm`, height: `${POSTAL_H_MM}mm`, borderLeft: "0.3mm dashed #999" }}
        />

        <CropMark corner="tl" />
        <CropMark corner="tr" />
        <CropMark corner="bl" />
        <CropMark corner="br" />
      </div>
      <span
        className="mt-3 max-w-[200mm] truncate text-center text-[7px] leading-tight text-marca-noche/50 print:hidden"
        style={{ width: `${POSTAL_BLOCK_W_MM}mm` }}
      >
        {label}
      </span>
    </div>
  );
}
