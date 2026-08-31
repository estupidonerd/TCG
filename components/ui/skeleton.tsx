// Bloque base para pantallas de carga -- nunca una pantalla en blanco
// mientras se resuelve la carga server-side de una ruta. El pulso usa la
// animación nativa de Tailwind (no Framer Motion) para poder vivir en
// loading.tsx, que Next renderiza antes de que exista cualquier Client
// Component; se apaga solo con prefers-reduced-motion vía globals.css.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-marca-noche/10 ${className}`} />;
}
