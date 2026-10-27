"use client";

import { createContext, useContext, type ReactNode } from "react";

type VoteStatus = {
  // Dentro de la ventana de fechas y con un jugador logueado. Fuera de la
  // ventana todo lo demás (ítem de menú, puntico, popup) queda apagado.
  isOpen: boolean;
  hasVoted: boolean;
  // El WelcomeModal todavía no se ha cerrado: el popup espera.
  welcomePending: boolean;
};

const VoteStatusContext = createContext<VoteStatus>({
  isOpen: false,
  hasVoted: true,
  welcomePending: false,
});

// Los valores los calcula el layout (servidor) en cada render. Cuando
// WelcomeModal o /proximas llaman router.refresh(), el layout vuelve a
// correr y estos valores se actualizan solos: así el puntico del menú
// desaparece al votar, y el popup se entera de que la bienvenida ya se
// cerró, sin que ninguno de los dos tenga que avisarle al otro.
export function VoteStatusProvider({
  value,
  children,
}: {
  value: VoteStatus;
  children: ReactNode;
}) {
  return <VoteStatusContext.Provider value={value}>{children}</VoteStatusContext.Provider>;
}

export function useVoteStatus() {
  return useContext(VoteStatusContext);
}
