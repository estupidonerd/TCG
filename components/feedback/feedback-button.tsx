"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { usePackOpening } from "@/components/providers/pack-opening-provider";
import { FeedbackModal } from "./feedback-modal";

// Botón flotante visible en toda la app. Se esconde en /admin (tiene su
// propia UI, sin sentido pedirle feedback de jugador ahí) y mientras se
// está abriendo un sobre (ver PackOpeningProvider), para no taparle la
// animación.
export function FeedbackButton() {
  const pathname = usePathname();
  const { isOpeningPack } = usePackOpening();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/admin") || isOpeningPack) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Enviar feedback"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-marca-violeta text-xl shadow-lg transition-opacity hover:opacity-90 print:hidden"
      >
        <span aria-hidden="true">💬</span>
      </button>

      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}
