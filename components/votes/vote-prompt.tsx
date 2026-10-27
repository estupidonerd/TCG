"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { usePackOpening } from "@/components/providers/pack-opening-provider";
import { useVoteStatus } from "@/components/providers/vote-status-provider";
import { madridToday } from "@/lib/config/vote";

const STORAGE_KEY = "vote-prompt-dismissed-on";

// Pantallas donde el popup nunca aparece: /canjear (momento inmersivo del
// sobre), /proximas (ya está ahí), y las que no son de jugador.
const EXCLUDED_PREFIXES = ["/canjear", "/proximas", "/admin", "/login", "/baneado", "/auth"];

const COLOR = { violeta: "#8100cc", noche: "#000021" };

// Mismo patrón que WelcomeModal/ConfirmDialog: portal a document.body y
// estilos inline, para no repetir los problemas puntuales de Safari que ya
// se pisaron con esos modales.
export function VotePrompt() {
  const { isOpen, hasVoted, welcomePending } = useVoteStatus();
  const { isOpeningPack } = usePackOpening();
  const pathname = usePathname();
  const router = useRouter();
  // En memoria, no en el navegador: si localStorage falla, esto es lo que
  // evita que el popup vuelva a salir en esta sesión.
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  const excludedPath = EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const eligible = isOpen && !hasVoted && !welcomePending && !isOpeningPack && !excludedPath;

  useEffect(() => {
    if (!eligible || dismissed) {
      setVisible(false);
      return;
    }

    // Si no se puede leer el navegador no hay forma de saber si ya se
    // descartó hoy: mejor no mostrarlo que insistir en cada carga.
    let dismissedToday = false;
    try {
      dismissedToday = window.localStorage.getItem(STORAGE_KEY) === madridToday();
    } catch {
      return;
    }
    if (dismissedToday) return;

    // Nunca encima de otro modal (feedback, bienvenida, confirmaciones,
    // ajustes de intercambio...): espera a que no haya ningún diálogo abierto.
    const anotherDialogOpen = () =>
      document.querySelector('[role="dialog"]:not([data-vote-prompt]), [role="alertdialog"]') !== null;

    if (!anotherDialogOpen()) {
      setVisible(true);
      return;
    }
    const interval = window.setInterval(() => {
      if (!anotherDialogOpen()) {
        window.clearInterval(interval);
        setVisible(true);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [eligible, dismissed]);

  const dismissForToday = () => {
    setDismissed(true);
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, madridToday());
    } catch {
      // Sin almacenamiento: `dismissed` en memoria ya lo oculta en esta sesión.
    }
  };

  useEffect(() => {
    if (!visible) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissForToday();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [visible]);

  if (!visible || !eligible) return null;

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
        aria-labelledby="vote-prompt-title"
        data-vote-prompt=""
        style={{
          width: "100%",
          maxWidth: "384px",
          borderRadius: "16px",
          backgroundColor: "#ffffff",
          padding: "24px",
          textAlign: "center",
          boxShadow: "0 20px 25px rgba(0, 0, 0, 0.25)",
        }}
      >
        <span style={{ fontSize: "48px" }} aria-hidden="true">
          🗳️
        </span>
        <h2 id="vote-prompt-title" style={{ margin: "12px 0 0", fontSize: "20px" }}>
          Ayúdanos a decidir lo que sigue
        </h2>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "rgba(0, 0, 33, 0.7)",
          }}
        >
          Estamos eligiendo qué construir primero y tu opinión cuenta. Ordenar las ideas te toma
          menos de un minuto.
        </p>

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <button
            type="button"
            autoFocus
            onClick={() => {
              dismissForToday();
              router.push("/proximas");
            }}
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
            Ordenar ideas
          </button>
          <button
            type="button"
            onClick={dismissForToday}
            style={{
              background: "transparent",
              border: "none",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "rgba(0, 0, 33, 0.5)",
              cursor: "pointer",
            }}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
