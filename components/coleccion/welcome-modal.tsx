"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/providers/user-provider";

const STEPS = [
  {
    emoji: "🎁",
    title: "Canjea tu código",
    text: "Te llega un código por mail. Canjéalo en Canjear para abrir tu primer sobre.",
  },
  {
    emoji: "🗂️",
    title: "Mira tu colección",
    text: "Todas las cartas que consigas quedan guardadas acá, en tu colección.",
  },
  {
    emoji: "🔄",
    title: "Intercambia o imprime tus cartas",
    text: "Cuando quieras, intercambia tus repetidas con otros jugadores o imprime tus cartas en casa.",
  },
];

const COLOR = { violeta: "#8100cc", noche: "#000021" };

// Mismo patrón que ConfirmDialog: portal a document.body y estilos inline
// para no repetir los problemas puntuales de Safari que ya se pisaron con
// otros modales de la app.
export function WelcomeModal({ show }: { show: boolean }) {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(show);
  const [step, setStep] = useState(0);

  if (!open) return null;

  const close = async () => {
    setOpen(false);
    if (!user) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ has_seen_welcome: true })
      .eq("id", user.id);
    // Sin esto, volver a /coleccion navegando (no con un reload completo)
    // podía servir el payload de Server Component que Next ya tenía en su
    // caché de router de la visita anterior -- con has_seen_welcome
    // todavía en false, mostrando el modal de nuevo aunque el guardado
    // haya funcionado.
    if (!error) router.refresh();
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

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
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: "384px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          padding: "24px",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={close}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              color: "rgba(0, 0, 33, 0.5)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Saltar
          </button>
        </div>

        <div style={{ textAlign: "center", padding: "8px 8px 0" }}>
          <span style={{ fontSize: "48px" }} aria-hidden="true">
            {current.emoji}
          </span>
          <h2 style={{ margin: "12px 0 0", fontSize: "20px" }}>{current.title}</h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14px",
              lineHeight: 1.6,
              color: "rgba(0, 0, 33, 0.7)",
            }}
          >
            {current.text}
          </p>
        </div>

        <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "6px" }}>
          {STEPS.map((s, index) => (
            <span
              key={s.title}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "999px",
                background: index === step ? COLOR.violeta : "rgba(0, 0, 33, 0.15)",
              }}
            />
          ))}
        </div>

        <div style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            style={{
              background: COLOR.violeta,
              border: "none",
              borderRadius: "999px",
              padding: "10px 28px",
              fontSize: "14px",
              fontWeight: 700,
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            {isLast ? "Empezar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
