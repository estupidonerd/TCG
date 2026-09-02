"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Red de seguridad además del límite de CHAPTER_INFO_MAX_LENGTH del
// formulario: el string final que se imprime combina chapter_info (con
// límite) con el nombre del artista (sin límite propio), así que puede no
// entrar igual. Mide contra el propio elemento renderizado (misma fuente,
// mismo tamaño real) y recorta con "…" carácter por carácter hasta que
// entre en maxLines.
export function useFitText(text: string, maxLines: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fitted, setFitted] = useState(text);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.textContent = text;
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || el.offsetHeight || 1;
    const maxHeight = lineHeight * maxLines + 1;

    let current = text;
    while (current.length > 0 && el.scrollHeight > maxHeight) {
      current = current.slice(0, -1);
      el.textContent = `${current}…`;
    }

    setFitted(el.textContent ?? text);
  }, [text, maxLines]);

  return { ref, fitted };
}
