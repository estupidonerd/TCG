"use client";

import { PrintBlock } from "./print-block";
import type { PrintCardAsset } from "@/app/imprimir/actions";

const CARD_W_MM = 63;
const CARD_H_MM = 88;
const BLOCK_GAP_MM = 6;

export type PageSize = { widthMm: number; heightMm: number; label: string };

export const PAGE_SIZES: Record<"a4" | "letter", PageSize> = {
  a4: { widthMm: 210, heightMm: 297, label: "A4" },
  letter: { widthMm: 215.9, heightMm: 279.4, label: "Carta (Letter)" },
};

export function PrintSheet({
  cards,
  backUrl,
  pageSize,
}: {
  cards: PrintCardAsset[];
  backUrl: string | null;
  pageSize: PageSize;
}) {
  const cols = Math.max(Math.floor(pageSize.widthMm / (CARD_W_MM + BLOCK_GAP_MM)), 1);
  const rows = Math.max(Math.floor(pageSize.heightMm / (CARD_H_MM * 2)), 1);
  const perPage = Math.max(cols * rows, 1);

  const pages: PrintCardAsset[][] = [];
  for (let i = 0; i < cards.length; i += perPage) {
    pages.push(cards.slice(i, i + perPage));
  }

  return (
    <>
      {/* @page es una regla de nivel documento -- no se puede fijar por
          inline style de un elemento, por eso va en un <style> propio,
          recalculado según el tamaño de hoja elegido. */}
      <style>{`
        @page {
          size: ${pageSize.widthMm}mm ${pageSize.heightMm}mm;
          margin: 0;
        }
        .print-sheet-page, .print-sheet-page * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          .print-sheet-page {
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          .print-sheet-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      <div className="flex flex-col items-center gap-6 rounded-xl bg-gray-300 p-6 print:gap-0 print:rounded-none print:bg-white print:p-0">
        {pages.map((pageCards, pageIndex) => (
          <div
            key={pageIndex}
            className="print-sheet-page flex items-center justify-center bg-white shadow-lg"
            style={{ width: `${pageSize.widthMm}mm`, height: `${pageSize.heightMm}mm` }}
          >
            <div
              className="flex flex-wrap items-center justify-center"
              style={{ gap: `${BLOCK_GAP_MM}mm` }}
            >
              {pageCards.map((card) => (
                <PrintBlock
                  key={card.id}
                  frontUrl={card.frontUrl}
                  backUrl={backUrl}
                  label={card.name}
                  lowRes={!card.isHighRes}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
