// Ventana de la votación "Próximas actualizaciones". Es el ÚNICO lugar del
// código de la app donde viven estas fechas: fuera de la ventana no se
// muestra nada (ni popup, ni ítem de menú, ni /proximas), pero nada se
// borra -- se apaga solo por fecha.
//
// OJO: save_vote_response (supabase/migrations/20260919000000_next_updates_vote.sql)
// lleva las mismas dos fechas en constantes propias, porque SQL no puede
// leer este archivo. Si las cambias acá, cámbialas también ahí.
//
// Ambas fechas son días calendario en hora de Madrid (Europe/Madrid):
// VOTE_START cuenta desde las 00:00 de ese día y VOTE_END es inclusiva
// hasta las 23:59.
export const VOTE_START = "2026-11-22";
export const VOTE_END = "2026-11-30";
export const VOTE_TIME_ZONE = "Europe/Madrid";

// Fecha de hoy (YYYY-MM-DD) en hora de Madrid. 'en-CA' formatea ya como
// año-mes-día, y comparar esos strings equivale a comparar fechas.
export function madridToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VOTE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isVoteOpen(now: Date = new Date()): boolean {
  const today = madridToday(now);
  return today >= VOTE_START && today <= VOTE_END;
}

// "30 de noviembre", para el texto "puedes cambiar tu orden hasta el ...".
export const VOTE_END_LABEL = new Date(`${VOTE_END}T12:00:00Z`).toLocaleDateString("es-CO", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
