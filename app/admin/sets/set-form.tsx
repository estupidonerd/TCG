"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FormField,
  fieldInputClass,
  CheckboxField,
} from "@/components/admin/form-field";
import { SubmitButton, ErrorMessage } from "@/components/admin/submit-button";
import { slugify } from "@/lib/utils/slugify";
import type { CardSet } from "@/lib/supabase/types";
import { createSet, updateSet } from "./actions";

export function SetForm({ initialSet }: { initialSet?: CardSet }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState(initialSet?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialSet));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        if (initialSet) {
          await updateSet(initialSet.id, formData);
        } else {
          await createSet(formData);
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
          defaultValue={initialSet?.name}
          className={fieldInputClass}
          onChange={(event) => {
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
        />
      </FormField>

      <FormField
        label="Slug"
        hint="Se usa en URLs. Se autogenera del nombre si no lo tocás."
      >
        <input
          type="text"
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="Descripción">
        <textarea
          name="description"
          rows={3}
          defaultValue={initialSet?.description ?? ""}
          className={fieldInputClass}
        />
      </FormField>

      <FormField label="Fecha de lanzamiento">
        <input
          type="date"
          name="released_at"
          defaultValue={initialSet?.released_at?.slice(0, 10)}
          className={fieldInputClass}
        />
      </FormField>

      <CheckboxField
        label="Activa"
        name="is_active"
        defaultChecked={initialSet?.is_active ?? true}
      />

      <div className="flex items-center gap-4">
        <SubmitButton pending={pending}>
          {initialSet ? "Guardar cambios" : "Crear expansión"}
        </SubmitButton>
        <button
          type="button"
          onClick={() => router.push("/admin/sets")}
          className="text-sm text-marca-noche/60 hover:underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
