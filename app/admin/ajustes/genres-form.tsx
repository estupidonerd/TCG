"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { ColorField } from "@/components/admin/color-field";
import { SubmitButton, ErrorMessage } from "@/components/admin/submit-button";
import type { Genre } from "@/lib/supabase/types";
import { updateGenres } from "./actions";

export function GenresForm({ genres }: { genres: Genre[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await updateGenres(formData);
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl">Géneros</h2>
      <ErrorMessage message={error} />
      {success && (
        <p className="rounded border border-marca-violeta/40 bg-marca-violeta/10 px-3 py-2 text-sm text-marca-violeta">
          Géneros actualizados.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {genres.map((genre) => (
          <div
            key={genre.id}
            className="flex flex-col gap-3 rounded-lg border border-marca-noche/10 p-4"
          >
            <span className="text-sm font-bold uppercase tracking-wide text-marca-noche/70">
              {genre.name}
            </span>
            <ImageUploadField
              label="Ícono"
              name={`icon_${genre.id}`}
              initialPreviewUrl={genre.icon_url}
              hint="PNG con transparencia recomendado."
            />
            <ColorField label="Color" name={`color_${genre.id}`} defaultValue={genre.color_hex} />
          </div>
        ))}
      </div>

      <SubmitButton pending={pending}>Guardar géneros</SubmitButton>
    </form>
  );
}
