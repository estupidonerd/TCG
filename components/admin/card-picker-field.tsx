"use client";

import { useMemo, useState } from "react";
import { fieldInputClass } from "./form-field";

export type PickableCard = { id: string; name: string };

// Buscador simple para elegir una carta de entre todo el catálogo (no hay
// tantas como para justificar nada más elaborado). No usa un <select>
// nativo a propósito: con cientos de cartas, tipear para filtrar es mucho
// más rápido que desplazarse por una lista larga.
export function CardPickerField({
  cards,
  value,
  onChange,
  placeholder,
}: {
  cards: PickableCard[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => cards.find((c) => c.id === value) ?? null, [cards, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? cards.filter((c) => c.name.toLowerCase().includes(q)) : cards;
    return list.slice(0, 20);
  }, [cards, query]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded border border-marca-noche/20 bg-marca-noche/5 px-3 py-2 text-sm">
        <span className="font-semibold text-marca-noche">{selected.name}</span>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setQuery("");
          }}
          className="text-xs font-semibold text-marca-violeta hover:underline"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder ?? "Buscar carta por nombre…"}
        className={fieldInputClass}
      />
      {open && filtered.length > 0 && (
        // onMouseDown con preventDefault en vez de onClick: así el input no
        // llega a perder el foco (y por lo tanto la lista no se cierra por
        // el onBlur de arriba) antes de que el click en el ítem se procese.
        <ul
          onMouseDown={(event) => event.preventDefault()}
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded border border-marca-noche/20 bg-white shadow-lg"
        >
          {filtered.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(card.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-marca-noche hover:bg-marca-violeta/10"
              >
                {card.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
