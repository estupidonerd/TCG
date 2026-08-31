"use client";

import { useState, useTransition } from "react";
import { toCsv } from "@/lib/utils/csv";
import { downloadTextFile, toSafeFilename } from "@/lib/utils/download-file";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { CodeBatchStats } from "@/lib/supabase/types";
import {
  getBatchCodes,
  setCodeActive,
  deleteCode,
  setBatchActive,
  deleteBatch,
  type CodeDetail,
} from "../actions";

export function BatchCard({ batch: initialBatch }: { batch: CodeBatchStats }) {
  const [batch, setBatch] = useState(initialBatch);
  const [expanded, setExpanded] = useState(false);
  const [codes, setCodes] = useState<CodeDetail[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rowPendingId, setRowPendingId] = useState<string | null>(null);
  const [batchActionPending, setBatchActionPending] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingDeleteBatch, setConfirmingDeleteBatch] = useState(false);
  const [gone, setGone] = useState(false);
  const [batchActionMessage, setBatchActionMessage] = useState<string | null>(null);

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

  const handleToggleCode = async (code: CodeDetail) => {
    setRowPendingId(code.id);
    setError(null);
    try {
      await setCodeActive(code.id, !code.is_active);
      setCodes((prev) =>
        (prev ?? []).map((c) => (c.id === code.id ? { ...c, is_active: !c.is_active } : c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setRowPendingId(null);
    }
  };

  const handleDeleteCode = async () => {
    if (!confirmingDeleteId) return;
    const codeId = confirmingDeleteId;
    setConfirmingDeleteId(null);
    setRowPendingId(codeId);
    setError(null);
    try {
      await deleteCode(codeId);
      setCodes((prev) => (prev ?? []).filter((c) => c.id !== codeId));
      setBatch((prev) => ({ ...prev, total_codes: prev.total_codes - 1 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setRowPendingId(null);
    }
  };

  const batchIsActive = batch.active_codes > 0;

  const handleToggleBatch = async () => {
    const nextActive = !batchIsActive;
    setBatchActionPending(true);
    setError(null);
    setBatchActionMessage(null);
    try {
      await setBatchActive(batch.batch_label, nextActive);
      setCodes((prev) => (prev ? prev.map((c) => ({ ...c, is_active: nextActive })) : prev));
      setBatch((prev) => ({
        ...prev,
        active_codes: nextActive ? prev.total_codes : 0,
      }));
      setBatchActionMessage(
        nextActive
          ? `✓ Lote habilitado (${batch.total_codes} códigos).`
          : `✓ Lote inhabilitado (${batch.total_codes} códigos).`,
      );
      setTimeout(() => setBatchActionMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setBatchActionPending(false);
    }
  };

  const handleDeleteBatch = async () => {
    setConfirmingDeleteBatch(false);
    setBatchActionPending(true);
    setError(null);
    setBatchActionMessage(null);
    try {
      const result = await deleteBatch(batch.batch_label);
      if (result.disabledCount === 0) {
        setGone(true);
      } else {
        setBatch((prev) => ({ ...prev, total_codes: result.disabledCount }));
        setCodes(null);
        setExpanded(false);
        setBatchActionMessage(
          `✓ Se borraron ${result.deletedCount} códigos; ${result.disabledCount} ya estaban canjeados y quedaron inhabilitados.`,
        );
        setTimeout(() => setBatchActionMessage(null), 6000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setBatchActionPending(false);
    }
  };

  if (gone) return null;

  const remaining = batch.total_codes - batch.fully_redeemed_codes;

  return (
    <div className="rounded-lg border border-marca-noche/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-marca-noche">{batch.batch_label}</p>
          <p className="text-xs text-marca-noche/60">{batch.pack_type_name}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
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
          <button
            type="button"
            onClick={handleToggleBatch}
            disabled={batchActionPending}
            className={
              batchIsActive
                ? "rounded border border-marca-noche/20 px-3 py-1 text-xs font-semibold text-marca-noche/70 transition-colors hover:border-marca-rojo hover:text-marca-rojo disabled:cursor-not-allowed disabled:opacity-60"
                : "rounded border border-marca-violeta/50 px-3 py-1 text-xs font-semibold text-marca-violeta transition-colors hover:bg-marca-violeta hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {batchIsActive ? "Inhabilitar lote" : "Habilitar lote"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDeleteBatch(true)}
            disabled={batchActionPending}
            className="rounded border border-marca-rojo/50 px-3 py-1 text-xs font-semibold text-marca-rojo transition-colors hover:bg-marca-rojo hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Borrar lote
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
      {batchActionMessage && (
        <p className="mt-2 text-xs font-semibold text-green-600">{batchActionMessage}</p>
      )}

      {expanded && codes && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded border border-marca-noche/10">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-marca-claro">
              <tr className="text-left text-marca-noche/60">
                <th className="px-3 py-1.5 font-semibold">Código</th>
                <th className="px-3 py-1.5 font-semibold">Estado</th>
                <th className="px-3 py-1.5 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const used = code.uses_count >= code.max_uses;
                const partial = code.uses_count > 0 && !used;
                const rowPending = rowPendingId === code.id;
                return (
                  <tr key={code.id} className="border-t border-marca-noche/5">
                    <td className="px-3 py-1.5 font-mono tracking-wider text-marca-noche">
                      {code.code}
                    </td>
                    <td className="px-3 py-1.5">
                      {!code.is_active ? (
                        <span className="font-semibold text-marca-noche/40">Inhabilitado</span>
                      ) : (
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
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCode(code)}
                          disabled={rowPending}
                          className="rounded border border-marca-noche/20 px-2 py-0.5 font-semibold text-marca-noche/70 hover:border-marca-violeta hover:text-marca-violeta disabled:opacity-50"
                        >
                          {code.is_active ? "Inhabilitar" : "Habilitar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(code.id)}
                          disabled={rowPending || code.uses_count > 0}
                          title={
                            code.uses_count > 0
                              ? "Ya fue canjeado: inhabilítalo en vez de borrarlo"
                              : undefined
                          }
                          className="rounded border border-marca-rojo/40 px-2 py-0.5 font-semibold text-marca-rojo hover:bg-marca-rojo hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmingDeleteId && (
        <ConfirmDialog
          message="¿Borrar este código? Esta acción no se puede deshacer."
          confirmLabel="Borrar código"
          destructive
          onConfirm={handleDeleteCode}
          onCancel={() => setConfirmingDeleteId(null)}
        />
      )}

      {confirmingDeleteBatch && (
        <ConfirmDialog
          message={`¿Borrar todo el lote "${batch.batch_label}"? Los códigos ya canjeados no se pueden borrar (se inhabilitan en su lugar); el resto se borra para siempre.`}
          confirmLabel="Borrar lote"
          destructive
          onConfirm={handleDeleteBatch}
          onCancel={() => setConfirmingDeleteBatch(false)}
        />
      )}
    </div>
  );
}
