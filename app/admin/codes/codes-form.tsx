"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  FormField,
  fieldInputClass,
  CheckboxField,
} from "@/components/admin/form-field";
import { SubmitButton, ErrorMessage } from "@/components/admin/submit-button";
import { toCsv } from "@/lib/utils/csv";
import { downloadTextFile, toSafeFilename } from "@/lib/utils/download-file";
import type { PackType } from "@/lib/supabase/types";
import { generateCodeBatch, type GenerateCodesResult } from "./actions";

export function CodesForm({ packTypes }: { packTypes: PackType[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateCodesResult | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const generated = await generateCodeBatch(formData);
        setResult(generated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  const handleDownload = () => {
    if (!result) return;
    const csv = toCsv(
      ["code", "lote", "tipo_de_sobre", "usos_maximos", "uno_por_usuario", "vence"],
      result.codes.map((code) => [
        code,
        result.batchLabel,
        result.packTypeName,
        result.maxUses,
        result.onePerUser ? "si" : "no",
        result.expiresAt ?? "",
      ]),
    );
    downloadTextFile(`${toSafeFilename(result.batchLabel)}.csv`, csv);
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
        <ErrorMessage message={error} />

        <FormField label="Tipo de sobre">
          <select name="pack_type_id" required defaultValue="" className={fieldInputClass}>
            <option value="" disabled>
              Elige un tipo de sobre
            </option>
            {packTypes.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Cantidad de códigos a generar">
          <input
            type="number"
            name="quantity"
            required
            min={1}
            max={2000}
            defaultValue={10}
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="Usos máximos por código">
          <input
            type="number"
            name="max_uses"
            required
            min={1}
            defaultValue={1}
            className={fieldInputClass}
          />
        </FormField>

        <CheckboxField
          label="Uno por usuario (además del límite de usos totales)"
          name="one_per_user"
        />

        <FormField
          label="Etiqueta del lote"
          hint="Opcional: si la dejas vacía, se genera una automática."
        >
          <input type="text" name="batch_label" className={fieldInputClass} />
        </FormField>

        <FormField label="Fecha de vencimiento" hint="Opcional.">
          <input type="date" name="expires_at" className={fieldInputClass} />
        </FormField>

        <SubmitButton pending={pending} pendingLabel="Generando…">
          Generar códigos
        </SubmitButton>
      </form>

      {result && (
        <div className="flex max-w-lg flex-col gap-3 rounded-lg border border-marca-noche/10 bg-white p-4">
          <p className="text-sm text-marca-noche">
            Se generaron <strong>{result.codes.length}</strong> códigos en el
            lote <strong>{result.batchLabel}</strong>.
          </p>
          <button
            type="button"
            onClick={handleDownload}
            className="w-fit rounded bg-marca-rojo px-4 py-2 text-sm font-semibold text-marca-claro"
          >
            Descargar CSV
          </button>
          <details className="text-xs text-marca-noche/60">
            <summary className="cursor-pointer">Ver códigos</summary>
            <ul className="mt-2 grid grid-cols-2 gap-1 font-mono sm:grid-cols-3">
              {result.codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
