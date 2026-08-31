import type { Rarity } from "./types";

// Mapeo de color por rareza, único para todo el sitio (regla de marca de
// CLAUDE.md): común=gris, rara=violeta, épica=rojo, legendaria=amarillo.
// Centralizado acá porque ya se había duplicado en más de un componente y
// se desincronizó -- cualquier lugar que necesite el color de una rareza
// importa de acá, nunca redefine su propio mapa.
export const RARITY_BORDER_CLASS: Record<Rarity, string> = {
  comun: "border-gray-400",
  rara: "border-marca-violeta",
  epica: "border-marca-rojo",
  legendaria: "border-marca-amarillo",
};

export const RARITY_BADGE_CLASS: Record<Rarity, string> = {
  comun: "bg-gray-400 text-white",
  rara: "bg-marca-violeta text-white",
  epica: "bg-marca-rojo text-white",
  legendaria: "bg-marca-amarillo text-marca-noche",
};

// Variante con fondo tenue + texto del color de la rareza (previsualización
// de carta: admin/cards y coleccion/[slug] antes de tener el detalle
// completo). Mismos colores que arriba, solo cambia la combinación visual.
export const RARITY_ACCENT_CLASS: Record<Rarity, string> = {
  comun: "border-marca-noche/30 bg-marca-noche/5 text-marca-noche",
  rara: "border-marca-violeta bg-marca-violeta/10 text-marca-violeta",
  epica: "border-marca-rojo bg-marca-rojo/10 text-marca-rojo",
  legendaria: "border-marca-amarillo bg-marca-amarillo/20 text-marca-noche",
};

export const DARK_PANEL_RARITIES = new Set<Rarity>(["epica", "legendaria"]);

// Hex plano de cada rareza, para casos que necesitan el color en un estilo
// inline (ej. el pulso de brillo al revelar una carta) en vez de una clase
// de Tailwind. Mismos colores que los mapas de arriba.
export const RARITY_HEX: Record<Rarity, string> = {
  comun: "#9ca3af",
  rara: "#8100cc",
  epica: "#ff3333",
  legendaria: "#f2d80a",
};
