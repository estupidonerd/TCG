// Tipos y constantes de las portadas de temporada (fondo y texto de la
// pantalla de entrada). Sin dependencias: sirven en servidor y navegador.

// Lo que necesita la pantalla de entrada para dibujar la portada: es
// exactamente lo que devuelve get_active_splash().
export type PublicSplash = {
  image_url: string | null;
  focus_x: number;
  focus_y: number;
  overlay_opacity: number;
  title: string | null;
  body: string | null;
  text_color: string;
};

// La fila completa, para el panel de admin.
export type SplashTheme = PublicSplash & {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const SPLASH_TAG = "splash";
// Cuánto dura la caché corta de la portada activa, en segundos. Las fechas de
// inicio y fin se evalúan en la base, así que esto es también el retraso
// máximo con el que una portada programada empieza o termina.
export const SPLASH_TTL_SECONDS = 30;

// Storage: mismo bucket público que usa el resto del admin, carpeta propia.
export const SPLASH_BUCKET = "card-images";
export const SPLASH_FOLDER = "splash";
// Cabecera de caché larga (un año): cada archivo tiene un nombre único, así que
// nunca cambia de contenido y el navegador puede guardarlo.
export const SPLASH_CACHE_CONTROL = "31536000";

export const SPLASH_ALLOWED_MIME = ["image/webp", "image/jpeg", "image/png"] as const;
export const SPLASH_MAX_BYTES = 1024 * 1024; // 1 MB, tope duro
export const SPLASH_RECOMMENDED_BYTES = 500 * 1024; // aviso por encima de 500 KB

export const SPLASH_NAME_MAX = 80;
export const SPLASH_TITLE_MAX = 120;
export const SPLASH_BODY_MAX = 500;
export const SPLASH_OVERLAY_MAX = 80;
export const SPLASH_DEFAULT_COLOR = "#FFFFFF";

export function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

// Mensaje de aviso si la imagen supera lo recomendado; null si está bien.
export function weightWarning(bytes: number): string | null {
  if (bytes <= SPLASH_RECOMMENDED_BYTES) return null;
  return `Esta imagen pesa ${formatKb(bytes)}; se recomienda WebP de menos de 500 KB`;
}

// De la URL pública de Storage saca la ruta dentro del bucket, pero SOLO si
// está en la carpeta splash/ (para no poder borrar nunca nada de otro lado).
export function splashPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${SPLASH_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
  return path.startsWith(`${SPLASH_FOLDER}/`) && !path.includes("..") ? path : null;
}
