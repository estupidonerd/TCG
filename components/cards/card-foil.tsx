import type { Rarity } from "@/lib/supabase/types";

export type FoilKind = "plata" | "bronce" | "dorado" | "tornasolado";

// Prioridad no negociable: variante siempre tornasolado, sin importar su
// rareza. Si no es variante, el color sale de la rareza -- común no lleva
// nada de foil.
export function getFoilKind(card: { variant_of: string | null; rarity: Rarity }): FoilKind | null {
  if (card.variant_of) return "tornasolado";
  if (card.rarity === "rara") return "bronce";
  if (card.rarity === "epica") return "plata";
  if (card.rarity === "legendaria") return "dorado";
  return null;
}

// Mismo gradiente lo usa la piel cosmética del sobre cerrado
// (dorado/tornasolado, ver pack-opening.tsx) -- un solo lugar para el color
// real de cada uno.
export const FOIL_GRADIENTS: Record<FoilKind, string> = {
  plata:
    "linear-gradient(135deg, #d8dce2 0%, #ffffff 22%, #a7acb6 45%, #ffffff 68%, #c3c7ce 100%)",
  bronce:
    "linear-gradient(135deg, #8a4a20 0%, #e2996a 22%, #6b3414 45%, #e2996a 68%, #a15a2c 100%)",
  dorado:
    "linear-gradient(135deg, #a9791a 0%, #ffe9a8 22%, #8a6410 45%, #ffe9a8 68%, #c99b2e 100%)",
  tornasolado:
    "linear-gradient(135deg, #ff8fc4 0%, #ffe08a 20%, #8fffb0 40%, #8fd6ff 60%, #c79bff 80%, #ff8fc4 100%)",
};

// Banda del barrido, tintada con el color propio de cada foil -- se nota la
// diferencia entre plata/bronce/dorado/tornasolado en el brillo mismo, no
// en un tinte de fondo permanente. Fade ancho y gradual en los dos
// extremos (nada de un corte duro entre transparente y color) para que no
// quede una línea marcada al pasar.
const SWEEP_GRADIENTS: Record<FoilKind, string> = {
  plata:
    "linear-gradient(105deg, transparent 15%, rgba(106,148,184,0.45) 38%, rgba(106,148,184,0.9) 50%, rgba(106,148,184,0.45) 62%, transparent 85%)",
  bronce:
    "linear-gradient(105deg, transparent 15%, rgba(214,83,38,0.45) 38%, rgba(214,83,38,0.9) 50%, rgba(214,83,38,0.45) 62%, transparent 85%)",
  dorado:
    "linear-gradient(105deg, transparent 15%, rgba(255,230,150,0.45) 38%, rgba(255,230,150,0.9) 50%, rgba(255,230,150,0.45) 62%, transparent 85%)",
  tornasolado:
    "linear-gradient(105deg, transparent 15%, rgba(255,170,225,0.75) 35%, rgba(170,255,205,0.75) 50%, rgba(150,205,255,0.75) 65%, transparent 85%)",
};

// Capa de foil sobre el arte de la carta. Nunca corre sola: el padre le pasa
// `sweeping` cuando el usuario pasa el mouse o toca la carta, un único
// barrido, siempre así -- en la grilla, en el detalle y en el sobre por
// igual, nunca en bucle.
//
// mix-blend-mode vive SOLO en la banda que se mueve -- nada queda tintado
// en reposo, el color real del arte no cambia hasta que el brillo pasa por
// encima. La posición de reposo (.foil-sweep-band en globals.css) coincide
// a propósito con el último fotograma de la animación (ver el comentario
// ahí) para que sacar la clase al terminar no deje ningún resto de color a
// la vista.
export function CardFoil({
  kind,
  sweeping = false,
  onSweepEnd,
}: {
  kind: FoilKind | null;
  sweeping?: boolean;
  onSweepEnd?: () => void;
}) {
  if (!kind) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        onAnimationEnd={sweeping ? onSweepEnd : undefined}
        className={`foil-sweep-band absolute inset-0 mix-blend-screen ${sweeping ? "animate-foil-sweep-once" : ""}`}
        // OJO: backgroundImage (longhand), nunca el shorthand "background"
        // acá. El shorthand resetea background-position y
        // background-repeat a sus valores iniciales (0% 0% y "repeat") de
        // forma implícita, y por ser estilo inline eso pisa SIEMPRE a
        // .foil-sweep-band en globals.css -- así fue que no-repeat y la
        // posición de reposo nunca llegaban a aplicarse de verdad.
        style={{ backgroundImage: SWEEP_GRADIENTS[kind], backgroundSize: "260% 260%" }}
      />
    </div>
  );
}
