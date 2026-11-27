import type { SplashTheme } from "./types";

// Misma regla que get_active_splash() en la base, para poder marcar en la
// lista cuál es la que se está mostrando ahora: activa, ya empezó, no terminó;
// si hay varias, la de starts_at más reciente (sin fecha de inicio va al
// final; empate: la creada más tarde).
export function pickActiveSplash<T extends Pick<SplashTheme, "is_active" | "starts_at" | "ends_at" | "created_at">>(
  themes: T[],
  now: Date,
): T | null {
  const time = now.getTime();
  const candidates = themes.filter(
    (theme) =>
      theme.is_active &&
      (theme.starts_at === null || new Date(theme.starts_at).getTime() <= time) &&
      (theme.ends_at === null || new Date(theme.ends_at).getTime() >= time),
  );
  candidates.sort((a, b) => {
    const aStart = a.starts_at === null ? -Infinity : new Date(a.starts_at).getTime();
    const bStart = b.starts_at === null ? -Infinity : new Date(b.starts_at).getTime();
    if (aStart !== bStart) return bStart - aStart;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return candidates[0] ?? null;
}

export type SplashStatus = "showing" | "scheduled" | "expired" | "inactive" | "waiting";

// Estado para la etiqueta de la lista. "waiting" = activa y en fechas, pero hay
// otra con starts_at más reciente que es la que gana.
export function splashStatus(
  theme: Pick<SplashTheme, "is_active" | "starts_at" | "ends_at">,
  now: Date,
  isShowing: boolean,
): SplashStatus {
  if (!theme.is_active) return "inactive";
  const time = now.getTime();
  if (theme.starts_at !== null && new Date(theme.starts_at).getTime() > time) return "scheduled";
  if (theme.ends_at !== null && new Date(theme.ends_at).getTime() < time) return "expired";
  return isShowing ? "showing" : "waiting";
}
