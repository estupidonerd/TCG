// Constantes y tipos del sistema de acceso y aviso (cerrar el juego con un
// cartel y desconectar a todos los jugadores). Sin dependencias: lo importan
// el middleware, el servidor y el navegador.

export type AccessMode = "open" | "notice" | "closed";

export const ACCESS_MODES: readonly AccessMode[] = ["open", "notice", "closed"];

export type AccessState = {
  access_mode: AccessMode;
  notice_title: string | null;
  notice_body: string | null;
  notice_text_color: string;
  notice_return_text: string | null;
  session_epoch: number;
};

// Si la lectura del estado falla (red, base de datos, migración sin correr),
// el juego se comporta como abierto. Nunca se deja a todos bloqueados por un
// fallo.
export const OPEN_STATE: AccessState = {
  access_mode: "open",
  notice_title: null,
  notice_body: null,
  notice_text_color: "#FFFFFF",
  notice_return_text: null,
  session_epoch: 0,
};

// Cookie httpOnly con el session_epoch vigente al momento de iniciar sesión.
export const SESSION_EPOCH_COOKIE = "tcg_session_epoch";

// Etiqueta de la caché de Next (Server Components) del estado de acceso.
export const ACCESS_STATE_TAG = "access-state";

// Cuánto dura la caché corta del estado, en segundos.
export const ACCESS_STATE_TTL_SECONDS = 30;

// Textos de respaldo cuando el admin deja el cartel sin escribir.
export const DEFAULT_NOTICE_TITLE = "Volvemos pronto";
export const DEFAULT_NOTICE_BODY = "Estamos haciendo ajustes en el juego.";

export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

// Límites de los textos del cartel (los valida la Server Action).
export const NOTICE_TITLE_MAX = 120;
export const NOTICE_BODY_MAX = 1000;
export const NOTICE_RETURN_MAX = 160;
