"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/providers/user-provider";
import { FEEDBACK_TYPE_LABELS } from "@/lib/supabase/types";
import type { FeedbackType } from "@/lib/supabase/types";

const TYPES: FeedbackType[] = ["falla", "sugerencia", "otro"];

const COLOR = {
  violeta: "#8100cc",
  noche: "#000021",
  rojo: "#ff3333",
};

// Mismo patrón que ConfirmDialog: portal a document.body y estilos inline
// (sin clases de Tailwind) para no repetir los problemas puntuales de
// Safari que ya se pisaron con otros modales de la app.
export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser();
  const [type, setType] = useState<FeedbackType>("sugerencia");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (message.trim().length === 0) {
      setError("Escribe un mensaje antes de enviar.");
      return;
    }

    setSending(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("feedback").insert({
      user_id: user?.id ?? null,
      type,
      page_path: window.location.pathname,
      message: message.trim(),
    });
    setSending(false);

    if (insertError) {
      setError("No pudimos enviar tu mensaje. Intenta de nuevo.");
      return;
    }

    setSent(true);
  };

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
      onClick={onClose}
    >
      <div
        role="dialog"
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
        {sent ? (
          <>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: COLOR.noche }}>
              ¡Gracias por tu mensaje!
            </p>
            <p style={{ marginTop: "8px", fontSize: "14px", lineHeight: 1.6, color: "rgba(0, 0, 33, 0.7)" }}>
              Ya lo recibimos y lo vamos a revisar.
            </p>
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: COLOR.violeta,
                  border: "none",
                  borderRadius: "999px",
                  padding: "8px 20px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: COLOR.noche }}>
              Cuéntanos qué pasó
            </p>

            <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
              {TYPES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setType(option)}
                  style={{
                    flex: 1,
                    borderRadius: "10px",
                    border: `1px solid ${type === option ? COLOR.violeta : "rgba(0, 0, 33, 0.15)"}`,
                    background: type === option ? COLOR.violeta : "transparent",
                    color: type === option ? "#ffffff" : COLOR.noche,
                    padding: "8px 4px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {FEEDBACK_TYPE_LABELS[option]}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Escribe acá tu mensaje…"
              rows={4}
              maxLength={1000}
              style={{
                marginTop: "16px",
                width: "100%",
                resize: "vertical",
                borderRadius: "10px",
                border: "1px solid rgba(0, 0, 33, 0.15)",
                padding: "10px 12px",
                fontSize: "14px",
                fontFamily: "inherit",
                color: COLOR.noche,
                boxSizing: "border-box",
              }}
            />

            {error && (
              <p style={{ marginTop: "8px", fontSize: "13px", color: COLOR.rojo }}>{error}</p>
            )}

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                onClick={onClose}
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
                onClick={handleSubmit}
                disabled={sending}
                style={{
                  background: COLOR.violeta,
                  border: "none",
                  borderRadius: "999px",
                  padding: "8px 20px",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#ffffff",
                  cursor: sending ? "default" : "pointer",
                  opacity: sending ? 0.6 : 1,
                }}
              >
                {sending ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
