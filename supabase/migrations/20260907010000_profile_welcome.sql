-- ============================================================================
-- Bienvenida: profiles.has_seen_welcome controla si ya se le mostró al
-- jugador el modal de tres pasos la primera vez que entra a /coleccion.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.profiles
  add column has_seen_welcome boolean not null default false;

comment on column public.profiles.has_seen_welcome is
  'Si ya vio el modal de bienvenida (tres pasos) en /coleccion. Se marca true al cerrarlo.';

-- Mismo patrón que trade_default: GRANT es acumulativo, así que esto solo
-- suma la columna nueva a la lista que ya puede tocar el cliente, sin
-- reabrir is_admin ni ninguna otra.
grant update (has_seen_welcome) on public.profiles to authenticated;
