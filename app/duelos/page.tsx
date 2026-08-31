export default function DuelosPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <span className="rounded-full bg-marca-amarillo px-4 py-1 text-xs font-bold uppercase tracking-wide text-marca-noche">
        Próximamente
      </span>
      <h1 className="text-4xl sm:text-5xl">Duelos</h1>
      <p className="max-w-md text-sm font-light text-marca-noche/70">
        Muy pronto vas a poder enfrentar tu mazo contra el de otros jugadores,
        directamente acá. Todavía estamos construyendo esta parte del juego.
      </p>
    </main>
  );
}
