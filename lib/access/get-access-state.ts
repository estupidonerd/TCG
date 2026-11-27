import "server-only";
import { unstable_cache } from "next/cache";
import {
  ACCESS_STATE_TAG,
  ACCESS_STATE_TTL_SECONDS,
  OPEN_STATE,
  type AccessState,
} from "./constants";
import { fetchAccessState } from "./fetch-state";

// Para Server Components: el estado con caché de ~30 s que se invalida al
// instante cuando el admin guarda (revalidateTag(ACCESS_STATE_TAG)).
//
// Un fallo de lectura SE GUARDA como null (en vez de lanzar): si lanzara, Next
// seguiría sirviendo el último valor bueno -aunque fuera "cerrado"- mientras la
// lectura siga fallando, y las pantallas contradirían al middleware, que ante
// un fallo deja todo abierto. Con null, ambos coinciden: abierto, y se
// reintenta al vencer la caché.
const loadCached = unstable_cache(async () => fetchAccessState(), ["access-state"], {
  revalidate: ACCESS_STATE_TTL_SECONDS,
  tags: [ACCESS_STATE_TAG],
});

export async function getAccessState(): Promise<AccessState> {
  try {
    return (await loadCached()) ?? OPEN_STATE;
  } catch {
    return OPEN_STATE;
  }
}

// Lectura directa, sin caché: para fijar la cookie al iniciar sesión.
export async function getFreshAccessState(): Promise<AccessState | null> {
  return fetchAccessState();
}
