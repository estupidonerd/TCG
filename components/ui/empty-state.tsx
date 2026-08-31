// Estado vacío estándar: ícono + mensaje, mismo look en toda la app (antes
// cada pantalla repetía "py-12 text-center text-sm text-marca-noche/50" a
// mano). El ícono es un emoji -- consistente con el resto del proyecto
// (📦 en la apertura de sobre, etc.), sin depender de una librería de
// íconos.
export function EmptyState({
  icon,
  message,
  compact = false,
}: {
  icon: string;
  message: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${compact ? "py-6" : "py-12"}`}>
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <p className="max-w-xs text-sm text-marca-noche/50">{message}</p>
    </div>
  );
}
