"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

// Mismo patrón que ConfirmDialog (components/ui/confirm-dialog.tsx): todo
// en estilos inline, sin clases de Tailwind, montado con portal a
// document.body. Ver el comentario de ese archivo para el porqué.
const COLOR = {
  violeta: "#8100cc",
  rojo: "#ff3333",
  noche: "#000021",
};

export function DeleteDeckDialog({
  deckName,
  onConfirm,
  onCancel,
}: {
  deckName: string;
  onConfirm: (releaseUnused: boolean) => void;
  onCancel: () => void;
}) {
  const [releaseUnused, setReleaseUnused] = useState(false);

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(0, 0, 33, 0.6)",
      }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "400px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          padding: "24px",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.25)",
        }}
      >
        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: COLOR.noche }}>
          ¿Borrar el mazo &quot;{deckName}&quot;? Esta acción no se puede deshacer.
        </p>

        <label
          style={{
            marginTop: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
            color: COLOR.noche,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={releaseUnused}
            onChange={(event) => setReleaseUnused(event.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: COLOR.violeta, cursor: "pointer" }}
          />
          Liberar cartas de este mazo que no use otro mazo
        </label>

        <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "transparent",
              border: "none",
              borderRadius: "999px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 600,
              color: "rgba(0, 0, 33, 0.6)",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(releaseUnused)}
            style={{
              background: COLOR.rojo,
              border: "none",
              borderRadius: "999px",
              padding: "8px 20px",
              fontSize: "14px",
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Borrar mazo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
