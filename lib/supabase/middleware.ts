import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que requieren sesión iniciada. Si no hay usuario, se redirige a /login
// preservando la ruta original en ?next= para volver ahí después de loguear.
const PROTECTED_PATHS = ["/coleccion", "/canjear", "/intercambios", "/imprimir", "/contactos"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No poner lógica entre createServerClient() y getUser(): getUser()
  // revalida el token contra el servidor de Supabase (a diferencia de
  // getSession(), que solo lee la cookie local) y además dispara el
  // refresh automático del token cuando está por vencer.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // IMPORTANTE: hay que devolver supabaseResponse tal cual (o clonando sus
  // cookies a la respuesta nueva). Si se crea un NextResponse desde cero acá,
  // se pierden las cookies de sesión refrescadas y el usuario se desloguea.
  return supabaseResponse;
}
