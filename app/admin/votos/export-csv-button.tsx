"use client";

import { toCsv } from "@/lib/utils/csv";
import { downloadTextFile } from "@/lib/utils/download-file";

// Evita que una celda que empieza con = + - @ se interprete como fórmula
// al abrir el CSV en una hoja de cálculo (el texto "Otro" lo escribe el
// jugador).
function safeCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function ExportCsvButton({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  const handleClick = () => {
    const csv = toCsv(
      headers,
      rows.map((row) => row.map(safeCell)),
    );
    // BOM al inicio para que Excel respete las tildes.
    downloadTextFile("votos-proximas-actualizaciones.csv", `﻿${csv}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={rows.length === 0}
      className="rounded border border-marca-noche/20 bg-white px-4 py-2 text-sm font-semibold text-marca-noche transition-colors hover:bg-marca-noche/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Exportar CSV
    </button>
  );
}
