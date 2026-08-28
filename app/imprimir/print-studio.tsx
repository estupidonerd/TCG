"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { getPrintAssets, type PrintAssets } from "./actions";
import { PrintSheet, PAGE_SIZES } from "@/components/imprimir/print-sheet";
import type { OwnedPrintableCard } from "./page";

type PageSizeKey = keyof typeof PAGE_SIZES;

export function PrintStudio({
  ownedCards,
  initialSelectedSlug,
}: {
  ownedCards: OwnedPrintableCard[];
  initialSelectedSlug: string | null;
}) {
  const initialSelected = useMemo(() => {
    const set = new Set<string>();
    if (initialSelectedSlug) {
      const match = ownedCards.find((c) => c.slug === initialSelectedSlug);
      if (match) set.add(match.id);
    }
    return set;
  }, [ownedCards, initialSelectedSlug]);

  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [pageSize, setPageSize] = useState<PageSizeKey>("a4");
  const [assets, setAssets] = useState<PrintAssets | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAssets(null);
  };

  const selectAll = () => {
    setSelected(new Set(ownedCards.map((c) => c.id)));
    setAssets(null);
  };
  const clearAll = () => {
    setSelected(new Set());
    setAssets(null);
  };

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await getPrintAssets(Array.from(selected));
        if (result.cards.length === 0) {
          setError("No se pudo generar la hoja: revisá tu selección.");
          return;
        }
        setAssets(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  if (ownedCards.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-3xl sm:text-4xl">Imprimir</h1>
        <p className="mt-3 text-marca-noche/70">
          Todavía no tenés cartas en tu colección. Canjeá un código para conseguir tu primer
          sobre.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-3xl sm:text-4xl print:hidden">Imprimir</h1>

      {!assets && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-full border border-marca-noche/20 px-4 py-1.5 text-sm font-semibold hover:bg-marca-noche/5"
            >
              Seleccionar todas
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full border border-marca-noche/20 px-4 py-1.5 text-sm font-semibold hover:bg-marca-noche/5"
            >
              Ninguna
            </button>
            <span className="text-sm text-marca-noche/60">
              {selected.size} {selected.size === 1 ? "seleccionada" : "seleccionadas"}
            </span>

            <label className="ml-auto flex items-center gap-2 text-sm font-semibold">
              Hoja:
              <select
                value={pageSize}
                onChange={(event) => setPageSize(event.target.value as PageSizeKey)}
                className="rounded-lg border border-marca-noche/20 px-2 py-1.5"
              >
                {Object.entries(PAGE_SIZES).map(([key, size]) => (
                  <option key={key} value={key}>
                    {size.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {ownedCards.map((card) => {
              const isSelected = selected.has(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggle(card.id)}
                  aria-pressed={isSelected}
                  className={`relative aspect-[5/7] overflow-hidden rounded-lg border-2 transition-colors ${
                    isSelected ? "border-marca-violeta" : "border-marca-noche/10"
                  }`}
                >
                  {card.image_front_url ? (
                    <Image
                      src={card.image_front_url}
                      alt={card.name}
                      fill
                      sizes="150px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-400 text-white">
                      ?
                    </div>
                  )}
                  {isSelected && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-marca-violeta text-xs font-bold text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {error && <p className="text-sm font-semibold text-marca-rojo">{error}</p>}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={selected.size === 0 || pending}
            className="self-start rounded-xl bg-marca-violeta px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending
              ? "Generando…"
              : `Generar hoja${selected.size > 1 ? "s" : ""} para imprimir`}
          </button>
        </>
      )}

      {assets && (
        <>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <button
              type="button"
              onClick={() => setAssets(null)}
              className="rounded-full border border-marca-noche/20 px-4 py-1.5 text-sm font-semibold hover:bg-marca-noche/5"
            >
              ← Cambiar selección
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-marca-violeta px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Imprimir
            </button>
          </div>

          <p className="text-sm text-marca-noche/70 print:hidden">
            Imprime al 100% de tamaño (sin &quot;ajustar a página&quot;). Recorta cada bloque por
            las marcas de las esquinas, dobla por la línea punteada y pega con barra de
            pegamento.
          </p>

          <PrintSheet cards={assets.cards} backUrl={assets.backUrl} pageSize={PAGE_SIZES[pageSize]} />
        </>
      )}
    </div>
  );
}
