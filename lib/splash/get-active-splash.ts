import "server-only";
import { unstable_cache } from "next/cache";
import { fetchActiveSplash } from "./fetch-splash";
import { SPLASH_TAG, SPLASH_TTL_SECONDS, type PublicSplash } from "./types";

// La portada activa con caché de ~30 s, que se invalida al instante cuando el
// admin guarda (revalidateTag(SPLASH_TAG)). "Ninguna portada" y "falló la
// lectura" se guardan igual como null (mismo criterio que el estado de acceso):
// la pantalla queda como siempre y se reintenta al vencer la caché.
const loadCached = unstable_cache(async () => fetchActiveSplash(), ["active-splash"], {
  revalidate: SPLASH_TTL_SECONDS,
  tags: [SPLASH_TAG],
});

export async function getActiveSplash(): Promise<PublicSplash | null> {
  try {
    return (await loadCached()) ?? null;
  } catch {
    return null;
  }
}
