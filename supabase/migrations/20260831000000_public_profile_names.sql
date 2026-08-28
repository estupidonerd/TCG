-- ============================================================================
-- profiles.display_name queda vacío para casi todos los usuarios: el
-- trigger handle_new_user() (migración inicial) busca la clave
-- 'display_name' en raw_user_meta_data, pero el login de Google en
-- realidad manda 'full_name' (y a veces 'name'). Por eso el propio usuario
-- SÍ ve su nombre en el menú (esa parte del código ya usa
-- user.user_metadata.full_name como respaldo, ver components/auth/
-- user-menu.tsx), pero para looks de OTROS usuarios no había forma de leer
-- eso desde el cliente: raw_user_meta_data vive en auth.users, no
-- accesible para un usuario cualquiera.
--
-- Estas dos funciones ya son security definer (corren con permisos
-- elevados), así que sí pueden hacer join contra auth.users para resolver
-- el nombre real -- exponiendo únicamente el nombre, nunca el email ni
-- nada más de esa tabla. No se toca el trigger ni se hace backfill de
-- profiles.display_name: se resuelve al vuelo en cada lectura.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.find_profile_by_code(p_code text)
returns table (id uuid, display_name text, player_code text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    coalesce(
      p.display_name,
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name'
    ) as display_name,
    p.player_code,
    p.avatar_url
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.player_code = upper(trim(p_code));
$$;

revoke all on function public.find_profile_by_code(text) from public;
grant execute on function public.find_profile_by_code(text) to authenticated;


create or replace function public.get_public_profiles(p_user_ids uuid[])
returns table (id uuid, display_name text, player_code text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    coalesce(
      p.display_name,
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name'
    ) as display_name,
    p.player_code,
    p.avatar_url
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = any(p_user_ids);
$$;

revoke all on function public.get_public_profiles(uuid[]) from public;
grant execute on function public.get_public_profiles(uuid[]) to authenticated;
