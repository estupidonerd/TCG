"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type PackOpeningContextValue = {
  isOpeningPack: boolean;
  setIsOpeningPack: (value: boolean) => void;
};

const PackOpeningContext = createContext<PackOpeningContextValue>({
  isOpeningPack: false,
  setIsOpeningPack: () => {},
});

// Le permite a <PackOpening> (la animación de abrir sobre en /canjear)
// avisarle al botón flotante de feedback que se esconda mientras está
// montada, sin acoplar ninguno de los dos a la lógica del otro.
export function PackOpeningProvider({ children }: { children: ReactNode }) {
  const [isOpeningPack, setIsOpeningPack] = useState(false);

  return (
    <PackOpeningContext.Provider value={{ isOpeningPack, setIsOpeningPack }}>
      {children}
    </PackOpeningContext.Provider>
  );
}

export function usePackOpening() {
  return useContext(PackOpeningContext);
}
