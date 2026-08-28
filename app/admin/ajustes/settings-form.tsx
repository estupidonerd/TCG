"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { SubmitButton, ErrorMessage } from "@/components/admin/submit-button";
import { updateGameSettings } from "./actions";

export function SettingsForm({
  initialScreenUrl,
  initialPrintPreviewUrl,
  initialPackImageUrl,
}: {
  initialScreenUrl: string | null;
  initialPrintPreviewUrl: string | null;
  initialPackImageUrl: string | null;
}) {
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
        await updateGameSettings(formData);
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <ErrorMessage message={error} />
      {success && (
        <p className="rounded border border-marca-violeta/40 bg-marca-violeta/10 px-3 py-2 text-sm text-marca-violeta">
          Ajustes actualizados.
        </p>
      )}

      <p className="text-sm text-marca-noche/70">
        El dorso es el mismo para todas las cartas del juego: subir una
        imagen acá la reemplaza para todo el catálogo.
      </p>

      <ImageUploadField
        label="Dorso (pantalla)"
        name="card_back_screen"
        initialPreviewUrl={initialScreenUrl}
      />
      <ImageUploadField
        label="Dorso (impresión, alta res)"
        name="card_back_print"
        initialPreviewUrl={initialPrintPreviewUrl}
        hint="No se muestra a jugadores."
      />

      <p className="text-sm text-marca-noche/70">
        Imagen base del sobre en /canjear: se usa en todos los tipos de
        sobre que no tengan una imagen especial propia (esa se configura en
        cada tipo de sobre, en /admin/packs).
      </p>

      <ImageUploadField
        label="Sobre (imagen base)"
        name="pack_image"
        initialPreviewUrl={initialPackImageUrl}
        hint="Opcional: sin esta imagen, /canjear muestra un sobre genérico."
      />

      <SubmitButton pending={pending}>Guardar ajustes</SubmitButton>
    </form>
  );
}
