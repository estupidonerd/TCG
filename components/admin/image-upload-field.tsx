"use client";

import { useState, type ChangeEvent } from "react";

// Input de archivo con thumbnail de previsualización. Es "uncontrolled" a
// propósito (input real con `name`) para que el form padre lo pueda leer
// con new FormData(formElement) sin cablear estado extra -- salvo que se
// pase onFileChange, para los casos donde el padre necesita enterarse del
// archivo elegido (ej. la imagen principal que alimenta la preview grande).
export function ImageUploadField({
  label,
  name,
  hint,
  initialPreviewUrl = null,
  onFileChange,
}: {
  label: string;
  name: string;
  hint?: string;
  initialPreviewUrl?: string | null;
  onFileChange?: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreviewUrl);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    }
    onFileChange?.(file);
  };

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-marca-noche">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-marca-noche/20 bg-marca-noche/5">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview de un archivo local recién elegido
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-1 text-center text-[10px] text-marca-noche/40">
              Sin archivo
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <input
            type="file"
            name={name}
            accept="image/png,image/jpeg,image/webp"
            onChange={handleChange}
            className="text-sm text-marca-noche file:mr-2 file:rounded file:border-0 file:bg-marca-violeta file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
          {hint && <span className="text-xs text-marca-noche/60">{hint}</span>}
        </div>
      </div>
    </label>
  );
}
