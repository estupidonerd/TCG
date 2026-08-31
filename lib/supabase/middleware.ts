import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que requieren sesión iniciada. Si no hay usuario, se redirige a /login
// preservando la ruta original en ?next= para volver ahí después de loguear.
const PROTECTED_PATHS = [
  "/coleccion",
  "/canjear",
  "/intercambios",
  "/imprimir",
  "/contactos",
  "/mazos",
  "/duelos",
  "/cuenta",
  "/ajustes",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// Rutas que un usuario baneado (o cualquiera) tiene que poder seguir
// pisando sin quedar atrapado en un loop de redirects hacia /baneado.
const BAN_EXEMPT_PATHS = ["/baneado", "/login", "/auth/callback"];

function isBanExempt(pathname: string) {
  return BAN_EXEMPT_PATHS.some(
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

  // Baneado: sin acceso a ninguna otra parte de la app (ni siquiera /admin)
  // salvo cerrar sesión. Se revalida también dentro de redeem_code/
  // create_trade/accept_trade/save_deck (public.is_banned) por si alguien
  // se salta esta pantalla llamando a la API directo.
  if (user && !isBanExempt(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("banned_until")
      .eq("id", user.id)
      .single();

    if (profile?.banned_until) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (todayStr < profile.banned_until) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/baneado";
        redirectUrl.search = "";
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

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
