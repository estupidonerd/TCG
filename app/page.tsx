import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GoogleLoginButton } from "@/components/auth/google-login-button";

// SiteHeader (en el layout) solo se renderiza cuando hay sesión, así que
// sin esto alguien que llega sin loguearse no tenía ningún link clickeable
// para entrar a la app. El botón de login va directo acá (no un link a
// /login) para no obligar a un segundo clic en una página intermedia que
// solo tiene ese mismo botón.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl sm:text-5xl">Estúpido Nerd TCG</h1>

      {user ? (
        <Link
          href="/coleccion"
          className="touch-manipulation rounded-xl bg-marca-violeta px-8 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90"
        >
          Ir a mi colección
        </Link>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <p className="text-sm font-light text-marca-noche/70">
            Iniciá sesión para armar tu colección
          </p>
          <GoogleLoginButton next="/coleccion" />
        </div>
      )}
    </main>
  );
}
