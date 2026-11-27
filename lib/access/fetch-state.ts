import { ACCESS_MODES, HEX_COLOR_PATTERN, type AccessMode, type AccessState } from "./constants";

// Lee get_public_access_state() con la clave anon (sin sesión: la función es
// pública) directo por la API REST de Supabase. Sirve igual en el middleware
// (Edge) que en el servidor. Devuelve null ante CUALQUIER fallo -- red,
// tiempo agotado, la función todavía no existe, datos raros -- y quien la usa
// trata null como "abierto".
export async function fetchAccessState(): Promise<AccessState | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const response = await fetch(`${url}/rest/v1/rpc/get_public_access_state`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
      // Una base lenta no puede colgar cada petición del sitio.
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    return parseAccessState(await response.json());
  } catch {
    return null;
  }
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

// La función devuelve una tabla: PostgREST la entrega como arreglo de filas.
export function parseAccessState(raw: unknown): AccessState | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const data = row as Record<string, unknown>;

  const mode = data.access_mode;
  if (typeof mode !== "string" || !ACCESS_MODES.includes(mode as AccessMode)) return null;

  const epoch = Number(data.session_epoch);
  if (!Number.isInteger(epoch) || epoch < 0) return null;

  const color =
    typeof data.notice_text_color === "string" && HEX_COLOR_PATTERN.test(data.notice_text_color)
      ? data.notice_text_color
      : "#FFFFFF";

  return {
    access_mode: mode as AccessMode,
    notice_title: textOrNull(data.notice_title),
    notice_body: textOrNull(data.notice_body),
    notice_text_color: color,
    notice_return_text: textOrNull(data.notice_return_text),
    session_epoch: epoch,
  };
}
