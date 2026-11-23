-- ============================================================================
-- RELOJ DE PRUEBAS -- permite adelantar la hora del juego SOLO en el
-- proyecto de Pruebas, para probar cosas que dependen de fechas (ventanas,
-- vencimientos, retos diarios) sin esperar días de verdad.
--
-- Todo aditivo: dos columnas nuevas en game_settings y dos funciones. No
-- renombra, elimina ni cambia el tipo de nada existente. No crea tablas
-- (por eso no hay GRANTs de tabla nuevos: game_settings ya tiene los suyos y
-- las columnas nuevas los heredan; el RLS de game_settings no cambia).
--
-- Seguros contra mover la hora en producción:
--   1. allow_test_clock es false por defecto. Solo se pone en true en
--      Pruebas, a mano, con:
--        update public.game_settings set allow_test_clock = true where id = true;
--   2. La pantalla del reloj (/admin/ajustes) solo aparece si la variable de
--      entorno NEXT_PUBLIC_APP_ENV vale "test".
--   3. game_now() ignora el desplazamiento si allow_test_clock es false, y
--      admin_set_test_clock() lanza un error en ese caso.
--
-- Regla de uso: toda función nueva que dependa de la hora usa game_now(),
-- nunca now(). Las funciones que ya existían (ventana de la votación, bans,
-- vencimiento de intercambios) siguen con now() y NO se ven afectadas por
-- este reloj hasta que se migren a game_now() en su propia migración.
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase
-- (primero en el proyecto de pruebas).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- game_settings: fila única con una columna por ajuste (misma estructura de
-- siempre, no clave/valor).
-- ----------------------------------------------------------------------------
alter table public.game_settings
  add column allow_test_clock boolean not null default false,
  add column test_clock_offset_minutes integer not null default 0
    constraint game_settings_test_clock_offset_range
    check (test_clock_offset_minutes between -2628000 and 2628000);

comment on column public.game_settings.allow_test_clock is
  'Interruptor del reloj de pruebas. false (por defecto) = game_now() devuelve now() exacto. Solo se pone en true a mano en el proyecto de Pruebas.';
comment on column public.game_settings.test_clock_offset_minutes is
  'Minutos que game_now() suma a now() cuando allow_test_clock es true (máximo +-5 años). Se cambia con admin_set_test_clock().';

-- ----------------------------------------------------------------------------
-- game_now(): la hora del juego. now() + desplazamiento, pero SOLO si el
-- reloj de pruebas está permitido; si no, now() exacto.
-- ----------------------------------------------------------------------------
create or replace function public.game_now()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select now() + coalesce(
    (
      select case
        when gs.allow_test_clock then make_interval(mins => gs.test_clock_offset_minutes)
      end
      from public.game_settings gs
      where gs.id = true
    ),
    interval '0'
  );
$$;

-- anon se revoca explícito: Supabase le da execute por defecto y `from public`
-- no se lo quita.
revoke all on function public.game_now() from public, anon;
grant execute on function public.game_now() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- admin_set_test_clock(p_offset_minutes): guarda el desplazamiento. Se llama
-- desde una Server Action con requireAdmin(), con service_role (como el resto
-- de funciones de admin). Devuelve la nueva hora simulada.
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_test_clock(p_offset_minutes int)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  select allow_test_clock
    into v_allowed
  from public.game_settings
  where id = true
  for update;

  if not coalesce(v_allowed, false) then
    raise exception 'El reloj de pruebas está desactivado en este entorno (allow_test_clock es false).';
  end if;

  if p_offset_minutes is null then
    raise exception 'Falta el desplazamiento en minutos.';
  end if;

  update public.game_settings
    set test_clock_offset_minutes = p_offset_minutes
  where id = true;

  return public.game_now();
end;
$$;

revoke all on function public.admin_set_test_clock(int) from public, anon, authenticated;
grant execute on function public.admin_set_test_clock(int) to service_role;

commit;

-- Recarga la caché de esquema de PostgREST para que vea las columnas y
-- funciones nuevas.
notify pgrst, 'reload schema';
