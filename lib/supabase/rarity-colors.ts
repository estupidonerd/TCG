import type { Rarity } from "./types";

// Mapeo de color por rareza, único para todo el sitio: común=gris,
// rara=rojo, épica=amarillo, legendaria=violeta. Centralizado acá porque
// ya se había duplicado en dos componentes y se desincronizó una vez.
export const RARITY_BORDER_CLASS: Record<Rarity, string> = {
  comun: "border-gray-400",
  rara: "border-marca-rojo",
  epica: "border-marca-amarillo",
  legendaria: "border-marca-violeta",
};

export const RARITY_BADGE_CLASS: Record<Rarity, string> = {
  comun: "bg-gray-400 text-white",
  rara: "bg-marca-rojo text-white",
  epica: "bg-marca-amarillo text-marca-noche",
  legendaria: "bg-marca-violeta text-white",
};

export const DARK_PANEL_RARITIES = new Set<Rarity>(["epica", "legendaria"]);
