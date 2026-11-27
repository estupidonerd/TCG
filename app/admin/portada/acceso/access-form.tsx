"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ColorField } from "@/components/admin/color-field";
import { CheckboxField, FormField, fieldInputClass } from "@/components/admin/form-field";
import { ErrorMessage, SubmitButton } from "@/components/admin/submit-button";
import { AccessNoticeCard } from "@/components/access/access-notice-card";
import {
  NOTICE_BODY_MAX,
  NOTICE_RETURN_MAX,
  NOTICE_TITLE_MAX,
  type AccessMode,
  type AccessState,
} from "@/lib/access/constants";
import { saveAccessSettings } from "./actions";

const MODES: { value: AccessMode; title: string; description: string; selected: string }[] = [
  {
    value: "open",
    title: "Abierto",
    description: "Todo funciona normal. No se muestra ningún cartel.",
    selected: "border-marca-violeta bg-marca-violeta/10",
  },
  {
    value: "notice",
    title: "Aviso",
    description: "La pantalla de entrada muestra el cartel y el login sigue funcionando.",
    selected: "border-marca-amarillo bg-marca-amarillo/20",
  },
  {
    value: "closed",
    title: "Cerrado",
    description: "El juego muestra el cartel y el login se oculta. Solo el equipo puede entrar.",
    selected: "border-marca-rojo bg-marca-rojo/10",
  },
];

type PreviewSize = "desktop" | "mobile";

export function AccessForm({ initial }: { initial: AccessState }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [mode, setMode] = useState<AccessMode>(initial.access_mode);
  const [title, setTitle] = useState(initial.notice_title ?? "");
  const [body, setBody] = useState(initial.notice_body ?? "");
  const [returnText, setReturnText] = useState(initial.notice_return_text ?? "");
  const [textColor, setTextColor] = useState(initial.notice_text_color);
  const [disconnectAll, setDisconnectAll] = useState(false);
  const [previewSize, setPreviewSize] = useState<PreviewSize>("mobile");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(null);

    startTransition(async () => {
      try {
        const result = await saveAccessSettings({
          mode,
          title,
          body,
          returnText,
          textColor,
          disconnectAll: mode === "closed" && disconnectAll,
        });
        setSaved(
          result.epoch !== null
            ? "Guardado. Todos los jugadores tendrán que volver a iniciar sesión."
            : "Guardado. Los cambios se ven de inmediato.",
        );
        setDisconnectAll(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <ErrorMessage message={error} />
      {saved && (
        <p
          role="status"
          className="rounded border border-marca-violeta/40 bg-marca-violeta/10 px-3 py-2 text-sm text-marca-violeta"
        >
          {saved}
        </p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-xl font-black uppercase text-marca-rojo">Modo</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((option) => {
            const checked = mode === option.value;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-marca-violeta ${
                  checked ? option.selected : "border-marca-noche/15 bg-white hover:border-marca-noche/30"
                }`}
              >
                <input
                  type="radio"
                  name="access_mode"
                  value={option.value}
                  checked={checked}
                  onChange={() => setMode(option.value)}
                  className="sr-only"
                />
                <span className="text-base font-bold text-marca-noche">{option.title}</span>
                <span className="text-sm text-marca-noche/70">{option.description}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h2 className="text-xl">Cartel</h2>

          <FormField label="Título" hint={`${title.length}/${NOTICE_TITLE_MAX}`}>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, NOTICE_TITLE_MAX))}
              maxLength={NOTICE_TITLE_MAX}
              placeholder="Volvemos pronto"
              className={fieldInputClass}
            />
          </FormField>

          <FormField label="Texto" hint={`${body.length}/${NOTICE_BODY_MAX}`}>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value.slice(0, NOTICE_BODY_MAX))}
              maxLength={NOTICE_BODY_MAX}
              rows={4}
              placeholder="Estamos haciendo ajustes en el juego."
              className={fieldInputClass}
            />
          </FormField>

          <FormField label="Volvemos aproximadamente…" hint={`${returnText.length}/${NOTICE_RETURN_MAX}`}>
            <input
              type="text"
              value={returnText}
              onChange={(event) => setReturnText(event.target.value.slice(0, NOTICE_RETURN_MAX))}
              maxLength={NOTICE_RETURN_MAX}
              placeholder="Volvemos aproximadamente el 2 de diciembre"
              className={fieldInputClass}
            />
          </FormField>

          <ColorField
            label="Color del texto"
            name="notice_text_color"
            defaultValue={initial.notice_text_color}
            onChange={setTextColor}
          />

          {mode === "closed" && (
            <div className="flex flex-col gap-1">
              <CheckboxField
                label="Desconectar también a todos los jugadores"
                name="disconnect_all"
                checked={disconnectAll}
                onChange={setDisconnectAll}
              />
              <p className="pl-6 text-xs text-marca-noche/60">
                Al guardar, todos tendrán que volver a iniciar sesión. Tú no serás desconectado.
              </p>
            </div>
          )}

          <div>
            <SubmitButton pending={pending}>Guardar</SubmitButton>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl">Vista previa</h2>
            <div role="group" aria-label="Tamaño de la vista previa" className="flex overflow-hidden rounded border border-marca-noche/20">
              {(["mobile", "desktop"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={previewSize === size}
                  onClick={() => setPreviewSize(size)}
                  className={`touch-manipulation px-3 py-1.5 text-sm font-semibold transition-colors ${
                    previewSize === size
                      ? "bg-marca-violeta text-white"
                      : "bg-white text-marca-noche hover:bg-marca-noche/5"
                  }`}
                >
                  {size === "mobile" ? "Celular" : "Escritorio"}
                </button>
              ))}
            </div>
          </div>

          {mode === "open" && (
            <p className="text-sm text-marca-noche/70">
              En modo Abierto no se muestra ningún cartel; así se vería si eliges Aviso o Cerrado.
            </p>
          )}

          <div className="rounded-xl border border-marca-noche/10 bg-white p-4">
            <div
              className="mx-auto w-full"
              style={{ maxWidth: previewSize === "mobile" ? 340 : 720 }}
            >
              <AccessNoticeCard
                title={title}
                body={body}
                textColor={textColor}
                returnText={returnText}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
