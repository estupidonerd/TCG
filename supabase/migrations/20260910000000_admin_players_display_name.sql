-- ============================================================================
-- /admin/usuarios mostraba el player_code dos veces (como "nombre" y como
-- código): leía profiles.display_name directo, que queda vacío para casi
-- todos los usuarios (el trigger handle_new_user busca la clave
-- 'display_name' en raw_user_meta_data, pero Google manda 'full_name'/
-- 'name' -- mismo problema que ya se resolvió para get_public_profiles/
-- find_profile_by_code en public_profile_names.sql, ahora para el panel
-- de admin).
--
-- admin_list_players() resuelve el nombre real igual que esas dos
-- funciones (coalesce con raw_user_meta_data), y de paso expone is_admin/
-- banned_until -- seguro porque nunca se otorga a authenticated, solo a
-- service_role.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.admin_list_players()
returns table (
  id uuid,
  display_name text,
  player_code text,
  avatar_url text,
  is_admin boolean,
  banned_until date,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(
      p.display_name,
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name'
    ) as display_name,
    p.player_code,
    p.avatar_url,
    p.is_admin,
    p.banned_until,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
$$;

revoke all on function public.admin_list_players() from public;
grant execute on function public.admin_list_players() to service_role;
