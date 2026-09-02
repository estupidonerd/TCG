"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { SubmitButton, ErrorMessage } from "@/components/admin/submit-button";
import { CardArtOverlay } from "@/components/cards/card-art-overlay";
import type { CardTemplate, CardTemplateOffset, Genre, Trait } from "@/lib/supabase/types";
import { updateCardTemplate } from "./actions";

export type TemplateSampleCard = {
  id: string;
  name: string;
  image_front_url: string | null;
  power: number | null;
  score: number | null;
  use_card_name_as_display: boolean;
  display_line_1: string | null;
  display_line_2: string | null;
  display_line_3: string | null;
  chapter_info: string | null;
  artist: string | null;
  genre: Pick<Genre, "color_hex" | "icon_url"> | null;
  trait: Pick<Trait, "color_hex" | "icon_url"> | null;
  apply_art_template: boolean;
  name_shadow_intensity: number;
  name_font_size: number;
  name_line_height: number;
};

function SliderField({
  label,
  name,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-sm font-semibold text-marca-noche">
        {label}
        <span className="font-normal text-marca-noche/60">{value}</span>
      </span>
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-marca-violeta"
      />
    </label>
  );
}

// Grupo repetido para los 4 elementos con offset propio (ícono de género,
// ícono de rasgo, Poder, Puntaje): un tamaño compartido (se pasa por
// separado, no acá) más su propio offset X/Y.
function OffsetFields({
  label,
  namePrefix,
  value,
  onChange,
}: {
  label: string;
  namePrefix: string;
  value: CardTemplateOffset;
  onChange: (value: CardTemplateOffset) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-marca-noche/50">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-3">
        <SliderField
          label="Offset X"
          name={`${namePrefix}_offset_x`}
          min={-20}
          max={20}
          step={0.5}
          value={value.offset_x}
          onChange={(v) => onChange({ ...value, offset_x: v })}
        />
        <SliderField
          label="Offset Y"
          name={`${namePrefix}_offset_y`}
          min={-20}
          max={20}
          step={0.5}
          value={value.offset_y}
          onChange={(v) => onChange({ ...value, offset_y: v })}
        />
      </div>
    </div>
  );
}

export function CardTemplateForm({
  initialTemplate,
  initialFontUrl,
  sampleCards,
}: {
  initialTemplate: CardTemplate;
  initialFontUrl: string | null;
  sampleCards: TemplateSampleCard[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [template, setTemplate] = useState<CardTemplate>(initialTemplate);
  const [marcoPreviewUrl, setMarcoPreviewUrl] = useState(initialTemplate.marco_url);
  const [fontFileName, setFontFileName] = useState<string | null>(null);
  const [sampleId, setSampleId] = useState(sampleCards[0]?.id ?? "");

  const sample = useMemo(
    () => sampleCards.find((card) => card.id === sampleId) ?? sampleCards[0] ?? null,
    [sampleCards, sampleId],
  );

  const update = <K extends keyof CardTemplate>(key: K, value: CardTemplate[K]) =>
    setTemplate((prev) => ({ ...prev, [key]: value }));

  const updateZona = <K extends keyof CardTemplate["zona_nombre"]>(
    key: K,
    value: CardTemplate["zona_nombre"][K],
  ) => setTemplate((prev) => ({ ...prev, zona_nombre: { ...prev.zona_nombre, [key]: value } }));

  const updateCredito = <K extends keyof CardTemplate["credito"]>(
    key: K,
    value: CardTemplate["credito"][K],
  ) => setTemplate((prev) => ({ ...prev, credito: { ...prev.credito, [key]: value } }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await updateCardTemplate(formData);
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  if (!sample) {
    return (
      <p className="text-sm text-marca-noche/60">
        Necesitas al menos una carta activa con imagen para poder ajustar la plantilla con vista
        previa en vivo.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-xl">Plantilla de carta</h2>
      <ErrorMessage message={error} />
      {success && (
        <p className="rounded border border-marca-violeta/40 bg-marca-violeta/10 px-3 py-2 text-sm text-marca-violeta">
          Plantilla actualizada.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <ImageUploadField
            label="Marco"
            name="marco"
            initialPreviewUrl={marcoPreviewUrl}
            hint="PNG con transparencia recomendado, cubre toda la carta."
            onFileChange={(file) => {
              if (file) setMarcoPreviewUrl(URL.createObjectURL(file));
            }}
          />

          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-marca-noche">Fuente del nombre</span>
            <input
              type="file"
              name="card_name_font"
              accept=".woff2,.woff,.ttf,.otf"
              onChange={(event) => setFontFileName(event.target.files?.[0]?.name ?? null)}
              className="text-sm text-marca-noche file:mr-2 file:rounded file:border-0 file:bg-marca-violeta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
            <span className="text-xs text-marca-noche/60">
              {fontFileName
                ? `Nueva fuente: ${fontFileName}`
                : initialFontUrl
                  ? "Ya hay una fuente cargada. Subir otra la reemplaza."
                  : "Sin fuente propia todavía: se usa Titillium Web."}
            </span>
          </label>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-marca-noche/10 p-4">
            <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
              Zona del nombre
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <SliderField label="X" name="zona_nombre_x" min={0} max={100} step={1} value={template.zona_nombre.x} onChange={(v) => updateZona("x", v)} />
              <SliderField label="Y" name="zona_nombre_y" min={0} max={100} step={1} value={template.zona_nombre.y} onChange={(v) => updateZona("y", v)} />
              <SliderField label="Ancho" name="zona_nombre_ancho" min={0} max={100} step={1} value={template.zona_nombre.ancho} onChange={(v) => updateZona("ancho", v)} />
              <SliderField label="Alto" name="zona_nombre_alto" min={0} max={100} step={1} value={template.zona_nombre.alto} onChange={(v) => updateZona("alto", v)} />
              <SliderField label="Ángulo" name="zona_nombre_angulo" min={-180} max={180} step={1} value={template.zona_nombre.angulo} onChange={(v) => updateZona("angulo", v)} />
            </div>
            <p className="text-xs text-marca-noche/60">
              El tamaño y el interlineado del nombre se ajustan por carta, en /admin/cards -- acá
              solo se define dónde va la zona y con qué rotación.
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-lg border border-marca-noche/10 p-4">
            <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
              Íconos de Género y Rasgo
            </legend>
            <SliderField label="Tamaño (compartido)" name="tamano_iconos" min={1} max={40} step={0.5} value={template["tamaño_iconos"]} onChange={(v) => update("tamaño_iconos", v)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <OffsetFields
                label="Género (ancla arriba-izquierda)"
                namePrefix="icono_genero"
                value={template.icono_genero}
                onChange={(v) => update("icono_genero", v)}
              />
              <OffsetFields
                label="Rasgo (ancla abajo-derecha)"
                namePrefix="icono_rasgo"
                value={template.icono_rasgo}
                onChange={(v) => update("icono_rasgo", v)}
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4 rounded-lg border border-marca-noche/10 p-4">
            <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
              Poder y Puntaje
            </legend>
            <div className="grid grid-cols-2 gap-4">
              <SliderField label="Tamaño Poder" name="tamano_poder" min={1} max={30} step={0.5} value={template["tamaño_poder"]} onChange={(v) => update("tamaño_poder", v)} />
              <SliderField label="Tamaño Puntaje" name="tamano_score" min={1} max={30} step={0.5} value={template["tamaño_score"]} onChange={(v) => update("tamaño_score", v)} />
            </div>
            <SliderField label="Altura (compartida)" name="altura_poder_score" min={50} max={200} step={5} value={template["altura_poder_score"]} onChange={(v) => update("altura_poder_score", v)} />
            <p className="text-xs text-marca-noche/60">
              Altura estira o achica solo lo alto de los números (100 = normal), sin cambiar su
              ancho. No aplica al nombre.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <OffsetFields
                label="Poder (ancla arriba-derecha)"
                namePrefix="poder"
                value={template.poder}
                onChange={(v) => update("poder", v)}
              />
              <OffsetFields
                label="Puntaje (ancla abajo-izquierda)"
                namePrefix="score"
                value={template.score}
                onChange={(v) => update("score", v)}
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3 rounded-lg border border-marca-noche/10 p-4">
            <legend className="px-1 text-sm font-bold uppercase tracking-wide text-marca-noche/60">
              Línea de crédito (impresión y postal)
            </legend>
            <p className="text-xs text-marca-noche/60">Siempre queda centrada horizontalmente.</p>
            <div className="grid grid-cols-2 gap-4">
              <SliderField label="Tamaño" name="credito_tamano" min={1} max={12} step={0.2} value={template.credito["tamaño"]} onChange={(v) => updateCredito("tamaño", v)} />
              <SliderField label="Offset Y" name="credito_offset_y" min={0} max={20} step={0.5} value={template.credito.offset_y} onChange={(v) => updateCredito("offset_y", v)} />
            </div>
            <p className="text-xs text-marca-noche/60">
              ≈ {(template.credito["tamaño"] * 1.786).toFixed(1)}pt en la carta impresa (63mm de
              ancho). Se calculó 7-8pt como legible; por debajo de 5pt cuesta leerlo incluso
              impreso.
            </p>
          </fieldset>

          <SubmitButton pending={pending}>Guardar plantilla</SubmitButton>
        </div>

        <div className="flex flex-col gap-2 lg:sticky lg:top-6 lg:self-start">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-marca-noche">Carta de ejemplo</span>
            <select
              value={sampleId}
              onChange={(event) => setSampleId(event.target.value)}
              className="w-full rounded border border-marca-noche/20 bg-white px-3 py-2 text-sm text-marca-noche focus:border-marca-violeta focus:outline-none"
            >
              {sampleCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          </label>

          <div className="relative aspect-[5/7] w-full overflow-hidden rounded-xl border-2 border-marca-noche/10 bg-marca-noche/5 shadow-sm">
            {sample.image_front_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview en vivo, no necesita optimización de next/image
              <img
                src={sample.image_front_url}
                alt={sample.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            <CardArtOverlay
              variant="impresion"
              template={{ ...template, marco_url: marcoPreviewUrl }}
              applyArtTemplate={sample.apply_art_template}
              name={sample.name}
              useCardNameAsDisplay={sample.use_card_name_as_display}
              displayLine1={sample.display_line_1}
              displayLine2={sample.display_line_2}
              displayLine3={sample.display_line_3}
              chapterInfo={sample.chapter_info}
              artist={sample.artist}
              nameShadowIntensity={sample.name_shadow_intensity}
              nameFontSize={sample.name_font_size}
              nameLineHeight={sample.name_line_height}
              power={sample.power}
              score={sample.score}
              genre={sample.genre}
              trait={sample.trait}
            />
          </div>
        </div>
      </div>
    </form>
  );
}
