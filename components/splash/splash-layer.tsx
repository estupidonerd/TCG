// Fondo de una portada: la imagen a cobertura completa, centrada en el punto de
// enfoque, y encima la capa oscura. Es una etiqueta <img> normal (no pasa por
// next/image: las imágenes ya se suben en WebP y optimizadas). Es solo
// presentación, sin hooks: sirve igual en la pantalla real (servidor) y en la
// vista previa del admin (navegador).
//
// El padre tiene que ser `relative` (y conviene `isolate overflow-hidden`);
// esta capa se pone con `absolute inset-0` detrás del contenido.
export function SplashLayer({
  imageUrl,
  focusX,
  focusY,
  overlayOpacity,
  priority = false,
}: {
  imageUrl: string | null;
  focusX: number;
  focusY: number;
  overlayOpacity: number;
  // true en la pantalla real: es lo primero que se ve, así que se carga ya.
  priority?: boolean;
}) {
  if (!imageUrl) return null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- a propósito: imagen ya optimizada, sin pasar por next/image */}
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        style={{ objectPosition: `${focusX}% ${focusY}%` }}
      />
      {/* Capa oscura: azul casi negro de la marca, con la opacidad elegida. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-marca-noche"
        style={{ opacity: overlayOpacity / 100 }}
      />
    </>
  );
}
