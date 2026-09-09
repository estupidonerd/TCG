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
import { CardPickerField } from "@/components/admin/card-picker-field";
import { CardArtOverlay } from "@/components/cards/card-art-overlay";
import { slugify } from "@/lib/utils/slugify";
import { CHAPTER_INFO_MAX_LENGTH, RARITIES, RARITY_LABELS } from "@/lib/supabase/types";
import type {
  BaseCardOption,
  Card,
  CardSet,
  CardTemplate,
  Genre,
  Rarity,
  Trait,
} from "@/lib/supabase/types";
import { createCard, updateCard } from "./actions";

const PREVIEW_TABS = [
  { key: "carta", label: "Carta" },
  { key: "impresion", label: "Impresión" },
  { key: "postal", label: "Postal" },
] as const;
type PreviewTab = (typeof PREVIEW_TABS)[number]["key"];

export function CardForm({
  initialCard,
  sets,
  genres,
  traits,
  baseCardOptions,
  initialPrintFrontPreviewUrl,
  cardTemplate,
}: {
  initialCard?: Card;
  sets: CardSet[];
  genres: Genre[];
  traits: Trait[];
  baseCardOptions: BaseCardOption[];
  initialPrintFrontPreviewUrl?: string | null;
  cardTemplate: CardTemplate | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState(initialCard?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialCard));
  const [name, setName] = useState(initialCard?.name ?? "");
  const [description, setDescription] = useState(initialCard?.description ?? "");
  const [setId, setSetId] = useState(initialCard?.set_id ?? "");
  const [sortOrder, setSortOrder] = useState(initialCard?.sort_order ?? 0);
  const [releasedAt, setReleasedAt] = useState(initialCard?.released_at?.slice(0, 10) ?? "");
  const [isVariant, setIsVariant] = useState(Boolean(initialCard?.variant_of));
  const [variantOf, setVariantOf] = useState(initialCard?.variant_of ?? "");
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
  const [printFrontPreview, setPrintFrontPreview] = useState<string | null>(
    initialPrintFrontPreviewUrl ?? null,
  );

  const [useCardNameAsDisplay, setUseCardNameAsDisplay] = useState(
    initialCard?.use_card_name_as_display ?? true,
  );
  const [displayLine1, setDisplayLine1] = useState(initialCard?.display_line_1 ?? "");
  const [displayLine2, setDisplayLine2] = useState(initialCard?.display_line_2 ?? "");
  const [displayLine3, setDisplayLine3] = useState(initialCard?.display_line_3 ?? "");
  const [showLine3, setShowLine3] = useState(Boolean(initialCard?.display_line_3));
  const [chapterInfo, setChapterInfo] = useState(initialCard?.chapter_info ?? "");
  const [applyArtTemplate, setApplyArtTemplate] = useState(
    initialCard?.apply_art_template ?? true,
  );
  const [nameShadowIntensity, setNameShadowIntensity] = useState(
    initialCard?.name_shadow_intensity ?? 50,
  );
  const [nameFontSize, setNameFontSize] = useState(initialCard?.name_font_size ?? 10);
  const [nameLineHeight, setNameLineHeight] = useState(initialCard?.name_line_height ?? 110);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("carta");

  const selectedGenre = useMemo(
    () => genres.find((g) => g.id === genreId) ?? null,
    [genres, genreId],
  );
  const selectedTrait = useMemo(
    () => traits.find((t) => t.id === traitId) ?? null,
    [traits, traitId],
  );
  const score = scoreInput.trim() === "" ? null : Number(scoreInput);

  // Prellenar desde la carta base es solo un punto de partida para una
  // carta NUEVA -- si ya se está editando una carta existente, cambiar de
  // qué carta es variante no debería pisarle encima los datos que el admin
  // ya ajustó a mano. A propósito no toca rarity, image_front_url ni
  // print_front_url: eso es justo lo que cambia en la variante.
  const handlePickBaseCard = (id: string) => {
    setVariantOf(id);
    if (initialCard) return;

    const base = baseCardOptions.find((c) => c.id === id);
    if (!base) return;

    setName(base.name);
    setDescription(base.description ?? "");
    setChapterInfo(base.chapter_info ?? "");
    setGenreId(base.genre_id ?? "");
    setTraitId(base.trait_id ?? "");
    setPower(base.power ?? 0);
    setScoreInput(base.score != null ? String(base.score) : "");
    setSetId(base.set_id);
    setSortOrder(base.sort_order);
    setReleasedAt(base.released_at?.slice(0, 10) ?? "");
  };

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

        <fieldset className="flex flex-col gap-3 rounded-lg border border-marca-noche/10 p-4">
          <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
            Variante
          </legend>

          <input type="hidden" name="variant_of" value={isVariant ? variantOf : ""} />

          <CheckboxField
            label="Es variante de otra carta"
            name="is_variant_checkbox"
            checked={isVariant}
            onChange={(checked) => {
              setIsVariant(checked);
              if (!checked) setVariantOf("");
            }}
            hint={
              initialCard
                ? "Cambiar la carta base acá solo actualiza a cuál es variante -- no vuelve a prellenar los demás campos."
                : 'Prellena nombre, descripción, capítulo, género, rasgo, poder, puntaje, expansión, orden y fecha de lanzamiento desde la carta base. Rareza e imágenes quedan en blanco a propósito, y todo lo prellenado se puede editar antes de guardar.'
            }
          />

          {isVariant && (
            <CardPickerField
              cards={baseCardOptions}
              value={variantOf}
              onChange={handlePickBaseCard}
              placeholder="Buscar la carta base por nombre…"
            />
          )}
        </fieldset>

        <FormField label="Expansión">
          <select
            name="set_id"
            required
            value={setId}
            onChange={(event) => setSetId(event.target.value)}
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
            value={description}
            onChange={(event) => setDescription(event.target.value)}
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
          <FormField label="Poder" hint="Entero de 0 a 10.">

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
            hint='De 0 a 10, admite un decimal (ej. 7.8). Esto es lo que ve el jugador. Opcional: vacío muestra "X".'
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

        <fieldset className="flex flex-col gap-3 rounded-lg border border-marca-noche/10 p-4">
          <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
            Plantilla de arte
          </legend>

          <CheckboxField
            label="Aplicar la plantilla de carta (marco, íconos, Poder, Score)"
            name="apply_art_template"
            checked={applyArtTemplate}
            onChange={setApplyArtTemplate}
            hint="Desmárcalo solo para cartas especiales cuyo arte ya trae todo esto integrado."
          />

          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between text-sm font-semibold text-marca-noche">
              Sombra del texto de la carta
              <span className="font-normal text-marca-noche/60">{nameShadowIntensity}</span>
            </span>
            <input
              type="range"
              name="name_shadow_intensity"
              min={0}
              max={100}
              value={nameShadowIntensity}
              onChange={(event) => setNameShadowIntensity(Number(event.target.value))}
              className="w-full accent-marca-violeta"
            />
            <span className="text-xs text-marca-noche/60">
              Por si el arte de fondo no deja leer bien el nombre.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-sm font-semibold text-marca-noche">
                Tamaño del nombre
                <span className="font-normal text-marca-noche/60">{nameFontSize}</span>
              </span>
              <input
                type="range"
                name="name_font_size"
                min={2}
                max={25}
                step={0.5}
                value={nameFontSize}
                onChange={(event) => setNameFontSize(Number(event.target.value))}
                className="w-full accent-marca-violeta"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-sm font-semibold text-marca-noche">
                Interlineado del nombre
                <span className="font-normal text-marca-noche/60">{nameLineHeight}</span>
              </span>
              <input
                type="range"
                name="name_line_height"
                min={50}
                max={200}
                step={5}
                value={nameLineHeight}
                onChange={(event) => setNameLineHeight(Number(event.target.value))}
                className="w-full accent-marca-violeta"
              />
            </label>
          </div>
          <p className="text-xs text-marca-noche/60">
            Ajústalos si el nombre de esta carta en particular queda muy grande, muy chico o muy
            apretado dentro de la zona del nombre que definiste en /admin/ajustes.
          </p>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-marca-noche/10 p-4">
          <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
            Texto del arte
          </legend>

          <CheckboxField
            label="Usar el nombre de la carta como texto del arte"
            name="use_card_name_as_display"
            checked={useCardNameAsDisplay}
            onChange={(checked) => {
              setUseCardNameAsDisplay(checked);
              if (!checked && !displayLine1 && !displayLine2 && !displayLine3) {
                setDisplayLine1(name);
              }
            }}
          />

          {!useCardNameAsDisplay && (
            <div className="flex flex-col gap-3">
              <FormField label="Línea 1">
                <input
                  type="text"
                  name="display_line_1"
                  value={displayLine1}
                  onChange={(event) => setDisplayLine1(event.target.value)}
                  className={fieldInputClass}
                />
              </FormField>
              <FormField label="Línea 2">
                <input
                  type="text"
                  name="display_line_2"
                  value={displayLine2}
                  onChange={(event) => setDisplayLine2(event.target.value)}
                  className={fieldInputClass}
                />
              </FormField>
              {showLine3 ? (
                <FormField label="Línea 3">
                  <input
                    type="text"
                    name="display_line_3"
                    value={displayLine3}
                    onChange={(event) => setDisplayLine3(event.target.value)}
                    className={fieldInputClass}
                  />
                </FormField>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLine3(true)}
                  className="self-start text-sm font-semibold text-marca-violeta hover:underline"
                >
                  + Agregar línea 3 (poco común)
                </button>
              )}
            </div>
          )}

          <FormField label="Texto de capítulo">
            <textarea
              name="chapter_info"
              rows={2}
              maxLength={CHAPTER_INFO_MAX_LENGTH}
              value={chapterInfo}
              onChange={(event) => setChapterInfo(event.target.value)}
              className={fieldInputClass}
            />
            <span className="self-end text-xs text-marca-noche/50">
              {chapterInfo.length}/{CHAPTER_INFO_MAX_LENGTH}
            </span>
          </FormField>
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Fecha de lanzamiento">
            <input
              type="date"
              name="released_at"
              value={releasedAt}
              onChange={(event) => setReleasedAt(event.target.value)}
              className={fieldInputClass}
            />
          </FormField>

          <FormField label="Orden" hint="Para ordenar dentro de la expansión.">
            <input
              type="number"
              name="sort_order"
              value={sortOrder}
              onChange={(event) => setSortOrder(Number(event.target.value))}
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
              onFileChange={(file) => {
                if (file) setPrintFrontPreview(URL.createObjectURL(file));
              }}
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
        <div className="flex gap-2">
          {PREVIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setPreviewTab(tab.key)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                previewTab === tab.key
                  ? "border-marca-violeta bg-marca-violeta text-white"
                  : "border-marca-noche/20 hover:bg-marca-noche/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-marca-noche/60">
          {previewTab === "carta" && "Cómo se ve la carta en toda la colección del juego."}
          {previewTab === "impresion" && "Cómo sale la carta en la hoja de impresión normal."}
          {previewTab === "postal" && "Cómo sale la carta en la hoja de postal."}
        </p>

        <div className="relative aspect-[5/7] w-full overflow-hidden rounded-xl border-2 border-marca-noche/10 bg-marca-noche/5 shadow-sm">
          {(previewTab === "carta" ? frontPreview : printFrontPreview ?? frontPreview) ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview de un archivo local (object URL) o remoto, sin necesidad de optimización
            <img
              src={(previewTab === "carta" ? frontPreview : printFrontPreview ?? frontPreview) ?? undefined}
              alt={name || "Carta"}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-marca-noche/40">
              Sin imagen
            </div>
          )}
          <CardArtOverlay
            variant={previewTab === "carta" ? "coleccion" : previewTab}
            template={cardTemplate}
            applyArtTemplate={applyArtTemplate}
            name={name}
            useCardNameAsDisplay={useCardNameAsDisplay}
            displayLine1={displayLine1}
            displayLine2={displayLine2}
            displayLine3={displayLine3}
            nameShadowIntensity={nameShadowIntensity}
            nameFontSize={nameFontSize}
            nameLineHeight={nameLineHeight}
            power={power}
            score={score}
            genre={selectedGenre}
            trait={selectedTrait}
            chapterInfo={chapterInfo}
            artist={artist}
          />
        </div>
      </div>
    </div>
  );
}
