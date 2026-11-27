// Decisión de acceso, como función pura: sin red, sin cookies, sin Next. Así
// se puede probar entera. Solo importa tipos y constantes de este mismo
// directorio (rutas relativas).
import type { AccessState } from "./constants";

// Rutas que NUNCA se bloquean por el modo Cerrado: el panel de admin, la
// pantalla de entrada, el acceso del equipo, las rutas de autenticación, la
// propia pantalla de aviso y los archivos que el navegador pide solo (icono,
// manifiesto...), para que no se rompan mientras el juego está cerrado.
const ACCESS_EXEMPT_PATHS = [
  "/admin",
  "/login",
  "/acceso-equipo",
  "/auth",
  "/aviso",
  "/manifest.webmanifest",
  "/icon",
  "/icons",
  "/apple-icon",
  "/opengraph-image",
  "/robots.txt",
  "/sitemap.xml",
];

export function isAccessExempt(pathname: string): boolean {
  return ACCESS_EXEMPT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

// El callback de autenticación fija la cookie de época; nunca se toca ahí.
export function isAuthPath(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

// Una cookie ausente o ilegible cuenta como 0.
export function parseEpochCookie(value: string | undefined | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export type AccessDecision = "allow" | "blocked" | "logout";

export function decideAccess(input: {
  // null = no se pudo leer el estado: se comporta como abierto.
  state: AccessState | null;
  pathname: string;
  hasUser: boolean;
  // null = no se pudo leer el perfil (o no hay usuario). Con duda NO se
  // bloquea ni se desconecta a nadie: un admin nunca puede quedar afuera.
  isAdmin: boolean | null;
  epochCookie: string | undefined | null;
}): AccessDecision {
  const { state, pathname, hasUser, isAdmin, epochCookie } = input;
  if (!state) return "allow";
  if (hasUser && isAdmin === null) return "allow";
  if (isAdmin === true) return "allow";

  // Desconexión forzada: jugador (no admin) con una cookie de una época
  // anterior. Aplica en cualquier ruta salvo las de autenticación.
  if (hasUser && !isAuthPath(pathname) && parseEpochCookie(epochCookie) < state.session_epoch) {
    return "logout";
  }

  // Modo Cerrado: todo lo que no sea una ruta exenta muestra el aviso, con o
  // sin sesión.
  if (state.access_mode === "closed" && !isAccessExempt(pathname)) {
    return "blocked";
  }

  return "allow";
}
