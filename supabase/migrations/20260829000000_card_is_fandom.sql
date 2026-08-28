-- ============================================================================
-- El detalle de carta para el jugador tiene que indicar si la habilidad de
-- Género que se muestra es la Base o la Fandom -- hasta ahora no había en
-- el modelo ningún dato por carta que dijera cuál de las dos aplica (por
-- eso el preview de /admin/cards mostraba las dos). Se agrega ese flag.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.cards add column is_fandom boolean not null default false;

comment on column public.cards.is_fandom is
  'Si es true, la carta muestra la habilidad Fandom del género; si es false, la Base.';
