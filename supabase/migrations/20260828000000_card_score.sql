-- ============================================================================
-- Puntaje (score): un número nuevo, independiente de power, que reemplaza a
-- Poder SOLO en lo que ve el jugador. power se sigue cargando desde el
-- admin pero queda oculto para el jugador (lo sigue leyendo el motor del
-- juego a futuro). score es opcional: si una carta no lo tiene, la UI del
-- jugador muestra "SP".
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.cards add column score integer check (score between 0 and 10);

comment on column public.cards.score is
  'Puntaje que ve el jugador (reemplaza a power en la UI). Opcional: si es null, se muestra "SP".';

comment on column public.cards.power is
  'Oculto para el jugador. Se sigue cargando desde /admin/cards, pero la UI del jugador muestra score (Puntaje), no power.';
