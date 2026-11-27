import { ACCESS_STATE_TTL_SECONDS, type AccessState } from "./constants";
import { fetchAccessState } from "./fetch-state";

// Caché corta EN MEMORIA para el middleware (que corre en Edge y no puede usar
// la caché de datos de Next). Cada instancia guarda el estado ~30 s, así el
// middleware no consulta la base en cada petición.
//
// Si la lectura falla se guarda el fallo solo unos segundos: el juego queda
// abierto (null) y se reintenta pronto.
let cached: { at: number; state: AccessState | null } | null = null;
const FAILURE_TTL_MS = 5_000;

export async function getAccessStateForMiddleware(): Promise<AccessState | null> {
  const now = Date.now();
  if (cached) {
    const ttl = cached.state ? ACCESS_STATE_TTL_SECONDS * 1000 : FAILURE_TTL_MS;
    if (now - cached.at < ttl) return cached.state;
  }
  const state = await fetchAccessState();
  cached = { at: now, state };
  return state;
}
