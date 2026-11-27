import {
  DEFAULT_NOTICE_BODY,
  DEFAULT_NOTICE_TITLE,
  HEX_COLOR_PATTERN,
} from "@/lib/access/constants";

// El cartel de aviso. Lo usan las pantallas reales (/login, /aviso) y la vista
// previa del admin, así lo que ves al editar es exactamente lo que ven los
// jugadores. Sin hooks: sirve en Server y en Client Components.
//
// Lleva su propio fondo azul casi negro, porque el color del texto lo elige el
// admin y tiene que verse sin importar el fondo de la página. Los tamaños usan
// unidades de contenedor (cqw), no del navegador: así la vista previa "celular"
// dentro de una pantalla de escritorio se ve como se vería de verdad.
export function AccessNoticeCard({
  title,
  body,
  textColor,
  returnText,
}: {
  title: string | null;
  body: string | null;
  textColor: string;
  returnText: string | null;
}) {
  const color = HEX_COLOR_PATTERN.test(textColor) ? textColor : "#FFFFFF";
  const shownTitle = title?.trim() || DEFAULT_NOTICE_TITLE;
  const shownBody = body?.trim() || DEFAULT_NOTICE_BODY;
  const shownReturn = returnText?.trim() || null;

  return (
    <div style={{ containerType: "inline-size" }} className="w-full">
      <section
        aria-label="Aviso"
        className="w-full rounded-2xl bg-marca-noche px-[7cqw] py-[9cqw] text-center"
        style={{ color }}
      >
        <h1
          className="leading-tight"
          style={{ color, fontSize: "clamp(1.5rem, 8cqw, 2.75rem)" }}
        >
          {shownTitle}
        </h1>
        <p
          className="mt-4 whitespace-pre-line font-light"
          style={{ color, fontSize: "clamp(0.95rem, 3.6cqw, 1.125rem)" }}
        >
          {shownBody}
        </p>
        {shownReturn && (
          <p
            className="mt-6 inline-block rounded-full border px-4 py-2 font-bold"
            style={{
              color,
              borderColor: `${color}66`,
              fontSize: "clamp(0.85rem, 3.2cqw, 1rem)",
            }}
          >
            {shownReturn}
          </p>
        )}
      </section>
    </div>
  );
}
