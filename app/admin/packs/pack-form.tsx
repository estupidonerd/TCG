"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField, fieldInputClass } from "@/components/admin/form-field";
import { SubmitButton, ErrorMessage } from "@/components/admin/submit-button";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { RARITIES, RARITY_LABELS } from "@/lib/supabase/types";
import type { CardSet, PackType } from "@/lib/supabase/types";
import { createPackType, updatePackType } from "./actions";

export function PackForm({
  initialPack,
  sets,
}: {
  initialPack?: PackType;
  sets: CardSet[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        if (initialPack) {
          await updatePackType(initialPack.id, formData);
        } else {
          await createPackType(formData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <ErrorMessage message={error} />

      <FormField label="Nombre">
        <input
          type="text"
          name="name"
          required
          defaultValue={initialPack?.name}
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="Cantidad de cartas por sobre">
        <input
          type="number"
          name="cards_count"
          required
          min={1}
          defaultValue={initialPack?.cards_count ?? 5}
          className={fieldInputClass}
        />
      </FormField>

      <ImageUploadField
        label="Imagen especial del sobre"
        name="image"
        initialPreviewUrl={initialPack?.image_url ?? null}
        hint="Opcional: si no subís nada, /canjear usa la imagen base de /admin/ajustes."
      />

      <fieldset className="flex flex-col gap-3 rounded-lg border border-marca-noche/10 p-4">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
          Pesos por rareza
        </legend>
        <div className="grid grid-cols-2 gap-4">
          {RARITIES.map((r) => (
            <FormField key={r} label={RARITY_LABELS[r]}>
              <input
                type="number"
                name={`weight_${r}`}
                min={0}
                step="any"
                defaultValue={initialPack?.rarity_weights?.[r] ?? 0}
                className={fieldInputClass}
              />
            </FormField>
          ))}
        </div>
        <p className="text-xs text-marca-noche/60">
          No hace falta que sumen 100: son pesos relativos entre sí.
        </p>
      </fieldset>

      <FormField
        label="Rareza garantizada"
        hint="Opcional: asegura al menos una carta de esta rareza por sobre."
      >
        <select
          name="guaranteed_rarity"
          defaultValue={initialPack?.guaranteed_rarity ?? ""}
          className={fieldInputClass}
        >
          <option value="">Sin garantía</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {RARITY_LABELS[r]}
            </option>
          ))}
        </select>
      </FormField>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-marca-noche/10 p-4">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
          Expansiones permitidas
        </legend>
        {sets.map((set) => (
          <label
            key={set.id}
            className="flex items-center gap-2 text-sm text-marca-noche"
          >
            <input
              type="checkbox"
              name="allowed_set_ids"
              value={set.id}
              defaultChecked={
                initialPack?.allowed_set_ids?.includes(set.id) ?? false
              }
              className="h-4 w-4 rounded border-marca-noche/30 text-marca-violeta focus:ring-marca-violeta"
            />
            {set.name}
          </label>
        ))}
        {sets.length === 0 && (
          <p className="text-xs text-marca-noche/50">
            Creá una expansión primero.
          </p>
        )}
      </fieldset>

      <div className="flex items-center gap-4">
        <SubmitButton pending={pending}>
          {initialPack ? "Guardar cambios" : "Crear sobre"}
        </SubmitButton>
        <button
          type="button"
          onClick={() => router.push("/admin/packs")}
          className="text-sm text-marca-noche/60 hover:underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
