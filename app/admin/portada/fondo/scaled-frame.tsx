"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Marco de vista previa a tamaño de pantalla REAL (por ejemplo, 390 x 844 de un
// celular) reducido con una escala para que quepa en el panel. Así el recorte
// de la imagen y el tamaño relativo de los textos y botones son los de verdad,
// no una aproximación. El ancho del marco lo decide quien lo usa (con la clase
// `className`); la altura se calcula sola.
export function ScaledFrame({
  virtualWidth,
  virtualHeight,
  className = "",
  label,
  children,
}: {
  virtualWidth: number;
  virtualHeight: number;
  className?: string;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setScale(element.clientWidth / virtualWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [virtualWidth]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={`relative overflow-hidden rounded-xl border border-marca-noche/20 ${className}`}
      style={{ height: virtualHeight * scale }}
    >
      <div
        className="relative isolate overflow-hidden bg-marca-noche"
        style={{
          width: virtualWidth,
          height: virtualHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
