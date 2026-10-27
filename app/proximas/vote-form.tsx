"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { VOTE_END_LABEL } from "@/lib/config/vote";
import { fieldInputClass } from "@/components/admin/form-field";
import { ErrorMessage } from "@/components/admin/submit-button";
import type { VoteOption } from "@/lib/supabase/types";

const OTHER_MAX = 500;

const moveButtonClass =
  "flex h-11 w-11 touch-manipulation items-center justify-center rounded-lg border border-marca-noche/20 bg-white text-lg text-marca-noche transition-colors hover:bg-marca-noche/5 disabled:cursor-not-allowed disabled:opacity-30";

// Subir/bajar con botones, no arrastrar: arrastrar es poco fiable en celular.
export function VoteForm({
  options,
  initialOtherText,
  alreadyVoted,
}: {
  options: VoteOption[];
  initialOtherText: string;
  alreadyVoted: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(options);
  const [otherText, setOtherText] = useState(initialOtherText);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState(alreadyVoted);
  // Después de mover una tarjeta se devuelve el foco al mismo botón, que
  // cambió de lugar en el DOM; sin esto el teclado/lector de pantalla
  // pierde la posición.
  const focusAfterMove = useRef<string | null>(null);

  useEffect(() => {
    if (!focusAfterMove.current) return;
    document.querySelector<HTMLButtonElement>(`[data-move="${focusAfterMove.current}"]`)?.focus();
    focusAfterMove.current = null;
  }, [items]);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    focusAfterMove.current = `${next[target].slug}-${direction === -1 ? "up" : "down"}`;
    setItems(next);
    setSaved(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("save_vote_response", {
      p_ranking: items.map((item) => item.slug),
      p_other_text: otherText,
    });
    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSaved(true);
    setVoted(true);
    // Recalcula el estado desde el servidor: el puntico del menú desaparece.
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {voted && (
        <p className="rounded-lg border border-marca-violeta/30 bg-marca-violeta/10 px-3 py-2 text-sm text-marca-noche">
          Ya votaste. Puedes cambiar tu orden hasta el {VOTE_END_LABEL}.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {items.map((item, index) => (
          <li
            key={item.slug}
            className="flex items-center gap-3 rounded-xl border border-marca-noche/10 bg-white p-3 shadow-sm"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marca-violeta text-sm font-bold text-white"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-marca-noche">{item.label}</p>
              <p className="mt-0.5 text-sm text-marca-noche/70">{item.description}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button
                type="button"
                data-move={`${item.slug}-up`}
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Subir ${item.label}`}
                className={moveButtonClass}
              >
                <span aria-hidden="true">↑</span>
              </button>
              <button
                type="button"
                data-move={`${item.slug}-down`}
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={`Bajar ${item.label}`}
                className={moveButtonClass}
              >
                <span aria-hidden="true">↓</span>
              </button>
            </div>
          </li>
        ))}
      </ol>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-marca-noche">Otro</span>
        <textarea
          value={otherText}
          onChange={(event) => {
            setOtherText(event.target.value.slice(0, OTHER_MAX));
            setSaved(false);
          }}
          maxLength={OTHER_MAX}
          rows={3}
          placeholder="¿Alguna otra idea? Cuéntanos"
          className={fieldInputClass}
        />
        <span className="self-end text-xs text-marca-noche/60">
          {otherText.length}/{OTHER_MAX}
        </span>
      </label>

      <ErrorMessage message={error} />

      {saved && (
        <p
          role="status"
          className="rounded-lg border border-marca-violeta/30 bg-marca-violeta/10 px-3 py-2 text-sm font-semibold text-marca-noche"
        >
          Gracias, ya quedó guardado
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="touch-manipulation rounded-xl bg-marca-rojo px-6 py-3 font-bold text-marca-claro transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar mi orden"}
      </button>
    </form>
  );
}
