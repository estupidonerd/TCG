"use client";

import { useState } from "react";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Selector visual + input de texto hex, sincronizados entre sí por el mismo
// estado. `name` es el input real que viaja en el FormData del form padre
// (siempre el valor de texto, ya validado con el pattern hex).
export function ColorField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
}) {
  const [hex, setHex] = useState(defaultValue && HEX_PATTERN.test(defaultValue) ? defaultValue : "#000000");
  const [text, setText] = useState(defaultValue ?? "");

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-marca-noche">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex}
          onChange={(event) => {
            setHex(event.target.value);
            setText(event.target.value);
          }}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-marca-noche/20 bg-white p-1"
        />
        <input
          type="text"
          name={name}
          value={text}
          onChange={(event) => {
            const value = event.target.value;
            setText(value);
            if (HEX_PATTERN.test(value)) setHex(value);
          }}
          pattern="^#[0-9a-fA-F]{6}$"
          placeholder="#8100cc"
          className="w-28 rounded border border-marca-noche/20 bg-white px-2 py-1.5 text-sm text-marca-noche focus:border-marca-violeta focus:outline-none"
        />
      </div>
    </label>
  );
}
