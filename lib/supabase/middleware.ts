import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideAccess, isAuthPath } from "@/lib/access/decide";
import { SESSION_EPOCH_COOKIE } from "@/lib/access/constants";
import { getAccessStateForMiddleware } from "@/lib/access/middleware-state";

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
  "/proximas",
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

// Copia las cookies de sesión refrescadas a una respuesta nueva (redirect o
// rewrite). Sin esto el usuario perdería la sesión refrescada.
function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
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

  // Estado de acceso (modo Abierto/Aviso/Cerrado y época de sesión), con
  // caché corta en memoria. null (falla la lectura) = se comporta como abierto.
  const accessState = await getAccessStateForMiddleware();

  // Perfil del usuario: una sola consulta para baneo e is_admin. Se salta en
  // el callback de autenticación, que todavía está creando la sesión.
  let bannedUntil: string | null = null;
  // null = no se pudo leer; con duda, un admin nunca queda bloqueado.
  let isAdmin: boolean | null = user ? null : false;
  if (user && !isAuthPath(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("banned_until, is_admin")
      .eq("id", user.id)
      .single();
    if (profile) {
      bannedUntil = profile.banned_until ?? null;
      isAdmin = Boolean(profile.is_admin);
    }
  }

  const decision = decideAccess({
    state: accessState,
    pathname,
    hasUser: Boolean(user),
    isAdmin,
    epochCookie: request.cookies.get(SESSION_EPOCH_COOKIE)?.value,
  });

  // Desconexión forzada: cierra la sesión de este navegador (scope local: no
  // toca las sesiones del jugador en otros dispositivos, que se revisan solos
  // con su propia cookie) y lo manda a la pantalla de entrada.
  if (decision === "logout") {
    await supabase.auth.signOut({ scope: "local" });
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    return copyCookies(supabaseResponse, NextResponse.redirect(redirectUrl));
  }

  // Modo Cerrado: la ruta pedida muestra la pantalla de aviso en vez de su
  // contenido, con o sin sesión. La URL no cambia y la sesión no se toca. El
  // header le avisa al layout raíz que no dibuje el menú ni los botones.
  if (decision === "blocked") {
    const headers = new Headers(request.headers);
    headers.set("x-access-blocked", "1");
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = "/aviso";
    rewriteUrl.search = "";
    return copyCookies(
      supabaseResponse,
      NextResponse.rewrite(rewriteUrl, { request: { headers } }),
    );
  }

  // Baneado: sin acceso a ninguna otra parte de la app (ni siquiera /admin)
  // salvo cerrar sesión. Se revalida también dentro de redeem_code/
  // create_trade/accept_trade/save_deck (public.is_banned) por si alguien
  // se salta esta pantalla llamando a la API directo.
  if (user && !isBanExempt(pathname) && bannedUntil) {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (todayStr < bannedUntil) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/baneado";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
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
