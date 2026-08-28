-- ============================================================================
-- Puntaje admite decimales (ej. 7.8), no solo enteros. Cambia el tipo de
-- score de integer a numeric(3,1) -- el CHECK (score between 0 and 10) que
-- ya tenía se sigue aplicando tal cual, Postgres lo revalida solo al
-- cambiar el tipo de columna.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.cards
  alter column score type numeric(3, 1) using score::numeric(3, 1);

comment on column public.cards.score is
  'Puntaje que ve el jugador (reemplaza a power en la UI). Decimal, ej. 7.8. Opcional: si es null, se muestra "SP".';
