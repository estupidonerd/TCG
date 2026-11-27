import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";
import { getFreshAccessState } from "@/lib/access/get-access-state";
import { SESSION_EPOCH_COOKIE } from "@/lib/access/constants";

// Supabase redirige acá después del login con Google, con un ?code= en la
// URL. Este handler lo intercambia por una sesión (guardada en cookies) y
// después redirige a donde el usuario quería ir originalmente.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Si hay un proxy/load balancer delante de Next (típico en producción,
      // ej. Vercel detrás de un dominio propio), origin puede no ser el host
      // público real, así que se usa x-forwarded-host cuando está presente.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      let destination = `${origin}${next}`;
      if (!isLocalEnv && forwardedHost) {
        destination = `https://${forwardedHost}${next}`;
      }
      const response = NextResponse.redirect(destination);

      // Desconexión forzada: se guarda la época de sesión vigente en una
      // cookie httpOnly. Si más adelante el admin la sube, el middleware ve
      // que esta cookie quedó atrás y pide iniciar sesión de nuevo. Si no se
      // pudo leer la época, no se pone la cookie (cuenta como 0).
      const access = await getFreshAccessState();
      if (access) {
        response.cookies.set(SESSION_EPOCH_COOKIE, String(access.session_epoch), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
        });
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
