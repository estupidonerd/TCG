"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

// Transición suave entre páginas: template.tsx se remonta en cada
// navegación (a diferencia de layout.tsx, que persiste), así que un simple
// fade de entrada acá alcanza para todo el sitio sin tocar cada página.
//
// A propósito SOLO anima opacity, nunca x/y/scale: varias pantallas tienen
// paneles con `fixed` (la barra inferior de /mazos y /intercambios/nuevo,
// los overlays de trade-settings-modal y trade-accept-animation) que
// necesitan quedar posicionados contra el viewport real. Cualquier
// `transform` en un ancestor (incluso animar a y:0) les cambia el
// contenedor de referencia y rompe ese `fixed` -- opacity nunca toca
// `transform`, así que no hay riesgo.
export default function Template({ children }: { children: React.ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
