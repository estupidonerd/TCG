"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FormField,
  fieldInputClass,
  CheckboxField,
} from "@/components/admin/form-field";
import { SubmitButton, ErrorMessage } from "@/components/admin/submit-button";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { CardPreview } from "@/components/cards/card-preview";
import { slugify } from "@/lib/utils/slugify";
import { RARITIES, RARITY_LABELS } from "@/lib/supabase/types";
import type { Card, CardSet, Genre, Rarity, Trait } from "@/lib/supabase/types";
import { createCard, updateCard } from "./actions";

export function CardForm({
  initialCard,
  sets,
  genres,
  traits,
  initialPrintFrontPreviewUrl,
}: {
  initialCard?: Card;
  sets: CardSet[];
  genres: Genre[];
  traits: Trait[];
  initialPrintFrontPreviewUrl?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState(initialCard?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialCard));
  const [name, setName] = useState(initialCard?.name ?? "");
  const [rarity, setRarity] = useState<Rarity>(initialCard?.rarity ?? "comun");
  const [genreId, setGenreId] = useState(initialCard?.genre_id ?? "");
  const [traitId, setTraitId] = useState(initialCard?.trait_id ?? "");
  const [power, setPower] = useState(initialCard?.power ?? 0);
  const [scoreInput, setScoreInput] = useState(
    initialCard?.score != null ? String(initialCard.score) : "",
  );
  const [isFandom, setIsFandom] = useState(initialCard?.is_fandom ?? false);
  const [artist, setArtist] = useState(initialCard?.artist ?? "");
  const [frontPreview, setFrontPreview] = useState<string | null>(
    initialCard?.image_front_url ?? null,
  );

  const selectedGenre = useMemo(
    () => genres.find((g) => g.id === genreId) ?? null,
    [genres, genreId],
  );
  const selectedTrait = useMemo(
    () => traits.find((t) => t.id === traitId) ?? null,
    [traits, traitId],
  );
  const score = scoreInput.trim() === "" ? null : Number(scoreInput);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        if (initialCard) {
          await updateCard(initialCard.id, formData);
        } else {
          await createCard(formData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ErrorMessage message={error} />

        <FormField label="Expansión">
          <select
            name="set_id"
            required
            defaultValue={initialCard?.set_id ?? ""}
            className={fieldInputClass}
          >
            <option value="" disabled>
              Elige una expansión
            </option>
            {sets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Nombre">
          <input
            type="text"
            name="name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="Slug" hint="Único en todo el catálogo.">
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

        <FormField label="Descripción / lore">
          <textarea
            name="description"
            rows={2}
            defaultValue={initialCard?.description ?? ""}
            className={fieldInputClass}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Rareza">
            <select
              name="rarity"
              value={rarity}
              onChange={(event) => setRarity(event.target.value as Rarity)}
              className={fieldInputClass}
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {RARITY_LABELS[r]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Artista">
            <input
              type="text"
              name="artist"
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              className={fieldInputClass}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Género">
            <select
              name="genre_id"
              required
              value={genreId}
              onChange={(event) => setGenreId(event.target.value)}
              className={fieldInputClass}
            >
              <option value="" disabled>
                Elige un Género
              </option>
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Rasgo">
            <select
              name="trait_id"
              required
              value={traitId}
              onChange={(event) => setTraitId(event.target.value)}
              className={fieldInputClass}
            >
              <option value="" disabled>
                Elige un Rasgo
              </option>
              {traits.map((trait) => (
                <option key={trait.id} value={trait.id}>
                  {trait.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Poder"
            hint="Entero de 0 a 10. Oculto para el jugador (interno del motor de juego)."
          >
            <input
              type="number"
              name="power"
              required
              min={0}
              max={10}
              value={power}
              onChange={(event) => setPower(Number(event.target.value))}
              className={fieldInputClass}
            />
          </FormField>

          <FormField
            label="Puntaje"
            hint='De 0 a 10, admite un decimal (ej. 7.8). Esto es lo que ve el jugador. Opcional: vacío muestra "SP".'
          >
            <input
              type="number"
              name="score"
              min={0}
              max={10}
              step={0.1}
              value={scoreInput}
              onChange={(event) => setScoreInput(event.target.value)}
              className={fieldInputClass}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Fecha de lanzamiento">
            <input
              type="date"
              name="released_at"
              defaultValue={initialCard?.released_at?.slice(0, 10)}
              className={fieldInputClass}
            />
          </FormField>

          <FormField label="Orden" hint="Para ordenar dentro de la expansión.">
            <input
              type="number"
              name="sort_order"
              defaultValue={initialCard?.sort_order ?? 0}
              className={fieldInputClass}
            />
          </FormField>
        </div>

        <div className="flex flex-wrap gap-6">
          <CheckboxField
            label="Activa"
            name="is_active"
            defaultChecked={initialCard?.is_active ?? true}
          />
          <CheckboxField
            label="Versión Fandom"
            name="is_fandom"
            checked={isFandom}
            onChange={setIsFandom}
            hint="Si no está marcado, el jugador ve la habilidad Base del género."
          />
        </div>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-marca-noche/10 p-4">
          <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
            Imágenes
          </legend>
          <p className="text-xs text-marca-noche/60">
            El dorso es único para todo el juego, se configura en{" "}
            <span className="font-semibold">/admin/ajustes</span>.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageUploadField
              label="Frente (pantalla)"
              name="image_front"
              initialPreviewUrl={initialCard?.image_front_url ?? null}
              onFileChange={(file) => {
                if (file) setFrontPreview(URL.createObjectURL(file));
              }}
            />
            <ImageUploadField
              label="Frente (impresión, alta res)"
              name="print_front"
              initialPreviewUrl={initialPrintFrontPreviewUrl ?? null}
              hint="No se muestra a jugadores."
            />
          </div>
        </fieldset>

        <div className="flex items-center gap-4">
          <SubmitButton pending={pending}>
            {initialCard ? "Guardar cambios" : "Crear carta"}
          </SubmitButton>
          <button
            type="button"
            onClick={() => router.push("/admin/cards")}
            className="text-sm text-marca-noche/60 hover:underline"
          >
            Cancelar
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-2 lg:sticky lg:top-6 lg:self-start">
        <span className="text-sm font-bold uppercase tracking-wide text-marca-noche/60">
          Así la va a ver el jugador
        </span>
        <CardPreview
          imageUrl={frontPreview}
          name={name}
          rarity={rarity}
          score={score}
          genre={selectedGenre}
          trait={selectedTrait}
          artist={artist}
        />
      </div>
    </div>
  );
}
