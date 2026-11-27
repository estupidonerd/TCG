-- ============================================================================
-- PORTADAS DE TEMPORADA -- imagen de fondo y texto personalizado para la
-- pantalla de entrada (la que ven quienes no han iniciado sesión).
--
-- Todo aditivo: una tabla nueva y una función. No renombra ni cambia nada
-- existente, no toca ninguna función sensible ni ninguna política RLS.
--
-- Quién escribe: solo el admin, con service_role desde /admin/portada (Server
-- Actions con requireAdmin). Nadie lee ni escribe la tabla directo desde el
-- navegador: RLS activado, sin ninguna política, y GRANTs solo para
-- service_role.
--
-- Quién lee: get_active_splash() devuelve solo la portada que corresponde
-- mostrar hoy y solo los campos necesarios para dibujarla (no el nombre
-- interno, ni las fechas, ni is_active). La pueden llamar anon y
-- authenticated, porque la pantalla de entrada la necesita sin sesión.
--
-- La hora se toma de game_now() (regla del proyecto: nada que dependa de la
-- hora usa now() directo). En producción game_now() es exactamente now(); en
-- Pruebas se puede adelantar con el reloj de pruebas para ensayar fechas.
--
-- Las imágenes viven en Storage (bucket público card-images, carpeta
-- splash/); acá solo se guarda su URL pública en image_url.
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase
-- (primero en el proyecto de pruebas).
-- ============================================================================

begin;

create table public.splash_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  image_url text,
  focus_x integer not null default 50 check (focus_x between 0 and 100),
  focus_y integer not null default 50 check (focus_y between 0 and 100),
  overlay_opacity integer not null default 35 check (overlay_opacity between 0 and 80),
  title text,
  body text,
  text_color text not null default '#FFFFFF' check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint splash_themes_dates_order check (starts_at is null or ends_at is null or ends_at >= starts_at)
);

comment on table public.splash_themes is
  'Portadas de temporada de la pantalla de entrada. Solo service_role (admin); el público las lee con get_active_splash().';
comment on column public.splash_themes.image_url is 'URL pública de la imagen en Storage (bucket card-images, carpeta splash/). Opcional.';
comment on column public.splash_themes.focus_x is 'Punto de enfoque horizontal, 0-100: qué parte queda centrada al recortar la imagen.';
comment on column public.splash_themes.focus_y is 'Punto de enfoque vertical, 0-100.';
comment on column public.splash_themes.overlay_opacity is 'Oscurecido de la imagen, 0-80 (porcentaje).';
comment on column public.splash_themes.text_color is 'Color del título y el texto, formato #rrggbb.';
comment on column public.splash_themes.starts_at is 'Desde cuándo se muestra. Nulo = sin fecha de inicio.';
comment on column public.splash_themes.ends_at is 'Hasta cuándo se muestra. Nulo = sin fecha de fin.';

-- Para la consulta de get_active_splash() y para el orden de la lista.
create index idx_splash_themes_active on public.splash_themes (is_active, starts_at desc);

-- ----------------------------------------------------------------------------
-- RLS: activado y SIN políticas a propósito. Nadie (salvo service_role, que
-- siempre se salta el RLS) lee ni escribe esta tabla.
-- ----------------------------------------------------------------------------
alter table public.splash_themes enable row level security;

-- ----------------------------------------------------------------------------
-- GRANTs explícitos (Supabase deja de dar acceso automático a tablas nuevas de
-- public desde el 30 de octubre de 2026): primero se revoca todo, y después se
-- concede el mínimo -- solo service_role.
-- ----------------------------------------------------------------------------
revoke all on table public.splash_themes from anon, authenticated;
grant all on table public.splash_themes to service_role;

-- ----------------------------------------------------------------------------
-- get_active_splash(): la portada que corresponde mostrar ahora, o ninguna.
-- Activa (is_active), ya empezó (starts_at nulo o <= ahora) y no terminó
-- (ends_at nulo o >= ahora). Si hay varias, gana la de starts_at más reciente
-- (las que no tienen fecha de inicio van al final; empate: la más nueva).
-- ----------------------------------------------------------------------------
create or replace function public.get_active_splash()
returns table (
  image_url text,
  focus_x integer,
  focus_y integer,
  overlay_opacity integer,
  title text,
  body text,
  text_color text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.image_url,
    s.focus_x,
    s.focus_y,
    s.overlay_opacity,
    s.title,
    s.body,
    s.text_color
  from public.splash_themes s
  where s.is_active
    and (s.starts_at is null or s.starts_at <= public.game_now())
    and (s.ends_at is null or s.ends_at >= public.game_now())
  order by s.starts_at desc nulls last, s.created_at desc
  limit 1;
$$;

revoke all on function public.get_active_splash() from public;
grant execute on function public.get_active_splash() to anon, authenticated, service_role;

commit;

-- Recarga la caché de esquema de PostgREST para que vea la tabla y la función.
notify pgrst, 'reload schema';
