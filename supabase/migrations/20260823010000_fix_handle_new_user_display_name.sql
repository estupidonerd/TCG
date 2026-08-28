-- ============================================================================
-- Fix: el trigger handle_new_user() (creado en 20260823000000_initial_schema)
-- buscaba raw_user_meta_data->>'display_name', pero el login con Google (vía
-- Supabase Auth) no manda esa clave: manda 'full_name' y/o 'name'. Como
-- resultado, todo usuario que entrara con Google quedaba con display_name
-- NULL en profiles. Este fix agrega esos fallbacks.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, player_code)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    public.generate_player_code()
  );

  return new;
end;
$$;
