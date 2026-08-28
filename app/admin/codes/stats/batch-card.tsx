"use client";

import { useState, useTransition } from "react";
import { toCsv } from "@/lib/utils/csv";
import { downloadTextFile, toSafeFilename } from "@/lib/utils/download-file";
import type { CodeBatchStats } from "@/lib/supabase/types";
import { getBatchCodes, type CodeDetail } from "../actions";

export function BatchCard({ batch }: { batch: CodeBatchStats }) {
  const [expanded, setExpanded] = useState(false);
  const [codes, setCodes] = useState<CodeDetail[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadCodes = () => {
    if (codes) return codes;
    return new Promise<CodeDetail[]>((resolve, reject) => {
      startTransition(async () => {
        try {
          const rows = await getBatchCodes(batch.batch_label);
          setCodes(rows);
          resolve(rows);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Error inesperado.";
          setError(message);
          reject(err);
        }
      });
    });
  };

  const toggleExpanded = async () => {
    setError(null);
    if (!expanded && !codes) {
      try {
        await loadCodes();
      } catch {
        return;
      }
    }
    setExpanded((value) => !value);
  };

  const handleDownload = async () => {
    setError(null);
    try {
      const rows = codes ?? (await loadCodes());
      const csv = toCsv(
        ["code", "usos_consumidos", "usos_maximos"],
        rows.map((row) => [row.code, row.uses_count, row.max_uses]),
      );
      downloadTextFile(`${toSafeFilename(batch.batch_label)}.csv`, csv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
  };

  const remaining = batch.total_codes - batch.fully_redeemed_codes;

  return (
    <div className="rounded-lg border border-marca-noche/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-marca-noche">{batch.batch_label}</p>
          <p className="text-xs text-marca-noche/60">{batch.pack_type_name}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={toggleExpanded}
            disabled={pending}
            className="rounded border border-marca-noche/20 px-3 py-1 text-xs font-semibold text-marca-noche transition-colors hover:border-marca-violeta hover:text-marca-violeta disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending && !expanded
              ? "Cargando…"
              : expanded
                ? "Ocultar códigos"
                : "Ver códigos"}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={pending}
            className="rounded border border-marca-violeta px-3 py-1 text-xs font-semibold text-marca-violeta transition-colors hover:bg-marca-violeta hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Descargar CSV
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-marca-noche/70">
        <span>{batch.total_codes} códigos</span>
        <span>{batch.fully_redeemed_codes} canjeados</span>
        <span>{remaining} disponibles</span>
        <span>
          {batch.total_uses_count} / {batch.total_max_uses} usos
        </span>
        <span>
          Vence:{" "}
          {batch.expires_at
            ? new Date(batch.expires_at).toLocaleDateString("es-AR")
            : "—"}
        </span>
      </div>

      {error && <p className="mt-2 text-xs text-marca-rojo">{error}</p>}

      {expanded && codes && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded border border-marca-noche/10">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-marca-claro">
              <tr className="text-left text-marca-noche/60">
                <th className="px-3 py-1.5 font-semibold">Código</th>
                <th className="px-3 py-1.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const used = code.uses_count >= code.max_uses;
                const partial = code.uses_count > 0 && !used;
                return (
                  <tr key={code.code} className="border-t border-marca-noche/5">
                    <td className="px-3 py-1.5 font-mono tracking-wider text-marca-noche">
                      {code.code}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={
                          used
                            ? "font-semibold text-marca-rojo"
                            : partial
                              ? "font-semibold text-amber-600"
                              : "font-semibold text-marca-violeta"
                        }
                      >
                        {used
                          ? "Usado"
                          : partial
                            ? `Parcial (${code.uses_count}/${code.max_uses})`
                            : "Disponible"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
