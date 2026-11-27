import { HEX_COLOR_PATTERN } from "../access/constants";
import type { PublicSplash } from "./types";

// Lee get_active_splash() con la clave anon (sin sesión: la función es pública)
// directo por la API REST de Supabase. Devuelve null ante CUALQUIER fallo o si
// no hay ninguna portada vigente: en ambos casos la pantalla de entrada queda
// exactamente como siempre.
export async function fetchActiveSplash(): Promise<PublicSplash | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const response = await fetch(`${url}/rest/v1/rpc/get_active_splash`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    return parsePublicSplash(await response.json());
  } catch {
    return null;
  }
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

// La función devuelve una tabla: PostgREST la entrega como arreglo de filas
// (vacío si no hay portada).
export function parsePublicSplash(raw: unknown): PublicSplash | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const data = row as Record<string, unknown>;

  return {
    image_url: textOrNull(data.image_url),
    focus_x: clampInt(data.focus_x, 0, 100, 50),
    focus_y: clampInt(data.focus_y, 0, 100, 50),
    overlay_opacity: clampInt(data.overlay_opacity, 0, 80, 35),
    title: textOrNull(data.title),
    body: textOrNull(data.body),
    text_color:
      typeof data.text_color === "string" && HEX_COLOR_PATTERN.test(data.text_color)
        ? data.text_color
        : "#FFFFFF",
  };
}
