export function SubmitButton({
  pending,
  children,
  pendingLabel = "Guardando…",
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-marca-rojo px-4 py-2 text-sm font-semibold text-marca-claro transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded border border-marca-rojo/40 bg-marca-rojo/10 px-3 py-2 text-sm text-marca-rojo">
      {message}
    </p>
  );
}
