"use client";

function formatCode(raw: string): string {
  const clean = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return clean.match(/.{1,4}/g)?.join("-") ?? clean;
}

export function CodeInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(formatCode(text));
    } catch {
      // El navegador puede negar el permiso de portapapeles; el usuario
      // igual puede pegar con el gesto nativo del input.
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(formatCode(event.target.value))}
        placeholder="ABCD-EFGH-JKMN"
        maxLength={14}
        aria-label="Código de canje"
        className="w-full rounded-xl border-2 border-marca-noche/20 bg-white px-4 py-5 text-center font-mono text-2xl tracking-[0.15em] text-marca-noche placeholder:text-marca-noche/30 focus:border-marca-violeta focus:outline-none disabled:opacity-60 sm:text-3xl"
      />
      <button
        type="button"
        onClick={handlePaste}
        disabled={disabled}
        className="touch-manipulation select-none text-sm font-medium text-marca-violeta hover:underline disabled:opacity-60"
      >
        Pegar desde el portapapeles
      </button>
    </div>
  );
}
