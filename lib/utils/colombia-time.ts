// Las fechas de las portadas de temporada se escriben y se muestran en hora de
// Colombia (America/Bogota), que es la hora que manda en el proyecto. Siempre se
// calcula con esa zona, nunca con la del navegador ni la del servidor.
//
// Los campos son de DÍA (<input type="date">, texto "2026-12-24"):
//   - el inicio cuenta desde las 00:00 de ese día;
//   - el fin cuenta el día completo, hasta las 23:59:59.999 de ese día.
// Colombia no tiene horario de verano (siempre UTC-5), pero la conversión usa
// Intl igual, para no depender de ese dato.
export const COLOMBIA_TIME_ZONE = "America/Bogota";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: COLOMBIA_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parts(date: Date) {
  const map: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return map;
}

// Cuántos minutos va Colombia por delante de UTC en ese instante (-300).
function offsetMinutes(date: Date): number {
  const whole = new Date(Math.floor(date.getTime() / 1000) * 1000);
  const p = parts(whole);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - whole.getTime()) / 60000);
}

// "2026-12-24" -> [2026, 12, 24], o null si no es una fecha de calendario real
// (por ejemplo, 2026-02-31).
function parseDay(day: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!match) return null;
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, date));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) {
    return null;
  }
  return [year, month, date];
}

// Un reloj de pared de Colombia (año, mes, día, hora, minuto, segundo, ms) ->
// instante real en ISO (UTC).
function colombiaWallToIso(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  ms: number,
): string {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const guess = new Date(asUtc - offsetMinutes(new Date(asUtc)) * 60000);
  return new Date(asUtc - offsetMinutes(guess) * 60000).toISOString();
}

// Inicio de una portada: las 00:00:00 de ese día en Colombia. null si el texto
// no es una fecha válida.
export function colombiaDayStartIso(day: string): string | null {
  const p = parseDay(day);
  return p ? colombiaWallToIso(p[0], p[1], p[2], 0, 0, 0, 0) : null;
}

// Fin de una portada: las 23:59:59.999 de ese día en Colombia (el día cuenta
// completo). null si el texto no es una fecha válida.
export function colombiaDayEndIso(day: string): string | null {
  const p = parseDay(day);
  return p ? colombiaWallToIso(p[0], p[1], p[2], 23, 59, 59, 999) : null;
}

// Un instante ISO -> el día ("2026-12-24") que es en Colombia, para rellenar el
// campo de fecha. Vacío si no hay fecha.
export function isoToColombiaDay(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = parts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

// Para mostrar en la lista: "24 dic 2026".
export function formatColombiaDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", {
    timeZone: COLOMBIA_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
