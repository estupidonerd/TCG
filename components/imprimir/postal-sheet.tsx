"use client";

import { PostalBlock, POSTAL_BLOCK_W_MM, POSTAL_BLOCK_H_MM } from "./postal-block";
import type { PrintCardAsset } from "@/app/imprimir/actions";
import type { CardTemplate } from "@/lib/supabase/types";
import type { PageSize } from "./print-sheet";

const BLOCK_GAP_MM = 6;

// El bloque de postal (frente+dorso lado a lado) es 200x150mm, más ancho
// que alto -- entra en una hoja en orientación horizontal, no vertical. Por
// eso acá SIEMPRE se imprime en horizontal (se invierten ancho/alto del
// tamaño de hoja elegido), sin importar que print-sheet.tsx (la carta
// normal) use esa misma hoja en vertical.
export function PostalSheet({
  cards,
  backUrl,
  cardTemplate,
  pageSize,
}: {
  cards: PrintCardAsset[];
  backUrl: string | null;
  cardTemplate: CardTemplate | null;
  pageSize: PageSize;
}) {
  const landscapePageSize: PageSize = {
    widthMm: Math.max(pageSize.widthMm, pageSize.heightMm),
    heightMm: Math.min(pageSize.widthMm, pageSize.heightMm),
    label: pageSize.label,
  };

  const cols = Math.max(
    Math.floor(landscapePageSize.widthMm / (POSTAL_BLOCK_W_MM + BLOCK_GAP_MM)),
    1,
  );
  const rows = Math.max(
    Math.floor(landscapePageSize.heightMm / (POSTAL_BLOCK_H_MM + BLOCK_GAP_MM)),
    1,
  );
  const perPage = Math.max(cols * rows, 1);

  const pages: PrintCardAsset[][] = [];
  for (let i = 0; i < cards.length; i += perPage) {
    pages.push(cards.slice(i, i + perPage));
  }

  return (
    <>
      <style>{`
        @page {
          size: ${landscapePageSize.widthMm}mm ${landscapePageSize.heightMm}mm;
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
            style={{ width: `${landscapePageSize.widthMm}mm`, height: `${landscapePageSize.heightMm}mm` }}
          >
            <div
              className="flex flex-wrap items-center justify-center"
              style={{ gap: `${BLOCK_GAP_MM}mm` }}
            >
              {pageCards.map((card) => (
                <PostalBlock key={card.id} card={card} backUrl={backUrl} cardTemplate={cardTemplate} label={card.name} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
