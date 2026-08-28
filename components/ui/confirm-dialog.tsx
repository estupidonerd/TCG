"use client";

import { createPortal } from "react-dom";

// Reemplazo de window.confirm(): su apariencia la define el navegador/SO,
// así que no hay forma de unificar el look tocando el diálogo nativo.
//
// Después de dos vueltas de bugs específicos de un Safari puntual (el
// fondo no oscurecía, después el botón de confirmar no se veía, después
// la caja blanca entera no aparecía) se abandonó la idea de ir
// parcheando clase por clase: TODO acá abajo está en estilos inline
// explícitos, sin ninguna clase de Tailwind (ni siquiera bg-white),
// para sacar de la ecuación cualquier duda sobre cómo ese navegador
// resuelve custom properties, color-mix() o lo que sea. Sigue montado
// con un portal a document.body para no quedar atrapado dentro del
// position:fixed de otro modal.
const COLOR = {
  violeta: "#8100cc",
  rojo: "#ff3333",
  noche: "#000021",
};

export function ConfirmDialog({
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
          maxWidth: "384px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          padding: "24px",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.25)",
        }}
      >
        <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: COLOR.noche }}>
          {message}
        </p>
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
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: destructive ? COLOR.rojo : COLOR.violeta,
              border: "none",
              borderRadius: "999px",
              padding: "8px 20px",
              fontSize: "14px",
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
