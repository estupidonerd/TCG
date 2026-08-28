"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { RARITY_LABELS } from "@/lib/supabase/types";
import type { Card, Genre, Trait } from "@/lib/supabase/types";
import {
  RARITY_BORDER_CLASS,
  RARITY_BADGE_CLASS,
  DARK_PANEL_RARITIES,
} from "@/lib/supabase/rarity-colors";
import { capitalizeFirst } from "@/lib/utils/capitalize";
import { TradeAvailabilityControl } from "./trade-availability-control";

export function CardDetail({
  card,
  genre,
  trait,
  cardBackUrl,
  quantity,
  publicQuantity,
  prevSlug,
  nextSlug,
}: {
  card: Card;
  genre: Genre | null;
  trait: Trait | null;
  cardBackUrl: string | null;
  quantity: number;
  publicQuantity: number;
  prevSlug: string | null;
  nextSlug: string | null;
}) {
  const [flipped, setFlipped] = useState(false);
  const owned = quantity > 0;
  const darkPanel = DARK_PANEL_RARITIES.has(card.rarity);
  const router = useRouter();

  // Flechas del teclado para ir a la carta anterior/siguiente sin tocar la
  // pantalla. Se ignora si hay un modificador (Cmd/Ctrl/Alt) para no pisar
  // atajos del navegador.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowLeft" && prevSlug) {
        router.push(`/coleccion/${prevSlug}`);
      } else if (event.key === "ArrowRight" && nextSlug) {
        router.push(`/coleccion/${nextSlug}`);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevSlug, nextSlug, router]);

  const linkClass = darkPanel
    ? "text-white/70 hover:text-white"
    : "text-marca-noche/60 hover:text-marca-noche";
  const cardBlockClass = darkPanel
    ? "border-white/15 bg-white/10"
    : "border-marca-noche/10 bg-white";
  const badgeNeutralClass = darkPanel
    ? "bg-white/10 text-white"
    : "bg-marca-noche/10 text-marca-noche";
  const mutedTextClass = darkPanel ? "text-white/60" : "text-marca-noche/60";

  return (
    <main
      className={`min-h-svh ${darkPanel ? "bg-marca-noche text-white" : "bg-marca-claro text-marca-noche"}`}
    >
      <div className="mx-auto flex max-w-5xl flex-col lg:h-svh lg:flex-row lg:items-stretch">
        {/* Arte: arriba en mobile, columna izquierda fija en desktop. La fila
            de arriba queda pinneada al mismo padding-top que el <h1> de la
            columna derecha (sin lg:justify-center en el contenedor entero)
            para que ambas franjas coincidan en altura; el resto (imagen +
            disponibilidad + acciones) se centra en el espacio que queda
            debajo. */}
        <div className="flex flex-col gap-3 p-4 sm:p-6 lg:w-1/2 lg:shrink-0 lg:p-8">
          <div className="flex items-center justify-between gap-3">
            <Link href="/coleccion" className={`text-sm font-medium ${linkClass}`}>
              ← Volver a la colección
            </Link>

            {/* Ir y volver entre cartas sin pasar por la colección completa */}
            <div className="flex items-center gap-3 text-sm font-medium">
              {prevSlug ? (
                <Link href={`/coleccion/${prevSlug}`} className={linkClass}>
                  ‹ Anterior
                </Link>
              ) : (
                <span className={`${linkClass} opacity-30`}>‹ Anterior</span>
              )}
              {nextSlug ? (
                <Link href={`/coleccion/${nextSlug}`} className={linkClass}>
                  Siguiente ›
                </Link>
              ) : (
                <span className={`${linkClass} opacity-30`}>Siguiente ›</span>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
            <div style={{ perspective: 1200 }} className="w-full max-w-sm">
              <button
                type="button"
                onClick={() => setFlipped((value) => !value)}
                aria-label={flipped ? "Ver el frente de la carta" : "Ver el dorso de la carta"}
                className={`relative aspect-[5/7] w-full touch-manipulation overflow-hidden rounded-2xl border-4 shadow-xl ${RARITY_BORDER_CLASS[card.rarity]}`}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{ transformStyle: "preserve-3d" }}
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="absolute inset-0 [backface-visibility:hidden]">
                    {owned && card.image_front_url ? (
                      <Image
                        src={card.image_front_url}
                        alt={card.name}
                        fill
                        priority
                        sizes="(max-width: 1024px) 90vw, 45vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-400">
                        <span className="text-4xl text-white" aria-hidden="true">
                          ?
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    className="absolute inset-0 [backface-visibility:hidden]"
                    style={{ transform: "rotateY(180deg)" }}
                  >
                    {cardBackUrl ? (
                      <Image
                        src={cardBackUrl}
                        alt="Dorso de la carta"
                        fill
                        sizes="(max-width: 1024px) 90vw, 45vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-marca-violeta text-4xl text-white">
                        ?
                      </div>
                    )}
                  </div>
                </motion.div>
              </button>
            </div>

            {owned && (
              <div
                className={`flex w-full max-w-sm flex-col gap-3 rounded-xl border p-4 ${cardBlockClass}`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>
                  Disponible para intercambio{" "}
                  <span className="font-light normal-case tracking-normal opacity-70">
                    - Tienes {quantity} {quantity === 1 ? "copia" : "copias"}
                  </span>
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {quantity > 1 ? (
                    <TradeAvailabilityControl
                      cardId={card.id}
                      quantity={quantity}
                      initialPublicQuantity={publicQuantity}
                      darkPanel={darkPanel}
                    />
                  ) : (
                    <span />
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/imprimir?carta=${card.slug}`}
                      className="rounded-xl bg-marca-violeta px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                    >
                      Imprimir
                    </Link>
                    <Link
                      href={`/intercambios?carta=${card.slug}`}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
                        darkPanel
                          ? "border-white/30 text-white hover:bg-white/10"
                          : "border-marca-noche/20 text-marca-noche hover:bg-marca-noche/5"
                      }`}
                    >
                      Ofrecer en intercambio
                    </Link>
                  </div>
                </div>

                {quantity > 1 && (
                  <p className={`text-xs ${mutedTextClass}`}>
                    Cuántas copias pueden pedirte otros jugadores en un intercambio. Siempre te
                    queda al menos 1 privada.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Datos: abajo con scroll normal en mobile, columna derecha con
            scroll propio (si hace falta) en desktop, sin mover el arte. */}
        <div className="flex flex-1 flex-col gap-4 p-4 pb-10 sm:p-6 lg:w-1/2 lg:overflow-y-auto lg:p-8">
          <h1 className="text-3xl sm:text-4xl">{card.name}</h1>

          <div className="flex flex-wrap items-center gap-2">
            {genre && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${badgeNeutralClass}`}
              >
                {genre.name}
              </span>
            )}
            {trait && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${badgeNeutralClass}`}
              >
                {trait.name}
              </span>
            )}
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${RARITY_BADGE_CLASS[card.rarity]}`}
            >
              {RARITY_LABELS[card.rarity]}
            </span>
          </div>

          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${cardBlockClass}`}>
            <span className="text-3xl" aria-hidden="true">
              ⚡
            </span>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>
                Puntaje
              </p>
              <p className="text-3xl font-bold leading-none">
                {card.score !== null ? card.score.toFixed(1) : "SP"}
              </p>
            </div>
          </div>

          {/* Se muestran las dos habilidades del género (Base y Fandom)
              siempre, a pedido -- is_fandom se sigue guardando por carta
              para cuando exista el motor de juego que lo use. */}
          {trait && (
            <div className={`rounded-xl border p-4 ${cardBlockClass}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>
                Habilidad de Rasgo
              </p>
              <p className="mt-1 font-semibold">{trait.ability_name}</p>
              <p className="mt-1 text-sm leading-snug">
                {capitalizeFirst(trait.ability_text)}
              </p>
            </div>
          )}

          {genre && (
            <div className={`rounded-xl border p-4 ${cardBlockClass}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedTextClass}`}>
                Habilidad de Género
              </p>
              <p className="mt-1">
                <span className="font-semibold">{genre.base_ability_name}</span>{" "}
                <span className="font-light opacity-60">- Base</span>
              </p>
              <p className="mt-1 text-sm leading-snug">
                {capitalizeFirst(genre.base_ability_text)}
              </p>
              <div className={`my-3 h-px ${darkPanel ? "bg-white/15" : "bg-marca-noche/10"}`} />
              <p className="mt-1">
                <span className="font-semibold">{genre.fandom_ability_name}</span>{" "}
                <span className="font-light opacity-60">- Fandom</span>
              </p>
              <p className="mt-1 text-sm leading-snug">
                {capitalizeFirst(genre.fandom_ability_text)}
              </p>
            </div>
          )}

          {(card.description || card.artist) && (
            <div className={`space-y-1 text-sm ${mutedTextClass}`}>
              {card.description && <p>{card.description}</p>}
              {card.artist && <p className="text-xs">Arte: {card.artist}</p>}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
