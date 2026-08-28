import type { ReactNode } from "react";

export const fieldInputClass =
  "w-full rounded border border-marca-noche/20 bg-white px-3 py-2 text-sm text-marca-noche focus:border-marca-violeta focus:outline-none";

export function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-marca-noche">{label}</span>
      {children}
      {hint && <span className="text-xs text-marca-noche/60">{hint}</span>}
    </label>
  );
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
  checked,
  onChange,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  // checked/onChange son opcionales: si se pasan, el checkbox queda
  // controlado (necesario cuando algo más, como una previsualización en
  // vivo, tiene que reaccionar al toggle).
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        className="h-4 w-4 rounded border-marca-noche/30 text-marca-violeta focus:ring-marca-violeta"
      />
      <span className="text-sm font-semibold text-marca-noche">{label}</span>
      {hint && <span className="text-xs text-marca-noche/60">{hint}</span>}
    </label>
  );
}
