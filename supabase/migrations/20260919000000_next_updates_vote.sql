-- ============================================================================
-- VOTACIÓN "PRÓXIMAS ACTUALIZACIONES" (beta) -- los testers ordenan qué
-- mejoras les parecen más importantes.
--
-- Todo aditivo: dos tablas nuevas y una función. No renombra, elimina ni
-- cambia el tipo de ninguna columna existente.
--
-- Nadie escribe directo: vote_responses solo se escribe vía
-- save_vote_response (SECURITY DEFINER), que valida la ventana de fechas y
-- el contenido del ranking. vote_options solo la edita el admin con
-- service_role desde /admin/votos.
--
-- Ventana de votación: 2026-11-22 a 2026-11-30 (ambas inclusive) en hora de
-- Madrid. Las mismas fechas viven en lib/config/vote.ts -- si cambian,
-- cambiarlas en los dos lugares.
--
-- GRANTs explícitos (Supabase deja de dar acceso automático a tablas nuevas
-- de public desde el 30 de octubre de 2026): primero se revoca todo para no
-- depender de los permisos automáticos que aún pueda haber, y después se
-- concede el mínimo.
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase
-- (primero en el proyecto de pruebas).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- vote_options: las ideas entre las que se ordena.
-- ----------------------------------------------------------------------------
create table public.vote_options (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label text not null check (length(trim(label)) > 0),
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

comment on table public.vote_options is
  'Ideas de próximas actualizaciones que los jugadores ordenan. Se editan desde /admin/votos (service_role).';
comment on column public.vote_options.description is 'Una línea que explica la idea.';

create index idx_vote_options_sort_order on public.vote_options (sort_order);

-- ----------------------------------------------------------------------------
-- vote_responses: una respuesta por jugador.
-- ----------------------------------------------------------------------------
create table public.vote_responses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ranking jsonb not null check (jsonb_typeof(ranking) = 'array'),
  other_text text check (other_text is null or char_length(other_text) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vote_responses is
  'Respuesta de cada jugador a la votación de próximas actualizaciones. Una sola por jugador (user_id es la clave primaria). Solo se escribe vía save_vote_response.';
comment on column public.vote_responses.ranking is
  'Arreglo ordenado de slugs de vote_options, del más al menos importante.';
comment on column public.vote_responses.other_text is
  'Idea libre del jugador, opcional, máximo 500 caracteres.';

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.vote_options enable row level security;
alter table public.vote_responses enable row level security;

create policy vote_options_select_authenticated
  on public.vote_options for select
  to authenticated
  using (true);

create policy vote_responses_select_own
  on public.vote_responses for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Sin policies de INSERT/UPDATE/DELETE a propósito: nadie escribe directo.

-- ----------------------------------------------------------------------------
-- GRANTs
-- ----------------------------------------------------------------------------
revoke all on table public.vote_options from anon, authenticated;
revoke all on table public.vote_responses from anon, authenticated;

grant select on table public.vote_options to authenticated;
grant select on table public.vote_responses to authenticated;

grant all on table public.vote_options to service_role;
grant all on table public.vote_responses to service_role;

-- ----------------------------------------------------------------------------
-- Seed, en este orden.
-- ----------------------------------------------------------------------------
insert into public.vote_options (slug, label, description, sort_order) values
  ('modo-oscuro', 'Modo oscuro',
   'Una versión oscura de toda la app, para jugar de noche sin cansar la vista.', 1),
  ('tienda-central', 'Tienda central de intercambios',
   'Un mercado común donde publicas la carta que ofreces y la que buscas, y otro jugador la acepta al instante.', 2),
  ('medallas', 'Medallas',
   'Logros que se desbloquean jugando. Cuáles son es una sorpresa.', 3);

-- ----------------------------------------------------------------------------
-- save_vote_response(ranking, other_text)
-- ----------------------------------------------------------------------------
create or replace function public.save_vote_response(p_ranking jsonb, p_other_text text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Ventana de la votación, días calendario en hora de Madrid (ver
  -- lib/config/vote.ts: mismas fechas).
  c_vote_start constant date := date '2026-11-22';
  c_vote_end constant date := date '2026-11-30';
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_slugs text[];
  v_active_slugs text[];
  v_other_text text;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión para votar.';
  end if;

  if public.is_banned(v_user_id) then
    raise exception 'Tu cuenta está inhabilitada temporalmente y no puede votar.';
  end if;

  if v_today < c_vote_start then
    raise exception 'La votación todavía no ha empezado.';
  end if;
  if v_today > c_vote_end then
    raise exception 'La votación ya terminó.';
  end if;

  if p_ranking is null or jsonb_typeof(p_ranking) <> 'array' then
    raise exception 'El orden no es válido.';
  end if;

  -- Todos los elementos tienen que ser texto antes de convertirlos.
  if exists (
    select 1 from jsonb_array_elements(p_ranking) e where jsonb_typeof(e) <> 'string'
  ) then
    raise exception 'El orden no es válido.';
  end if;

  select coalesce(array_agg(e #>> '{}' order by o.ord), '{}')
    into v_slugs
  from jsonb_array_elements(p_ranking) with ordinality as o(e, ord);

  select coalesce(array_agg(slug order by slug), '{}')
    into v_active_slugs
  from public.vote_options
  where is_active;

  -- Exactamente los slugs de las opciones activas, cada uno una sola vez:
  -- misma cantidad, sin repetidos y mismo conjunto.
  if cardinality(v_slugs) <> cardinality(v_active_slugs)
     or (select count(distinct s) from unnest(v_slugs) s) <> cardinality(v_slugs)
     or (select array_agg(s order by s) from unnest(v_slugs) s) is distinct from v_active_slugs
  then
    raise exception 'El orden tiene que incluir todas las ideas, cada una una sola vez.';
  end if;

  v_other_text := nullif(left(btrim(coalesce(p_other_text, '')), 500), '');

  insert into public.vote_responses (user_id, ranking, other_text)
  values (v_user_id, to_jsonb(v_slugs), v_other_text)
  on conflict (user_id) do update
    set ranking = excluded.ranking,
        other_text = excluded.other_text,
        updated_at = now();
end;
$$;

-- anon se revoca explícito: Supabase le da execute por defecto y `from public`
-- no se lo quita.
revoke all on function public.save_vote_response(jsonb, text) from public, anon;
grant execute on function public.save_vote_response(jsonb, text) to authenticated;

commit;
