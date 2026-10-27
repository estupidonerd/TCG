"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fieldInputClass } from "@/components/admin/form-field";
import { ErrorMessage, SubmitButton } from "@/components/admin/submit-button";
import type { VoteOption } from "@/lib/supabase/types";
import { createVoteOption, moveVoteOption, updateVoteOption } from "./actions";

const smallButtonClass =
  "rounded border border-marca-noche/20 bg-white px-2.5 py-1 text-sm text-marca-noche transition-colors hover:bg-marca-noche/5 disabled:cursor-not-allowed disabled:opacity-30";

function OptionRow({
  option,
  isFirst,
  isLast,
}: {
  option: VoteOption;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(option.label);
  const [description, setDescription] = useState(option.description);
  const [isActive, setIsActive] = useState(option.is_active);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    label !== option.label || description !== option.description || isActive !== option.is_active;

  const run = (action: () => Promise<void>) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  const handleSave = () =>
    run(async () => {
      await updateVoteOption(option.id, { label, description, is_active: isActive });
      setSaved(true);
    });

  return (
    <li
      className={`flex flex-col gap-2 rounded-lg border bg-white p-3 ${
        isActive ? "border-marca-noche/10" : "border-marca-noche/10 opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          aria-label="Nombre"
          maxLength={80}
          className={`${fieldInputClass} min-w-0 flex-1 font-semibold`}
        />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={isFirst || pending}
            onClick={() => run(() => moveVoteOption(option.id, "up"))}
            aria-label={`Subir ${option.label}`}
            className={smallButtonClass}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isLast || pending}
            onClick={() => run(() => moveVoteOption(option.id, "down"))}
            aria-label={`Bajar ${option.label}`}
            className={smallButtonClass}
          >
            ↓
          </button>
        </div>
      </div>

      <input
        type="text"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        aria-label="Descripción"
        maxLength={200}
        className={fieldInputClass}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-marca-noche">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 rounded border-marca-noche/30 text-marca-violeta focus:ring-marca-violeta"
          />
          Activa
        </label>
        <div className="flex items-center gap-3">
          {saved && !dirty && <span className="text-xs text-marca-noche/60">Guardado</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || pending}
            className="rounded bg-marca-rojo px-3 py-1.5 text-sm font-semibold text-marca-claro transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
      <ErrorMessage message={error} />
    </li>
  );
}

export function VoteOptionsEditor({ options }: { options: VoteOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    startTransition(async () => {
      try {
        await createVoteOption(formData);
        form.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {options.map((option, index) => (
          <OptionRow
            key={option.id}
            option={option}
            isFirst={index === 0}
            isLast={index === options.length - 1}
          />
        ))}
      </ul>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-2 rounded-lg border border-dashed border-marca-noche/30 p-3"
      >
        <p className="text-sm font-semibold text-marca-noche">Agregar una idea nueva</p>
        <input
          type="text"
          name="label"
          required
          maxLength={80}
          placeholder="Nombre"
          aria-label="Nombre de la idea nueva"
          className={fieldInputClass}
        />
        <input
          type="text"
          name="description"
          maxLength={200}
          placeholder="Descripción (una línea)"
          aria-label="Descripción de la idea nueva"
          className={fieldInputClass}
        />
        <ErrorMessage message={error} />
        <div>
          <SubmitButton pending={pending}>Agregar</SubmitButton>
        </div>
      </form>
    </div>
  );
}
