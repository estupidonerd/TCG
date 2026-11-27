-- ============================================================================
-- ACCESO Y AVISO -- permite cerrar el juego temporalmente mostrando un cartel,
-- y desconectar a todos los jugadores.
--
-- Todo aditivo: seis columnas nuevas en game_settings y una función. No crea
-- tablas, no renombra ni cambia el tipo de nada existente, no toca ninguna
-- función sensible (redeem_code, accept_trade, create_trade, save_deck,
-- handle_new_user...) ni ninguna política RLS.
--
-- game_settings es una fila única con una columna por ajuste; esto sigue ese
-- mismo patrón.
--
--   access_mode        'open' (todo normal), 'notice' (cartel en la pantalla
--                      de entrada, el login funciona) o 'closed' (el juego
--                      muestra el cartel y el login se oculta).
--   notice_title/body  texto del cartel.
--   notice_text_color  color del texto del cartel (#rrggbb).
--   notice_return_text algo como "Volvemos aproximadamente el 2 de diciembre".
--   session_epoch      contador de "desconexión forzada": al subirlo en 1,
--                      todo jugador cuya cookie guarde un valor menor vuelve a
--                      iniciar sesión. No usa ni modifica nada del esquema auth.
--
-- Quién escribe: solo el admin, con service_role desde /admin/portada (Server
-- Action con requireAdmin). Nadie más tiene política de UPDATE sobre
-- game_settings.
--
-- Quién lee: get_public_access_state() devuelve SOLO estos seis campos y la
-- pueden llamar anon y authenticated (la pantalla de entrada la necesita sin
-- sesión). Ojo: game_settings ya era de lectura pública por una política que
-- existía antes (game_settings_select_public), así que las columnas nuevas
-- también se pueden leer con un select directo. No es un problema -- el cartel
-- es público por naturaleza y session_epoch es solo un número -- y esta
-- migración no cambia esa política a propósito.
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase
-- (primero en el proyecto de pruebas).
-- ============================================================================

begin;

alter table public.game_settings
  add column access_mode text not null default 'open'
    constraint game_settings_access_mode_valid check (access_mode in ('open', 'notice', 'closed')),
  add column notice_title text,
  add column notice_body text,
  add column notice_text_color text not null default '#FFFFFF'
    constraint game_settings_notice_text_color_hex check (notice_text_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column notice_return_text text,
  add column session_epoch integer not null default 0
    constraint game_settings_session_epoch_nonneg check (session_epoch >= 0);

comment on column public.game_settings.access_mode is
  'Modo de acceso: open (normal), notice (cartel en la pantalla de entrada) o closed (juego cerrado con cartel). Los admins nunca quedan bloqueados.';
comment on column public.game_settings.notice_title is 'Título del cartel de aviso.';
comment on column public.game_settings.notice_body is 'Texto del cartel de aviso.';
comment on column public.game_settings.notice_text_color is 'Color del texto del cartel, formato #rrggbb.';
comment on column public.game_settings.notice_return_text is 'Línea opcional del cartel, por ejemplo "Volvemos aproximadamente el 2 de diciembre".';
comment on column public.game_settings.session_epoch is
  'Contador de desconexión forzada. Al subirlo en 1, los jugadores cuya cookie tenga un valor menor tienen que volver a iniciar sesión. Los admins quedan exentos.';

-- ----------------------------------------------------------------------------
-- get_public_access_state(): solo los seis campos, nada más de game_settings.
-- ----------------------------------------------------------------------------
create or replace function public.get_public_access_state()
returns table (
  access_mode text,
  notice_title text,
  notice_body text,
  notice_text_color text,
  notice_return_text text,
  session_epoch integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    gs.access_mode,
    gs.notice_title,
    gs.notice_body,
    gs.notice_text_color,
    gs.notice_return_text,
    gs.session_epoch
  from public.game_settings gs
  where gs.id = true;
$$;

revoke all on function public.get_public_access_state() from public;
grant execute on function public.get_public_access_state() to anon, authenticated, service_role;

commit;

-- Recarga la caché de esquema de PostgREST para que vea la función y las
-- columnas nuevas.
notify pgrst, 'reload schema';
