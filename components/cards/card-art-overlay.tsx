"use client";

import type { CSSProperties } from "react";
import type { CardTemplate } from "@/lib/supabase/types";
import { useFitText } from "@/lib/hooks/use-fit-text";

export type CardArtOverlayVariant = "coleccion" | "impresion" | "postal";

type IconInfo = { color_hex: string | null; icon_url: string | null } | null | undefined;

// Superposición en vivo (CSS/DOM, nunca genera ni guarda una imagen) del
// marco, íconos, Poder, Score, nombre y línea de crédito de una carta. Se
// monta dentro de un contenedor position:relative ya existente (el mismo
// aspect-[5/7] que envuelve la imagen en cada lugar donde se usa: sobre
// recién abierto, tile de colección, detalle, preview del admin, bloque de
// impresión y postal).
//
// El jugador SIEMPRE ve la carta completa (marco, íconos, Poder, Score) --
// Poder no está oculto en pantalla, es un dato más de la carta como
// cualquier otro. El único lugar sin ninguna de estas capas es la postal.
//
// Regla de color: los 4 elementos (ícono de Género, ícono de Rasgo, Poder y
// Score) se recolorean con el color_hex del GÉNERO -- el Rasgo no tiene
// color propio.
export function CardArtOverlay({
  variant,
  template,
  applyArtTemplate = true,
  name,
  useCardNameAsDisplay,
  displayLine1,
  displayLine2,
  displayLine3,
  nameShadowIntensity,
  nameFontSize,
  nameLineHeight,
  power,
  score,
  genre,
  trait,
  chapterInfo,
  artist,
  showCreditLine,
}: {
  variant: CardArtOverlayVariant;
  template: CardTemplate | null;
  // Cartas especiales cuyo arte ya trae todo integrado: no se les superpone
  // nada, en ningún lado.
  applyArtTemplate?: boolean;
  name: string;
  useCardNameAsDisplay: boolean;
  displayLine1?: string | null;
  displayLine2?: string | null;
  displayLine3?: string | null;
  // 0-100, por carta. Poder y Score nunca llevan sombra.
  nameShadowIntensity?: number;
  // Tamaño (% del ancho de carta, cqw) e interlineado (%) del nombre, por
  // carta -- nombres de largo distinto necesitan ajustes distintos.
  nameFontSize?: number;
  nameLineHeight?: number;
  power?: number | null;
  score?: number | null;
  genre?: IconInfo;
  trait?: IconInfo;
  chapterInfo?: string | null;
  artist?: string | null;
  // Por defecto la línea de crédito solo va en "impresion" (nunca en
  // "postal": ahí va aparte, en el reverso, ver postal-block.tsx). Se puede
  // forzar a mostrarla también en "coleccion" (ej. el detalle de carta),
  // sin necesidad de un variant nuevo.
  showCreditLine?: boolean;
}) {
  if (!template || !applyArtTemplate) return null;

  const lines = useCardNameAsDisplay
    ? [name]
    : [displayLine1, displayLine2, displayLine3].filter(
        (line): line is string => Boolean(line && line.trim()),
      );

  const showCredit = showCreditLine ?? variant === "impresion";
  const showFrameAndStats = variant !== "postal";
  // La postal es SOLO arte + texto de crédito -- ni siquiera el nombre.
  const showName = variant !== "postal";
  const genreColor = genre?.color_hex ?? null;
  const shadowAlpha = Math.max(0, Math.min(100, nameShadowIntensity ?? 50)) / 100;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ containerType: "inline-size" }}
      aria-hidden
    >
      {showFrameAndStats && template.marco_url && (
        // eslint-disable-next-line @next/next/no-img-element -- marco decorativo, no necesita optimización de next/image
        <img
          src={template.marco_url}
          alt=""
          className="absolute inset-0 h-full w-full object-fill"
        />
      )}

      {showFrameAndStats && (
        <>
          <MaskedIcon
            url={genre?.icon_url ?? null}
            color={genreColor}
            sizePercent={template["tamaño_iconos"]}
            style={{
              top: `${template.icono_genero.offset_y}%`,
              left: `${template.icono_genero.offset_x}%`,
            }}
          />
          <MaskedIcon
            url={trait?.icon_url ?? null}
            color={genreColor}
            sizePercent={template["tamaño_iconos"]}
            style={{
              bottom: `${template.icono_rasgo.offset_y}%`,
              right: `${template.icono_rasgo.offset_x}%`,
            }}
          />

          {/* Score: siempre visible, abajo-izquierda, color del Género. Sin
              sombra -- el color se elige a mano para que ya se lea bien.
              Sin puntaje asignado, muestra "X" en vez de no mostrar nada. */}
          {genreColor && (
            <span
              className="absolute font-card-name font-black leading-none"
              style={{
                bottom: `${template.score.offset_y}%`,
                left: `${template.score.offset_x}%`,
                fontSize: `${template["tamaño_poder_score"]}cqw`,
                color: genreColor,
                transform: `scaleY(${(template["altura_poder_score"] ?? 100) / 100})`,
                transformOrigin: "bottom left",
              }}
            >
              {score !== null && score !== undefined ? score.toFixed(1) : "X"}
            </span>
          )}

          {/* Poder: visible siempre, como cualquier otro dato de la carta.
              Color del Género, sin sombra. Sin poder asignado, "X". */}
          {genreColor && (
            <span
              className="absolute font-card-name font-black leading-none"
              style={{
                top: `${template.poder.offset_y}%`,
                right: `${template.poder.offset_x}%`,
                fontSize: `${template["tamaño_poder_score"]}cqw`,
                color: genreColor,
                transform: `scaleY(${(template["altura_poder_score"] ?? 100) / 100})`,
                transformOrigin: "top right",
              }}
            >
              {power !== null && power !== undefined ? power : "X"}
            </span>
          )}
        </>
      )}

      {showName && lines.length > 0 && (
        <div
          className="absolute flex flex-col items-center justify-center text-center font-card-name font-black uppercase text-white"
          style={{
            left: `${template.zona_nombre.x}%`,
            top: `${template.zona_nombre.y}%`,
            width: `${template.zona_nombre.ancho}%`,
            height: `${template.zona_nombre.alto}%`,
            transform: `rotate(${template.zona_nombre.angulo}deg)`,
            lineHeight: `${nameLineHeight ?? 110}%`,
            fontSize: `${nameFontSize ?? 10}cqw`,
            textShadow: shadowAlpha > 0 ? `0 1px 3px rgba(0,0,0,${shadowAlpha})` : "none",
          }}
        >
          {lines.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
        </div>
      )}

      {showCredit && (chapterInfo || artist) && (
        <CreditLine
          chapterInfo={chapterInfo ?? null}
          artist={artist ?? null}
          offsetY={template.credito.offset_y}
          sizePercent={template.credito["tamaño"]}
        />
      )}
    </div>
  );
}

function MaskedIcon({
  url,
  color,
  sizePercent,
  style,
}: {
  url: string | null | undefined;
  color: string | null;
  sizePercent: number;
  style: CSSProperties;
}) {
  if (!url || !color) return null;
  return (
    <div
      className="absolute aspect-square"
      style={{
        width: `${sizePercent}%`,
        backgroundColor: color,
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        ...style,
      }}
    />
  );
}

// "{chapter_info}. Arte de {artist}." -- abajo, siempre centrado en X, gris
// claro, tamaño y offset vertical configurables desde la plantilla. Además
// del límite de CHAPTER_INFO_MAX_LENGTH del formulario, useFitText recorta
// con "…" en el momento de renderizar por si el nombre del artista (sin
// límite propio) hace que el texto combinado no entre igual.
function CreditLine({
  chapterInfo,
  artist,
  offsetY,
  sizePercent,
}: {
  chapterInfo: string | null;
  artist: string | null;
  offsetY: number;
  sizePercent: number;
}) {
  const full = [chapterInfo?.trim(), artist ? `Arte de ${artist.trim()}.` : null]
    .filter(Boolean)
    .join(chapterInfo?.trim() ? ". " : "");
  const { ref, fitted } = useFitText(full, 2);

  if (!full) return null;

  return (
    <span
      ref={ref}
      className="absolute left-1/2 w-[94%] -translate-x-1/2 select-text overflow-hidden text-center leading-tight"
      style={{
        bottom: `${offsetY}%`,
        fontSize: `${sizePercent}cqw`,
        color: "#999999",
        // Red de seguridad además de useFitText: por más que algo falle en
        // el recorte por JS (primer render antes de que corra el efecto,
        // fuente que todavía no cargó, etc.), esto garantiza por CSS que
        // nunca se vean más de 2 líneas -- leading-tight es 1.25.
        maxHeight: "2.5em",
      }}
    >
      {fitted}
    </span>
  );
}
