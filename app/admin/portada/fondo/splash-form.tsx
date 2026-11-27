"use client";

import { useEffect, useRef, useState, useTransition, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import Link from "next/link";
import { ColorField } from "@/components/admin/color-field";
import { CheckboxField, FormField, fieldInputClass } from "@/components/admin/form-field";
import { ErrorMessage, SubmitButton } from "@/components/admin/submit-button";
import {
  SPLASH_ALLOWED_MIME,
  SPLASH_BODY_MAX,
  SPLASH_DEFAULT_COLOR,
  SPLASH_MAX_BYTES,
  SPLASH_NAME_MAX,
  SPLASH_OVERLAY_MAX,
  SPLASH_TITLE_MAX,
  formatKb,
  weightWarning,
  type SplashTheme,
} from "@/lib/splash/types";
import { isoToColombiaDay } from "@/lib/utils/colombia-time";
import { createSplash, updateSplash } from "./actions";
import { SplashPreview } from "./splash-preview";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : min));

export function SplashForm({ initial }: { initial?: SplashTheme }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [textColor, setTextColor] = useState(initial?.text_color ?? SPLASH_DEFAULT_COLOR);
  const [overlay, setOverlay] = useState(initial?.overlay_opacity ?? 35);
  const [focusX, setFocusX] = useState(initial?.focus_x ?? 50);
  const [focusY, setFocusY] = useState(initial?.focus_y ?? 50);
  const [startsAt, setStartsAt] = useState(isoToColombiaDay(initial?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(isoToColombiaDay(initial?.ends_at ?? null));
  const [isActive, setIsActive] = useState(initial?.is_active ?? false);
  const [removeImage, setRemoveImage] = useState(false);

  // Imagen recién elegida (todavía sin subir): se previsualiza con una URL local
  // y se muestra su peso antes de guardar.
  const [file, setFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  const imageUrl = removeImage ? null : (localUrl ?? initial?.image_url ?? null);
  const warning = file ? weightWarning(file.size) : null;

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    setFileError(null);
    if (!chosen) {
      setFile(null);
      setLocalUrl(null);
      return;
    }
    if (!(SPLASH_ALLOWED_MIME as readonly string[]).includes(chosen.type)) {
      setFileError("La imagen tiene que ser WebP, JPG o PNG.");
      event.target.value = "";
      return;
    }
    if (chosen.size > SPLASH_MAX_BYTES) {
      setFileError(
        `Esta imagen pesa ${formatKb(chosen.size)} y el máximo es 1 MB. Comprímela o conviértela a WebP.`,
      );
      event.target.value = "";
      return;
    }
    setFile(chosen);
    setLocalUrl(URL.createObjectURL(chosen));
    setRemoveImage(false);
  };

  // Clic sobre la imagen: el punto marcado es el que queda centrado al recortar.
  const handlePick = (event: MouseEvent<HTMLElement>) => {
    const image = imgRef.current;
    if (!image) return;
    const rect = image.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setFocusX(clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100));
    setFocusY(clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    // Estos tres viven en estado, no en inputs con nombre.
    formData.set("focus_x", String(focusX));
    formData.set("focus_y", String(focusY));
    formData.set("is_active", isActive ? "true" : "false");
    if (file) formData.set("image", file);

    startTransition(async () => {
      try {
        if (initial) await updateSplash(initial.id, formData);
        else await createSplash(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-5">
        <ErrorMessage message={error} />

        <FormField label="Nombre (solo para ti)" hint={`${name.length}/${SPLASH_NAME_MAX}`}>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, SPLASH_NAME_MAX))}
            maxLength={SPLASH_NAME_MAX}
            required
            placeholder="Navidad 2026"
            className={fieldInputClass}
          />
        </FormField>

        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-marca-noche">Imagen de fondo</span>
            <input
              type="file"
              accept="image/webp,image/jpeg,image/png"
              onChange={handleFile}
              className="text-sm text-marca-noche file:mr-2 file:rounded file:border-0 file:bg-marca-violeta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
            <span className="text-xs text-marca-noche/60">
              WebP, JPG o PNG, máximo 1 MB. Se recomienda WebP de menos de 500 KB. Sin imagen, el fondo es
              azul casi negro.
            </span>
          </label>

          {fileError && <ErrorMessage message={fileError} />}
          {file && !fileError && (
            <p className="text-sm text-marca-noche">Esta imagen pesa {formatKb(file.size)}.</p>
          )}
          {warning && (
            <p
              role="status"
              className="rounded border border-marca-amarillo bg-marca-amarillo/20 px-3 py-2 text-sm text-marca-noche"
            >
              {warning}
            </p>
          )}

          {initial?.image_url && !file && (
            <CheckboxField
              label="Quitar la imagen actual"
              name="remove_image"
              checked={removeImage}
              onChange={setRemoveImage}
            />
          )}
        </div>

        {imageUrl && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-marca-noche">
              Punto de enfoque: haz clic sobre la imagen en la parte que debe quedar centrada
            </span>
            <div className="relative inline-block max-w-full cursor-crosshair self-start overflow-hidden rounded border border-marca-noche/20">
              {/* eslint-disable-next-line @next/next/no-img-element -- previsualización de una imagen local o ya optimizada */}
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Imagen de la portada. Haz clic para marcar el punto de enfoque."
                onClick={handlePick}
                draggable={false}
                className="block h-auto max-h-72 w-auto max-w-full select-none"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_#ff3333]"
                style={{ left: `${focusX}%`, top: `${focusY}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-marca-noche">
                Horizontal (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={focusX}
                  onChange={(event) => setFocusX(clamp(Number(event.target.value), 0, 100))}
                  className="w-20 rounded border border-marca-noche/20 bg-white px-2 py-1 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-marca-noche">
                Vertical (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={focusY}
                  onChange={(event) => setFocusY(clamp(Number(event.target.value), 0, 100))}
                  className="w-20 rounded border border-marca-noche/20 bg-white px-2 py-1 text-sm"
                />
              </label>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-marca-noche">Oscurecido: {overlay}%</span>
          <input
            type="range"
            name="overlay_opacity"
            min={0}
            max={SPLASH_OVERLAY_MAX}
            step={1}
            value={overlay}
            onChange={(event) => setOverlay(Number(event.target.value))}
            className="w-full accent-marca-violeta"
          />
          <span className="text-xs text-marca-noche/60">
            0 deja la imagen tal cual; hasta 80 la oscurece para que el texto se lea mejor.
          </span>
        </label>

        <FormField label="Título" hint={`${title.length}/${SPLASH_TITLE_MAX}. Si lo dejas vacío, se usa «Estúpido Nerd TCG».`}>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, SPLASH_TITLE_MAX))}
            maxLength={SPLASH_TITLE_MAX}
            placeholder="Estúpido Nerd TCG"
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="Texto" hint={`${body.length}/${SPLASH_BODY_MAX}. Si lo dejas vacío, se usa «Inicia sesión para armar tu colección».`}>
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, SPLASH_BODY_MAX))}
            maxLength={SPLASH_BODY_MAX}
            rows={3}
            placeholder="Inicia sesión para armar tu colección"
            className={fieldInputClass}
          />
        </FormField>

        <ColorField
          label="Color del texto"
          name="text_color"
          defaultValue={initial?.text_color ?? SPLASH_DEFAULT_COLOR}
          onChange={setTextColor}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Empieza (hora de Colombia)" hint="Opcional. Desde las 00:00 de ese día. Vacío = ya.">
            <input
              type="date"
              name="starts_at"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className={fieldInputClass}
            />
          </FormField>
          <FormField label="Termina (hora de Colombia)" hint="Opcional. El día cuenta completo, hasta las 23:59. Vacío = sin fin.">
            <input
              type="date"
              name="ends_at"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className={fieldInputClass}
            />
          </FormField>
        </div>

        <div className="flex flex-col gap-1">
          <CheckboxField label="Activa" name="is_active_ui" checked={isActive} onChange={setIsActive} />
          <p className="pl-6 text-xs text-marca-noche/60">
            Se muestra cuando está activa y dentro de sus fechas. Si hay varias a la vez, gana la que empezó
            más recientemente.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <SubmitButton pending={pending}>Guardar</SubmitButton>
          <Link href="/admin/portada/fondo" className="text-sm text-marca-noche/70 hover:underline">
            Volver a la lista
          </Link>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        <h2 className="text-xl">Vista previa</h2>
        <SplashPreview
          values={{
            imageUrl,
            focusX,
            focusY,
            overlayOpacity: overlay,
            title,
            body,
            textColor,
          }}
        />
      </div>
    </form>
  );
}
