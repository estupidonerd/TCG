import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Sin sesión, no hay nada útil que mostrar acá (SiteHeader tampoco se
// renderiza sin usuario): se redirige a /login, la misma página a la que
// ya manda el middleware para cualquier ruta protegida. Antes este botón
// vivía duplicado acá mismo, y quedó desactualizado cuando /login sumó más
// proveedores -- un solo lugar con los botones de login evita que se
// vuelvan a desincronizar.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ cuenta_eliminada?: string }>;
}) {
  const { cuenta_eliminada } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (cuenta_eliminada) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-4xl sm:text-5xl">Estúpido Nerd TCG</h1>
          <p className="max-w-sm text-sm text-marca-noche/70">
            Tu cuenta fue eliminada. Puedes crear una cuenta nueva cuando quieras.
          </p>
          <Link
            href="/login"
            className="touch-manipulation rounded-xl bg-marca-rojo px-8 py-4 text-lg font-bold text-marca-claro transition-opacity hover:opacity-90"
          >
            Ir a iniciar sesión
          </Link>
        </main>
      );
    }
    redirect("/login?next=/coleccion");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl sm:text-5xl">Estúpido Nerd TCG</h1>

      <Link
        href="/coleccion"
        className="touch-manipulation rounded-xl bg-marca-violeta px-8 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90"
      >
        Ir a mi colección
      </Link>
    </main>
  );
}
