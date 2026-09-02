-- ============================================================================
-- Archivo: supabase/migrations/20260823000000_initial_schema.sql
-- ============================================================================

-- ============================================================================
-- Migración inicial: esquema del TCG (perfiles, cartas, sobres, códigos,
-- colección de cada jugador e intercambios).
-- Generado para pegar manualmente en el SQL Editor de Supabase.
-- No se ejecutó automáticamente: revisar antes de correrlo.
-- ============================================================================


-- ============================================================================
-- ENUMS
-- Tipos enumerados para restringir valores válidos en rareza y estado de trade.
-- ============================================================================

create type public.card_rarity as enum ('comun', 'rara', 'epica', 'legendaria');

create type public.trade_status as enum ('pendiente', 'aceptado', 'rechazado', 'cancelado', 'expirado');


-- ============================================================================
-- TABLA: profiles
-- Un perfil público por usuario de auth.users. El player_code es el
-- identificador corto (8 caracteres alfanuméricos en mayúscula) que el
-- jugador puede compartir con otros (por ejemplo, para trades).
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  player_code text not null unique check (player_code ~ '^[A-Z0-9]{8}$'),
  avatar_url text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público de cada usuario, creado automáticamente al registrarse.';


-- ============================================================================
-- TABLA: card_sets
-- Colecciones/ediciones de cartas (ej: "Set de lanzamiento").
-- ============================================================================

create table public.card_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  released_at timestamptz,
  is_active boolean not null default true
);

comment on table public.card_sets is 'Ediciones o colecciones de cartas.';


-- ============================================================================
-- TABLA: cards
-- Catálogo maestro de cartas. combat_stats guarda las estadísticas de combate
-- como jsonb desde el día uno (para que el jugador pueda leer la carta),
-- aunque el sistema de mazos/combate recién se construya en la Fase 2.
-- Forma esperada de combat_stats:
--   { "type": "texto", "cost": numero, "power": numero, "resistance": numero, "ability_text": "texto largo" }
-- ============================================================================

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.card_sets (id),
  slug text not null unique,
  name text not null,
  description text,
  rarity public.card_rarity not null,
  image_front_url text,
  image_back_url text,
  print_front_url text,
  print_back_url text,
  artist text,
  is_active boolean not null default true,
  released_at timestamptz,
  sort_order integer not null default 0,
  combat_stats jsonb not null default '{}'::jsonb
    check (jsonb_typeof(combat_stats) = 'object')
);

comment on table public.cards is 'Catálogo maestro de cartas del juego.';
comment on column public.cards.combat_stats is
  'Estadísticas de combate en jsonb: { type, cost, power, resistance, ability_text }. '
  'Se carga desde el lanzamiento aunque el sistema de mazos sea Fase 2.';

create index idx_cards_set_id on public.cards (set_id);
create index idx_cards_rarity on public.cards (rarity);


-- ============================================================================
-- TABLA: pack_types
-- Define "tipos de sobre": cuántas cartas entrega, con qué probabilidad de
-- rareza, de qué sets puede sacar cartas y si garantiza alguna rareza mínima.
-- ============================================================================

create table public.pack_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cards_count integer not null check (cards_count > 0),
  rarity_weights jsonb not null check (jsonb_typeof(rarity_weights) = 'object'),
  allowed_set_ids uuid[] not null default '{}',
  guaranteed_rarity public.card_rarity
);

comment on table public.pack_types is 'Configuración de los distintos tipos de sobre que se pueden entregar.';
comment on column public.pack_types.rarity_weights is
  'Probabilidad por rareza en jsonb, ej: {"comun":70,"rara":20,"epica":8,"legendaria":2}.';
comment on column public.pack_types.allowed_set_ids is
  'IDs de card_sets permitidos para este sobre. Postgres no soporta FK dentro de arrays, '
  'así que esta integridad se valida en la aplicación / funciones de servidor.';


-- ============================================================================
-- TABLA: codes
-- Códigos canjeables que entregan un pack_type. NUNCA legible por el cliente
-- (ver política RLS más abajo): todo el flujo de canje debe resolverse con
-- una función de servidor (service_role) que sí pueda leer esta tabla.
-- ============================================================================

create table public.codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  pack_type_id uuid not null references public.pack_types (id),
  max_uses integer not null default 1 check (max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  one_per_user boolean not null default false,
  batch_label text,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.codes is 'Códigos canjeables. No debe ser legible por los usuarios bajo ninguna circunstancia.';

create index idx_codes_pack_type_id on public.codes (pack_type_id);


-- ============================================================================
-- TABLA: redemptions
-- Historial de canjes de códigos. cards_awarded guarda qué cartas se
-- entregaron en ese canje puntual (para trazabilidad, aunque las cartas
-- efectivas viven en user_cards).
-- ============================================================================

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.codes (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  cards_awarded jsonb not null default '[]'::jsonb
    check (jsonb_typeof(cards_awarded) = 'array'),
  created_at timestamptz not null default now(),
  -- one_per_user se copia desde codes.one_per_user en el momento del insert
  -- (ver trigger más abajo) porque un índice único parcial no puede mirar
  -- una columna de otra tabla. Sirve solo para poder armar el índice único
  -- condicional pedido; la fuente de verdad del flag sigue siendo codes.
  one_per_user boolean not null default false
);

comment on table public.redemptions is 'Historial de canjes de códigos por usuario.';

create index idx_redemptions_code_id on public.redemptions (code_id);
create index idx_redemptions_user_id on public.redemptions (user_id);

-- Índice único condicional: si el código es de uso único por usuario
-- (one_per_user = true), un mismo usuario no puede tener dos redemptions
-- para el mismo código.
create unique index idx_redemptions_code_user_unique
  on public.redemptions (code_id, user_id)
  where one_per_user;

-- Copia one_per_user desde codes hacia la fila de redemptions que se está
-- insertando, para que el índice único condicional de arriba funcione.
create function public.set_redemption_one_per_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select c.one_per_user into new.one_per_user
  from public.codes c
  where c.id = new.code_id;

  return new;
end;
$$;

create trigger trg_set_redemption_one_per_user
  before insert on public.redemptions
  for each row execute function public.set_redemption_one_per_user();


-- ============================================================================
-- TABLA: user_cards
-- Colección de cada jugador: cuántas copias tiene de cada carta.
-- Clave primaria compuesta (user_id, card_id): una fila por combinación.
-- ============================================================================

create table public.user_cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id),
  quantity integer not null default 1 check (quantity > 0),
  first_obtained_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

comment on table public.user_cards is 'Colección de cartas de cada jugador (cuántas copias tiene de cada una).';

create index idx_user_cards_card_id on public.user_cards (card_id);


-- ============================================================================
-- TABLA: trades
-- Un intercambio propuesto entre dos jugadores.
-- ============================================================================

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  status public.trade_status not null default 'pendiente',
  message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  expires_at timestamptz,
  check (sender_id <> receiver_id)
);

comment on table public.trades is 'Propuestas de intercambio de cartas entre dos jugadores.';

create index idx_trades_sender_id on public.trades (sender_id);
create index idx_trades_receiver_id on public.trades (receiver_id);
create index idx_trades_status on public.trades (status);


-- ============================================================================
-- TABLA: trade_items
-- Cartas que cada lado pone sobre la mesa dentro de un trade. user_id indica
-- de qué jugador (sender o receiver del trade) es esa carta ofrecida.
-- ============================================================================

create table public.trade_items (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id),
  quantity integer not null default 1 check (quantity > 0)
);

comment on table public.trade_items is 'Cartas ofrecidas por cada lado dentro de un trade.';

create index idx_trade_items_trade_id on public.trade_items (trade_id);
create index idx_trade_items_card_id on public.trade_items (card_id);
create index idx_trade_items_user_id on public.trade_items (user_id);


-- ============================================================================
-- FUNCIÓN + TRIGGER: alta automática de profiles al registrarse un usuario
-- Genera un player_code único de 8 caracteres alfanuméricos en mayúscula
-- y crea la fila en profiles cuando aparece una fila nueva en auth.users.
-- ============================================================================

-- Genera un código de 8 caracteres (A-Z, 0-9) y reintenta hasta que sea único.
create function public.generate_player_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  candidate text;
  code_taken boolean;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;

    select exists (
      select 1 from public.profiles where player_code = candidate
    ) into code_taken;

    exit when not code_taken;
  end loop;

  return candidate;
end;
$$;

-- Crea el perfil correspondiente cada vez que se registra un usuario nuevo.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, player_code)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    public.generate_player_code()
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================================
-- ROW LEVEL SECURITY
-- Se habilita RLS en todas las tablas de public. A partir de acá, sin una
-- política explícita, nadie (salvo service_role, que siempre bypassea RLS
-- en Supabase) puede leer ni escribir.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.card_sets enable row level security;
alter table public.cards enable row level security;
alter table public.pack_types enable row level security;
alter table public.codes enable row level security;
alter table public.redemptions enable row level security;
alter table public.user_cards enable row level security;
alter table public.trades enable row level security;
alter table public.trade_items enable row level security;


-- ---------------------------------------------------------------------------
-- profiles: cada usuario lee y edita únicamente su propia fila.
-- No hay política de INSERT/DELETE: la fila se crea sola vía trigger
-- (que corre como security definer y no pasa por RLS), y no debería
-- borrarse desde el cliente.
-- ---------------------------------------------------------------------------

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ---------------------------------------------------------------------------
-- card_sets / cards / pack_types: lectura pública (incluye anon), escritura
-- solo por service_role. Como no se crea ninguna política de insert/update/
-- delete para authenticated/anon, esas operaciones quedan denegadas por
-- defecto para ellos; service_role sigue bypasseando RLS como siempre.
-- ---------------------------------------------------------------------------

create policy card_sets_select_public
  on public.card_sets for select
  to anon, authenticated
  using (true);

create policy cards_select_public
  on public.cards for select
  to anon, authenticated
  using (true);

create policy pack_types_select_public
  on public.pack_types for select
  to anon, authenticated
  using (true);


-- ---------------------------------------------------------------------------
-- codes: sin ninguna política. RLS queda habilitado y, al no haber policies,
-- ningún rol de cliente (anon/authenticated) puede leer ni escribir esta
-- tabla bajo ninguna circunstancia. Solo service_role (que bypassea RLS)
-- puede tocarla, típicamente desde una función de servidor que valida y
-- resuelve el canje.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- redemptions: cada usuario lee y crea únicamente sus propias filas.
--
-- ADVERTENCIA: esta policy de INSERT por sí sola NO valida reglas de negocio
-- (que el código exista, no esté vencido, no supere max_uses, etc.) ni qué
-- cartas se entregan: un cliente podría insertar un cards_awarded inventado.
-- El flujo real de canje debería resolverse con una función server-side
-- (security definer / service_role) que valide todo contra `codes` y recién
-- ahí inserte la redemption y actualice user_cards. No hay UPDATE/DELETE:
-- el historial de canjes es inmutable desde el cliente.
-- ---------------------------------------------------------------------------

create policy redemptions_select_own
  on public.redemptions for select
  to authenticated
  using (user_id = auth.uid());

create policy redemptions_insert_own
  on public.redemptions for insert
  to authenticated
  with check (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- user_cards: cada usuario lee y escribe únicamente su propia colección.
--
-- ADVERTENCIA: al igual que en redemptions, estas policies permiten que un
-- usuario autenticado inserte o actualice directamente filas de su propia
-- colección (por ejemplo, quantity de cualquier card_id). Esto es lo que se
-- pidió, pero en un juego con valor competitivo esto permite que un cliente
-- se autoasigne cartas sin pasar por canje/trade. Si eso no es deseado,
-- conviene restringir user_cards a solo SELECT para el cliente y mover las
-- escrituras a funciones server-side (redención/aceptación de trade).
-- ---------------------------------------------------------------------------

create policy user_cards_select_own
  on public.user_cards for select
  to authenticated
  using (user_id = auth.uid());

create policy user_cards_insert_own
  on public.user_cards for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_cards_update_own
  on public.user_cards for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_cards_delete_own
  on public.user_cards for delete
  to authenticated
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- trades / trade_items: RLS queda habilitado (como se pidió para "todas las
-- tablas"), pero no se definieron reglas de acceso para estas dos tablas en
-- el pedido original, así que a propósito no se creó ninguna policy: por
-- ahora quedan bloqueadas para anon/authenticated y solo accesibles vía
-- service_role. Falta decidir las reglas reales (quién ve qué lado de un
-- trade, quién puede crear/cancelar/aceptar) antes de habilitar acceso
-- directo desde el cliente.
-- ---------------------------------------------------------------------------


-- ============================================================================
-- Archivo: supabase/migrations/20260823010000_fix_handle_new_user_display_name.sql
-- ============================================================================

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


-- ============================================================================
-- Archivo: supabase/migrations/20260823020000_admin_and_storage.sql
-- ============================================================================

-- ============================================================================
-- Admin: columna is_admin en profiles + buckets de Storage para imágenes de
-- cartas. No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- profiles.is_admin
-- Se activa a mano desde el dashboard de Supabase (Table Editor), nunca
-- desde la app.
-- ============================================================================

alter table public.profiles
  add column is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Acceso al panel /admin. Se activa manualmente desde Supabase.';

-- IMPORTANTE: antes de esto, la policy profiles_update_own dejaba actualizar
-- CUALQUIER columna de la propia fila -- a partir de agregar is_admin, eso
-- incluiría poder hacer `update profiles set is_admin = true where id =
-- auth.uid()` directo desde el cliente y auto-otorgarse acceso de admin.
-- Se cierra restringiendo, a nivel de GRANT (no de policy), qué columnas
-- puede tocar el rol authenticated en un UPDATE. is_admin queda afuera.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;


-- ============================================================================
-- Storage: buckets para las imágenes de cartas.
--
-- card-images (público): frente/dorso en resolución de pantalla, lo que ve
-- el jugador en la app. Mismo nivel de confianza que la tabla `cards`
-- (que ya es de lectura pública), así que el bucket es público.
--
-- card-print (privado): frente/dorso en alta resolución para imprimir.
-- No se expone directamente -- ni siquiera a usuarios autenticados -- para
-- no filtrar los archivos maestros de impresión. Cuando exista la función
-- de impresión real (Fase 2, ruta /imprimir), se sirven con signed URLs
-- generadas server-side bajo demanda, no con acceso público directo.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('card-print', 'card-print', false)
on conflict (id) do nothing;

-- Lectura pública de las imágenes de pantalla (equivalente a la policy de
-- lectura pública que ya tiene la tabla cards).
create policy card_images_select_public
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'card-images');

-- card-print: a propósito NO se crea ninguna policy (mismo patrón que la
-- tabla `codes`). Sin policies, ni anon ni authenticated pueden leer ni
-- escribir ahí bajo ninguna circunstancia; solo service_role, que es
-- justamente el que usan los Server Actions del panel /admin para subir
-- los archivos de impresión y (a futuro) generar signed URLs.
--
-- Ninguno de los dos buckets tiene policy de INSERT/UPDATE/DELETE para
-- anon/authenticated: toda escritura de imágenes pasa por Server Actions
-- que ya verificaron is_admin y usan el cliente service_role.


-- ============================================================================
-- Archivo: supabase/migrations/20260825000000_genres_traits_card_model.sql
-- ============================================================================

-- ============================================================================
-- Corrección del modelo de cartas:
--  - Género y Rasgo pasan de texto libre a catálogos cerrados (genres,
--    traits), cada uno con su propia habilidad ya definida.
--  - Poder/Costo/Resistencia se unifican en un solo campo `power` (0-10).
--  - El dorso deja de ser por carta: pasa a game_settings (una fila única
--    para todo el juego).
--  - combat_stats queda sin uso (Género/Rasgo/Poder lo reemplazan) y se
--    elimina.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- TABLA: genres
-- Catálogo cerrado de 10 géneros. Cada uno tiene dos habilidades fijas:
-- la "base" (todas las cartas de ese género) y la "fandom" (versión más
-- fuerte, para cartas Fandom). El texto de la habilidad vive acá, no se
-- escribe a mano por carta.
-- ============================================================================

create table public.genres (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  base_ability_name text not null,
  base_ability_text text not null,
  fandom_ability_name text not null,
  fandom_ability_text text not null
);

comment on table public.genres is 'Catálogo cerrado de géneros (10 filas fijas) con su habilidad base y fandom.';


-- ============================================================================
-- TABLA: traits
-- Catálogo cerrado de 5 rasgos, cada uno con una única habilidad fija.
-- ============================================================================

create table public.traits (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  ability_name text not null,
  ability_text text not null
);

comment on table public.traits is 'Catálogo cerrado de rasgos (5 filas fijas) con su habilidad.';


-- ============================================================================
-- TABLA: game_settings
-- Fila única para todo el juego (el dorso es el mismo para todas las
-- cartas). `id boolean primary key default true` + el check de abajo es el
-- truco clásico de Postgres para forzar que la tabla tenga como máximo una
-- fila: la PK solo admite el valor `true`, así que un segundo insert
-- choca contra la unicidad de la PK.
-- ============================================================================

create table public.game_settings (
  id boolean primary key default true,
  card_back_screen_url text,
  card_back_print_url text,
  constraint game_settings_singleton check (id)
);

comment on table public.game_settings is 'Fila única de configuración global del juego (por ahora, el dorso de las cartas).';
comment on column public.game_settings.card_back_print_url is
  'Path dentro del bucket privado card-print (no una URL pública), igual que cards.print_front_url.';

insert into public.game_settings (id) values (true);


-- ============================================================================
-- Ajustes a cards
-- ============================================================================

-- El dorso ahora es único para todo el juego (game_settings), no por carta.
alter table public.cards drop column image_back_url;
alter table public.cards drop column print_back_url;

-- Tipo/costo/poder/resistencia/ability_text quedan reemplazados por
-- genre_id + trait_id (que ya traen su habilidad) + power. Nada más lee
-- combat_stats a esta altura, así que se elimina en vez de dejarlo muerto.
alter table public.cards drop column combat_stats;

-- Nullable a propósito: ya existe al menos una carta cargada con el modelo
-- viejo, que quedaría sin genre_id/trait_id/power. Se deja que la
-- aplicación (Server Action del admin) exija estos campos en cartas nuevas
-- o editadas, en vez de romper la migración por una fila existente.
alter table public.cards add column genre_id uuid references public.genres (id);
alter table public.cards add column trait_id uuid references public.traits (id);
alter table public.cards add column power integer check (power between 0 and 10);

create index idx_cards_genre_id on public.cards (genre_id);
create index idx_cards_trait_id on public.cards (trait_id);


-- ============================================================================
-- RLS: genres, traits y game_settings son de lectura pública (mismo patrón
-- que card_sets/cards/pack_types), solo escribibles por service_role.
-- ============================================================================

alter table public.genres enable row level security;
alter table public.traits enable row level security;
alter table public.game_settings enable row level security;

create policy genres_select_public
  on public.genres for select
  to anon, authenticated
  using (true);

create policy traits_select_public
  on public.traits for select
  to anon, authenticated
  using (true);

create policy game_settings_select_public
  on public.game_settings for select
  to anon, authenticated
  using (true);


-- ============================================================================
-- Seed: los 10 géneros y 5 rasgos, con su habilidad exacta.
-- ============================================================================

insert into public.genres
  (slug, name, sort_order, base_ability_name, base_ability_text, fandom_ability_name, fandom_ability_text)
values
  ('sci-fi', 'Sci-Fi', 1,
    'Escudo', '+1 Poder al defender en combate.',
    'Blindaje', '+3 Poder al defender en combate.'),
  ('fantasia', 'Fantasía', 2,
    'Hechizo', '+1 Poder al atacar en combate.',
    'Arcano', '+3 Poder al atacar en combate.'),
  ('comedia', 'Comedia', 3,
    'Set-Up', 'al entrar, le da su Género a otro aliado a tu elección hasta el final del turno.',
    'Remate', 'puedes elegir que tus cartas de Comedia ataquen juntas, sumando su Poder en un solo golpe. Si el ataque conjunto es bloqueado, tú repartes el daño recibido entre las cartas participantes.'),
  ('terror', 'Terror', 4,
    'Acecho', 'al atacar, si el rival decide bloquear, debe hacerlo con la carta que tú elijas (si está disponible).',
    'Pesadilla', 'inmune a habilidades rivales que la destruirían o le quitarían Poder, y no puede ser bloqueada por más de una carta a la vez.'),
  ('romance', 'Romance', 5,
    'Vínculo', 'si muere atacando, curas +1 PV.',
    'Idilio', 'si muere atacando y decides Exiliarla, curas +3 PV.'),
  ('drama', 'Drama', 6,
    'Sacrificio', 'cuando esta carta fuera a morir, puedes destruir a otro aliado tuyo en su lugar (esa carta destruida sí dispara sus propias habilidades Al morir).',
    'Catarsis', 'al morir, hace 3 PD directos al jugador rival o a una de sus unidades, tú eliges.'),
  ('aventura', 'Aventura', 7,
    'Trampa', 'al entrar, elige una carta rival y déjala Girada hasta el inicio del próximo turno de su dueño.',
    'Emboscada', 'al morir, devuelve la carta rival de menor Poder en mesa a la mano de su dueño (si hay empate, el rival elige cuál).'),
  ('accion', 'Acción', 8,
    'Adrenalina', 'puede atacar el mismo turno que la juegas (excepto en el Turno 1).',
    'Explosión', 'si al matar a una bloqueadora te sobra Poder, ese sobrante se suma como Poder temporal (hasta el final del turno) a otro aliado tuyo, a tu elección.'),
  ('documental', 'Documental', 9,
    'Investigar', 'al entrar, robas 1 carta de tu mazo.',
    'Archivo', 'al entrar, miras las 3 cartas superiores de tu mazo, te quedas con 2 y pones 1 en el fondo.'),
  ('musical', 'Musical', 10,
    'Eco', 'al morir, devuelve 1 carta al azar de tu descarte a tu mano.',
    'Encore', 'al morir o ser Exiliada, elige: devuelve 1 carta de tu descarte a tu mano (a tu elección) o, si tu Energía lo permite, juégala directo al campo sin pagar su coste.');

insert into public.traits
  (slug, name, sort_order, ability_name, ability_text)
values
  ('serie', 'Serie', 1,
    'Maratón', 'Cada carta Serie adicional que juegues el mismo turno cuesta 1 Energía menos que la anterior (acumulable hasta -3, sin bajar de 0), manteniendo su Poder original en mesa.'),
  ('pelicula', 'Película', 2,
    'Estreno', 'Al entrar al campo, elige una unidad enemiga y reduce su Poder a la mitad (redondeando hacia arriba) hasta el final del turno.'),
  ('videojuego', 'Videojuego', 3,
    'Level Up', 'Si esta carta sobrevive a un combate en el que destruyó a una unidad enemiga, gana +2 de Poder de forma permanente.'),
  ('animacion', 'Animación', 4,
    'Toon Force', 'Al defender, si su Poder es mayor al del atacante, no recibe daño de ese combate. Se activa una sola vez por carta en toda la partida.'),
  ('otro', 'Otro', 5,
    'Otros', 'Durante tu Fase Principal, puedes Sacrificar esta carta para ganar +2 de Energía disponible ese turno.');


-- ============================================================================
-- Archivo: supabase/migrations/20260826000000_redeem_code.sql
-- ============================================================================

-- ============================================================================
-- Canje de códigos: toda la lógica vive en una función Postgres
-- (security definer, transaccional, con bloqueo de fila) en vez de en el
-- cliente. También cierra las policies de escritura directa a user_cards y
-- redemptions que quedaron abiertas en la migración inicial, porque ahora
-- que existe un camino server-side correcto para otorgar cartas, dejar esas
-- policies abiertas solo sirve para que un cliente se autoasigne cartas.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- Helper: sortea una rareza según los pesos de rarity_weights (jsonb, ej.
-- {"comun":70,"rara":20,"epica":8,"legendaria":2}). No es security definer
-- porque no toca ninguna tabla; solo la llama redeem_code.
-- ============================================================================

create or replace function public.pick_weighted_rarity(p_weights jsonb)
returns public.card_rarity
language plpgsql
as $$
declare
  v_total numeric;
  v_roll numeric;
  v_cumulative numeric := 0;
  v_key text;
  v_weight numeric;
  v_fallback public.card_rarity;
begin
  select coalesce(sum(value::numeric), 0) into v_total
  from jsonb_each_text(p_weights);

  if v_total <= 0 then
    -- Sin pesos válidos: reparte parejo entre las 4 rarezas en vez de
    -- fallar el canje entero por una mala configuración del sobre.
    return (array['comun', 'rara', 'epica', 'legendaria']::public.card_rarity[])
      [floor(random() * 4)::int + 1];
  end if;

  v_roll := random() * v_total;

  for v_key, v_weight in
    select key, value::numeric from jsonb_each_text(p_weights)
  loop
    v_cumulative := v_cumulative + v_weight;
    if v_roll <= v_cumulative then
      return v_key::public.card_rarity;
    end if;
  end loop;

  -- Solo se llega acá por redondeo de punto flotante al borde del total:
  -- devuelve la última rareza con peso > 0.
  select key::public.card_rarity into v_fallback
  from jsonb_each_text(p_weights)
  where value::numeric > 0
  limit 1;

  return v_fallback;
end;
$$;

revoke all on function public.pick_weighted_rarity(jsonb) from public;


-- ============================================================================
-- redeem_code: valida el código, sortea las cartas del sobre y las otorga,
-- todo en una sola transacción con la fila del código bloqueada
-- (SELECT ... FOR UPDATE) para que dos canjes simultáneos del mismo código
-- no puedan pisarse (ni en uses_count ni en el chequeo de one_per_user).
-- ============================================================================

create or replace function public.redeem_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_clean text;
  v_lookup_code text;
  v_code_row public.codes%rowtype;
  v_pack public.pack_types%rowtype;
  v_already_redeemed boolean;
  v_selected_card_ids uuid[] := '{}';
  v_awarded jsonb := '[]'::jsonb;
  v_card_json jsonb;
  v_redemption_id uuid;
  v_rarity public.card_rarity;
  v_card_id uuid;
  v_is_new boolean;
  v_current_qty integer;
  i integer;
begin
  if v_user_id is null then
    raise exception 'Tenés que iniciar sesión para canjear un código.';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'Ingresá un código.';
  end if;

  -- 1. Normalizar: mayúsculas, sin guiones ni espacios, y reconstruir el
  -- formato XXXX-XXXX-XXXX (así el lookup usa el índice único de code en
  -- vez de escanear toda la tabla).
  v_clean := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if length(v_clean) <> 12 then
    raise exception 'Ese código no existe.';
  end if;
  v_lookup_code := substr(v_clean, 1, 4) || '-' || substr(v_clean, 5, 4) || '-' || substr(v_clean, 9, 4);

  -- 2. Buscar + bloquear la fila. El lock se mantiene hasta el commit/rollback
  -- de esta transacción, así que un segundo canje simultáneo del MISMO
  -- código queda esperando acá hasta que este termine.
  select * into v_code_row
  from public.codes
  where code = v_lookup_code
  for update;

  if not found then
    raise exception 'Ese código no existe.';
  end if;

  if not v_code_row.is_active then
    raise exception 'Ese código ya no está activo.';
  end if;

  if v_code_row.expires_at is not null and v_code_row.expires_at < now() then
    raise exception 'Ese código venció.';
  end if;

  if v_code_row.uses_count >= v_code_row.max_uses then
    raise exception 'Ese código ya alcanzó el máximo de usos.';
  end if;

  -- 3. one_per_user
  if v_code_row.one_per_user then
    select exists(
      select 1 from public.redemptions
      where code_id = v_code_row.id and user_id = v_user_id
    ) into v_already_redeemed;

    if v_already_redeemed then
      raise exception 'Ya canjeaste este código antes.';
    end if;
  end if;

  select * into v_pack from public.pack_types where id = v_code_row.pack_type_id;
  if not found then
    raise exception 'El tipo de sobre de este código ya no existe. Contactá a un admin.';
  end if;

  -- 4. Sortear las cartas. Si hay guaranteed_rarity, la primera carta sale
  -- de esa rareza; el resto (y esa misma si no hay garantía) se sortea por
  -- rarity_weights. Solo entre cartas activas de los sets permitidos. Si no
  -- hay ninguna de la rareza sorteada en esos sets, se degrada a cualquier
  -- carta activa permitida en vez de romper el canje.
  for i in 1..v_pack.cards_count loop
    if i = 1 and v_pack.guaranteed_rarity is not null then
      v_rarity := v_pack.guaranteed_rarity;
    else
      v_rarity := public.pick_weighted_rarity(v_pack.rarity_weights);
    end if;

    select id into v_card_id
    from public.cards
    where is_active
      and set_id = any(v_pack.allowed_set_ids)
      and rarity = v_rarity
    order by random()
    limit 1;

    if v_card_id is null then
      select id into v_card_id
      from public.cards
      where is_active
        and set_id = any(v_pack.allowed_set_ids)
      order by random()
      limit 1;
    end if;

    if v_card_id is null then
      raise exception 'No hay cartas disponibles para este sobre. Contactá a un admin.';
    end if;

    v_selected_card_ids := array_append(v_selected_card_ids, v_card_id);
  end loop;

  -- 5. Otorgar las cartas (insert o incrementar en user_cards) y armar el
  -- detalle, marcando is_new según si el usuario ya tenía esa carta.
  for i in 1..array_length(v_selected_card_ids, 1) loop
    v_card_id := v_selected_card_ids[i];

    select quantity into v_current_qty
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    v_is_new := v_current_qty is null;

    insert into public.user_cards (user_id, card_id, quantity)
    values (v_user_id, v_card_id, 1)
    on conflict (user_id, card_id)
    do update set quantity = public.user_cards.quantity + 1;

    select jsonb_build_object(
      'card_id', c.id,
      'slug', c.slug,
      'name', c.name,
      'rarity', c.rarity,
      'image_front_url', c.image_front_url,
      'is_new', v_is_new
    ) into v_card_json
    from public.cards c
    where c.id = v_card_id;

    v_awarded := v_awarded || jsonb_build_array(v_card_json);
  end loop;

  -- 6. Registrar la redención con el detalle de lo otorgado.
  insert into public.redemptions (code_id, user_id, cards_awarded)
  values (v_code_row.id, v_user_id, v_awarded)
  returning id into v_redemption_id;

  -- 7. Incrementar uses_count.
  update public.codes
  set uses_count = uses_count + 1
  where id = v_code_row.id;

  -- 8. Devolver el detalle.
  return jsonb_build_object(
    'redemption_id', v_redemption_id,
    'pack_type_name', v_pack.name,
    'cards', v_awarded
  );
end;
$$;

revoke all on function public.redeem_code(text) from public;
grant execute on function public.redeem_code(text) to authenticated;


-- ============================================================================
-- Ahora que redeem_code() es el único camino para otorgar cartas (corre
-- como security definer, bypassea RLS), las policies que dejaban insertar/
-- actualizar user_cards y redemptions directo desde el cliente quedan sin
-- ningún uso legítimo y son puro riesgo: un usuario podía escribirse
-- cualquier carta con cualquier cantidad, o inventar una redemption con
-- cards_awarded falso. Se cierran. SELECT de las propias filas se mantiene.
-- ============================================================================

drop policy if exists user_cards_insert_own on public.user_cards;
drop policy if exists user_cards_update_own on public.user_cards;
drop policy if exists redemptions_insert_own on public.redemptions;


-- ============================================================================
-- Archivo: supabase/migrations/20260827000000_pack_images.sql
-- ============================================================================

-- ============================================================================
-- Imagen personalizada del sobre en /canjear: una base para todo el juego
-- (game_settings, subida desde /admin/ajustes) con override opcional por
-- tipo de sobre (pack_types, subida desde /admin/packs). redeem_code()
-- devuelve la que corresponda ya resuelta, para no tener que consultarlo
-- aparte desde el cliente.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.game_settings add column pack_image_url text;
comment on column public.game_settings.pack_image_url is
  'Imagen base del sobre (bucket público card-images). Se usa cuando el pack_type canjeado no tiene una propia.';

alter table public.pack_types add column image_url text;
comment on column public.pack_types.image_url is
  'Imagen especial de este sobre (bucket público card-images), opcional. Si es null, se usa game_settings.pack_image_url.';


-- ============================================================================
-- redeem_code: mismo cuerpo que la migración anterior, solo se agrega la
-- resolución de pack_image_url (coalesce entre la del pack_type y la base
-- de game_settings) al resultado devuelto.
-- ============================================================================

create or replace function public.redeem_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_clean text;
  v_lookup_code text;
  v_code_row public.codes%rowtype;
  v_pack public.pack_types%rowtype;
  v_already_redeemed boolean;
  v_selected_card_ids uuid[] := '{}';
  v_awarded jsonb := '[]'::jsonb;
  v_card_json jsonb;
  v_redemption_id uuid;
  v_rarity public.card_rarity;
  v_card_id uuid;
  v_is_new boolean;
  v_current_qty integer;
  v_base_pack_image_url text;
  v_pack_image_url text;
  i integer;
begin
  if v_user_id is null then
    raise exception 'Tenés que iniciar sesión para canjear un código.';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'Ingresá un código.';
  end if;

  -- 1. Normalizar: mayúsculas, sin guiones ni espacios, y reconstruir el
  -- formato XXXX-XXXX-XXXX (así el lookup usa el índice único de code en
  -- vez de escanear toda la tabla).
  v_clean := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if length(v_clean) <> 12 then
    raise exception 'Ese código no existe.';
  end if;
  v_lookup_code := substr(v_clean, 1, 4) || '-' || substr(v_clean, 5, 4) || '-' || substr(v_clean, 9, 4);

  -- 2. Buscar + bloquear la fila. El lock se mantiene hasta el commit/rollback
  -- de esta transacción, así que un segundo canje simultáneo del MISMO
  -- código queda esperando acá hasta que este termine.
  select * into v_code_row
  from public.codes
  where code = v_lookup_code
  for update;

  if not found then
    raise exception 'Ese código no existe.';
  end if;

  if not v_code_row.is_active then
    raise exception 'Ese código ya no está activo.';
  end if;

  if v_code_row.expires_at is not null and v_code_row.expires_at < now() then
    raise exception 'Ese código venció.';
  end if;

  if v_code_row.uses_count >= v_code_row.max_uses then
    raise exception 'Ese código ya alcanzó el máximo de usos.';
  end if;

  -- 3. one_per_user
  if v_code_row.one_per_user then
    select exists(
      select 1 from public.redemptions
      where code_id = v_code_row.id and user_id = v_user_id
    ) into v_already_redeemed;

    if v_already_redeemed then
      raise exception 'Ya canjeaste este código antes.';
    end if;
  end if;

  select * into v_pack from public.pack_types where id = v_code_row.pack_type_id;
  if not found then
    raise exception 'El tipo de sobre de este código ya no existe. Contactá a un admin.';
  end if;

  -- 4. Sortear las cartas. Si hay guaranteed_rarity, la primera carta sale
  -- de esa rareza; el resto (y esa misma si no hay garantía) se sortea por
  -- rarity_weights. Solo entre cartas activas de los sets permitidos. Si no
  -- hay ninguna de la rareza sorteada en esos sets, se degrada a cualquier
  -- carta activa permitida en vez de romper el canje.
  for i in 1..v_pack.cards_count loop
    if i = 1 and v_pack.guaranteed_rarity is not null then
      v_rarity := v_pack.guaranteed_rarity;
    else
      v_rarity := public.pick_weighted_rarity(v_pack.rarity_weights);
    end if;

    select id into v_card_id
    from public.cards
    where is_active
      and set_id = any(v_pack.allowed_set_ids)
      and rarity = v_rarity
    order by random()
    limit 1;

    if v_card_id is null then
      select id into v_card_id
      from public.cards
      where is_active
        and set_id = any(v_pack.allowed_set_ids)
      order by random()
      limit 1;
    end if;

    if v_card_id is null then
      raise exception 'No hay cartas disponibles para este sobre. Contactá a un admin.';
    end if;

    v_selected_card_ids := array_append(v_selected_card_ids, v_card_id);
  end loop;

  -- 5. Otorgar las cartas (insert o incrementar en user_cards) y armar el
  -- detalle, marcando is_new según si el usuario ya tenía esa carta.
  for i in 1..array_length(v_selected_card_ids, 1) loop
    v_card_id := v_selected_card_ids[i];

    select quantity into v_current_qty
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    v_is_new := v_current_qty is null;

    insert into public.user_cards (user_id, card_id, quantity)
    values (v_user_id, v_card_id, 1)
    on conflict (user_id, card_id)
    do update set quantity = public.user_cards.quantity + 1;

    select jsonb_build_object(
      'card_id', c.id,
      'slug', c.slug,
      'name', c.name,
      'rarity', c.rarity,
      'image_front_url', c.image_front_url,
      'is_new', v_is_new
    ) into v_card_json
    from public.cards c
    where c.id = v_card_id;

    v_awarded := v_awarded || jsonb_build_array(v_card_json);
  end loop;

  -- 6. Registrar la redención con el detalle de lo otorgado.
  insert into public.redemptions (code_id, user_id, cards_awarded)
  values (v_code_row.id, v_user_id, v_awarded)
  returning id into v_redemption_id;

  -- 7. Incrementar uses_count.
  update public.codes
  set uses_count = uses_count + 1
  where id = v_code_row.id;

  -- Imagen del sobre: la propia del pack_type si tiene, si no la base de
  -- game_settings. Se resuelve acá para que el cliente no tenga que hacer
  -- una consulta aparte.
  select pack_image_url into v_base_pack_image_url from public.game_settings where id = true;
  v_pack_image_url := coalesce(v_pack.image_url, v_base_pack_image_url);

  -- 8. Devolver el detalle.
  return jsonb_build_object(
    'redemption_id', v_redemption_id,
    'pack_type_name', v_pack.name,
    'pack_image_url', v_pack_image_url,
    'cards', v_awarded
  );
end;
$$;

revoke all on function public.redeem_code(text) from public;
grant execute on function public.redeem_code(text) to authenticated;


-- ============================================================================
-- Archivo: supabase/migrations/20260828000000_card_score.sql
-- ============================================================================

-- ============================================================================
-- Puntaje (score): un número nuevo, independiente de power, que reemplaza a
-- Poder SOLO en lo que ve el jugador. power se sigue cargando desde el
-- admin pero queda oculto para el jugador (lo sigue leyendo el motor del
-- juego a futuro). score es opcional: si una carta no lo tiene, la UI del
-- jugador muestra "SP".
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.cards add column score integer check (score between 0 and 10);

comment on column public.cards.score is
  'Puntaje que ve el jugador (reemplaza a power en la UI). Opcional: si es null, se muestra "SP".';

comment on column public.cards.power is
  'Oculto para el jugador. Se sigue cargando desde /admin/cards, pero la UI del jugador muestra score (Puntaje), no power.';


-- ============================================================================
-- Archivo: supabase/migrations/20260828010000_card_score_decimal.sql
-- ============================================================================

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


-- ============================================================================
-- Archivo: supabase/migrations/20260829000000_card_is_fandom.sql
-- ============================================================================

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


-- ============================================================================
-- Archivo: supabase/migrations/20260830000000_trades_and_contacts.sql
-- ============================================================================

-- ============================================================================
-- Intercambios entre jugadores + libreta de contactos.
--
-- `trades` y `trade_items` ya existían desde la migración inicial (con RLS
-- habilitado pero sin ninguna policy: por ahora nadie del lado del cliente
-- puede tocarlas). Esta migración:
--   1. Agrega policies de SELECT para trades/trade_items (cada uno ve solo
--      los intercambios donde participa) -- las escrituras siguen sin
--      policy, todas pasan por las funciones de abajo.
--   2. Abre user_cards a lectura pública: para poder armar una oferta hace
--      falta ver la colección del otro jugador, igual que ya se puede ver
--      el catálogo completo de `cards`. No hay nada en user_cards más
--      sensible que "quién tiene qué carta", que es justamente lo que un
--      sistema de intercambios necesita mostrar.
--   3. Funciones security definer: create_trade, accept_trade, reject_trade,
--      cancel_trade, expire_old_trades (vencimiento perezoso a los 7 días,
--      sin depender de pg_cron), find_profile_by_code y get_public_profiles
--      (lookups públicos limitados, sin exponer is_admin ni tocar las
--      policies de profiles).
--   4. Tabla contacts (libreta privada, CRUD directo vía RLS: no hay nada
--      riesgoso en que cada uno administre sus propias filas).
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- user_cards: pasa de "solo lectura propia" a lectura pública. Necesario
-- para ver la colección del otro jugador al armar una oferta de
-- intercambio. Las escrituras siguen cerradas al cliente (solo
-- redeem_code/accept_trade, ambas security definer, las tocan).
-- ============================================================================

drop policy if exists user_cards_select_own on public.user_cards;

create policy user_cards_select_public
  on public.user_cards for select
  to authenticated
  using (true);


-- ============================================================================
-- trades / trade_items: SELECT solo de los propios (donde el usuario es
-- sender o receiver). Sin policies de insert/update/delete: toda escritura
-- pasa por las funciones de abajo.
-- ============================================================================

create policy trades_select_involved
  on public.trades for select
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy trade_items_select_involved
  on public.trade_items for select
  to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_items.trade_id
        and (t.sender_id = auth.uid() or t.receiver_id = auth.uid())
    )
  );

-- Acelera tanto esta policy como el chequeo de "ya comprometida en otra
-- oferta" que hace create_trade.
create index if not exists idx_trade_items_user_card on public.trade_items (user_id, card_id);


-- ============================================================================
-- find_profile_by_code / get_public_profiles: lookups públicos limitados a
-- columnas no sensibles de profiles (nunca is_admin). Se resuelven acá en
-- vez de abrir una policy de lectura pública sobre toda la tabla, para no
-- tocar profiles_select_own ni el chequeo de is_admin que ya depende de
-- ella (lib/admin/require-admin.ts).
-- ============================================================================

create or replace function public.find_profile_by_code(p_code text)
returns table (id uuid, display_name text, player_code text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.display_name, p.player_code, p.avatar_url
  from public.profiles p
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
  select p.id, p.display_name, p.player_code, p.avatar_url
  from public.profiles p
  where p.id = any(p_user_ids);
$$;

revoke all on function public.get_public_profiles(uuid[]) from public;
grant execute on function public.get_public_profiles(uuid[]) to authenticated;


-- ============================================================================
-- expire_old_trades: vencimiento perezoso. En vez de depender de pg_cron,
-- cualquier autenticado puede dispararla (no tiene efectos por-usuario: solo
-- marca como 'expirado' lo que objetivamente ya venció) y create_trade la
-- llama sola en cada visita a /intercambios antes de leer la lista.
-- accept_trade/reject_trade revalidan el vencimiento de su propio trade
-- puntual además, por si pasaron los 7 días entre que se cargó la lista y
-- que el usuario tocó el botón.
-- ============================================================================

create or replace function public.expire_old_trades()
returns void
language sql
security definer
set search_path = public
as $$
  update public.trades
  set status = 'expirado', resolved_at = now()
  where status = 'pendiente'
    and expires_at is not null
    and expires_at < now();
$$;

revoke all on function public.expire_old_trades() from public;
grant execute on function public.expire_old_trades() to authenticated;


-- ============================================================================
-- create_trade: valida que quien ofrece (el que llama a la función) tenga
-- de verdad las cartas y cantidades que ofrece, incluyendo lo ya
-- comprometido en sus otras ofertas pendientes. Lo pedido al otro jugador
-- solo se valida en formato (carta activa, cantidad positiva): su
-- disponibilidad real recién importa -- y se revalida -- al aceptar.
-- p_offer / p_request: jsonb array de {"card_id": uuid, "quantity": int}.
-- ============================================================================

create or replace function public.create_trade(
  p_receiver_id uuid,
  p_message text,
  p_offer jsonb,
  p_request jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade_id uuid;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_owned integer;
  v_committed integer;
  v_card_name text;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión para proponer un intercambio.';
  end if;

  if p_receiver_id is null then
    raise exception 'Elige con quién quieres intercambiar.';
  end if;

  if p_receiver_id = v_user_id then
    raise exception 'No puedes proponerte un intercambio a ti mismo.';
  end if;

  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'Ese jugador no existe.';
  end if;

  if p_message is not null and length(p_message) > 280 then
    raise exception 'El mensaje es demasiado largo (máximo 280 caracteres).';
  end if;

  if p_offer is null or jsonb_typeof(p_offer) <> 'array' or jsonb_array_length(p_offer) = 0 then
    raise exception 'Elige al menos una carta para ofrecer.';
  end if;

  if p_request is not null and jsonb_typeof(p_request) <> 'array' then
    raise exception 'Pedido inválido.';
  end if;

  if (select count(*) from jsonb_array_elements(p_offer) e)
     <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_offer) e) then
    raise exception 'No repitas la misma carta en la oferta: sumá la cantidad en una sola entrada.';
  end if;

  if p_request is not null and jsonb_array_length(p_request) > 0
     and (select count(*) from jsonb_array_elements(p_request) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_request) e) then
    raise exception 'No repitas la misma carta en el pedido: sumá la cantidad en una sola entrada.';
  end if;

  -- Cada carta ofrecida: tiene que existir, y lo que ya tiene el usuario
  -- (menos lo que ya comprometió en sus otras ofertas pendientes) tiene que
  -- alcanzar para esta cantidad.
  for v_item in select * from jsonb_array_elements(p_offer)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Oferta inválida.';
    end if;

    select name into v_card_name from public.cards where id = v_card_id and is_active;
    if v_card_name is null then
      raise exception 'Una de las cartas ofrecidas ya no existe.';
    end if;

    select coalesce(quantity, 0) into v_owned
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    select coalesce(sum(ti.quantity), 0) into v_committed
    from public.trade_items ti
    join public.trades t on t.id = ti.trade_id
    where ti.user_id = v_user_id
      and ti.card_id = v_card_id
      and t.status = 'pendiente';

    if coalesce(v_owned, 0) - v_committed < v_quantity then
      raise exception 'No te alcanzan las copias de "%" (ya tienes % comprometidas en otras ofertas pendientes).',
        v_card_name, v_committed;
    end if;
  end loop;

  if p_request is not null then
    for v_item in select * from jsonb_array_elements(p_request)
    loop
      v_card_id := (v_item ->> 'card_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;

      if v_card_id is null or v_quantity is null or v_quantity <= 0 then
        raise exception 'Pedido inválido.';
      end if;

      if not exists (select 1 from public.cards where id = v_card_id and is_active) then
        raise exception 'Una de las cartas pedidas ya no existe.';
      end if;
    end loop;
  end if;

  insert into public.trades (sender_id, receiver_id, message, status, expires_at)
  values (v_user_id, p_receiver_id, nullif(trim(p_message), ''), 'pendiente', now() + interval '7 days')
  returning id into v_trade_id;

  insert into public.trade_items (trade_id, user_id, card_id, quantity)
  select v_trade_id, v_user_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
  from jsonb_array_elements(p_offer) elem;

  if p_request is not null and jsonb_array_length(p_request) > 0 then
    insert into public.trade_items (trade_id, user_id, card_id, quantity)
    select v_trade_id, p_receiver_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_request) elem;
  end if;

  return v_trade_id;
end;
$$;

revoke all on function public.create_trade(uuid, text, jsonb, jsonb) from public;
grant execute on function public.create_trade(uuid, text, jsonb, jsonb) to authenticated;


-- ============================================================================
-- accept_trade: revalida DENTRO de la misma transacción que ambos lados
-- todavía tengan las cartas comprometidas (bloqueando cada fila de
-- user_cards con FOR UPDATE antes de tocarla), mueve las cantidades en los
-- dos sentidos, borra las filas de user_cards que quedan en cero (no se
-- puede dejarlas en 0: la tabla tiene check(quantity > 0)) y marca el
-- intercambio como aceptado. Cualquier excepción revierte toda la función,
-- porque plpgsql corre dentro de la transacción del llamador.
-- ============================================================================

create or replace function public.accept_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade public.trades%rowtype;
  v_item record;
  v_current_qty integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Ese intercambio no existe.';
  end if;

  if v_user_id <> v_trade.receiver_id then
    raise exception 'Solo quien recibe la oferta puede aceptarla.';
  end if;

  if v_trade.status <> 'pendiente' then
    raise exception 'Este intercambio ya no está pendiente.';
  end if;

  if v_trade.expires_at is not null and v_trade.expires_at < now() then
    update public.trades set status = 'expirado', resolved_at = now() where id = p_trade_id;
    raise exception 'Este intercambio ya venció.';
  end if;

  -- order by card_id, user_id: orden determinístico al bloquear filas, para
  -- reducir (no elimina del todo) la chance de deadlock contra otro
  -- accept_trade concurrente que toque cartas en común.
  for v_item in
    select
      ti.user_id,
      ti.card_id,
      ti.quantity,
      c.name as card_name,
      case when ti.user_id = v_trade.sender_id then v_trade.receiver_id else v_trade.sender_id end as other_user_id
    from public.trade_items ti
    join public.cards c on c.id = ti.card_id
    where ti.trade_id = p_trade_id
    order by ti.card_id, ti.user_id
  loop
    select quantity into v_current_qty
    from public.user_cards
    where user_id = v_item.user_id and card_id = v_item.card_id
    for update;

    if v_current_qty is null or v_current_qty < v_item.quantity then
      raise exception 'Ya no hay suficientes copias de "%" para completar el intercambio.', v_item.card_name;
    end if;

    if v_current_qty = v_item.quantity then
      delete from public.user_cards
      where user_id = v_item.user_id and card_id = v_item.card_id;
    else
      update public.user_cards
      set quantity = quantity - v_item.quantity
      where user_id = v_item.user_id and card_id = v_item.card_id;
    end if;

    insert into public.user_cards (user_id, card_id, quantity)
    values (v_item.other_user_id, v_item.card_id, v_item.quantity)
    on conflict (user_id, card_id)
    do update set quantity = public.user_cards.quantity + excluded.quantity;
  end loop;

  update public.trades
  set status = 'aceptado', resolved_at = now()
  where id = p_trade_id;
end;
$$;

revoke all on function public.accept_trade(uuid) from public;
grant execute on function public.accept_trade(uuid) to authenticated;


-- ============================================================================
-- reject_trade: solo quien recibe la oferta puede rechazarla.
-- ============================================================================

create or replace function public.reject_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade public.trades%rowtype;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Ese intercambio no existe.';
  end if;

  if v_user_id <> v_trade.receiver_id then
    raise exception 'Solo quien recibe la oferta puede rechazarla.';
  end if;

  if v_trade.status <> 'pendiente' then
    raise exception 'Este intercambio ya no está pendiente.';
  end if;

  if v_trade.expires_at is not null and v_trade.expires_at < now() then
    update public.trades set status = 'expirado', resolved_at = now() where id = p_trade_id;
    raise exception 'Este intercambio ya venció.';
  end if;

  update public.trades
  set status = 'rechazado', resolved_at = now()
  where id = p_trade_id;
end;
$$;

revoke all on function public.reject_trade(uuid) from public;
grant execute on function public.reject_trade(uuid) to authenticated;


-- ============================================================================
-- cancel_trade: solo quien propuso el intercambio puede retirarlo.
-- ============================================================================

create or replace function public.cancel_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade public.trades%rowtype;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Ese intercambio no existe.';
  end if;

  if v_user_id <> v_trade.sender_id then
    raise exception 'Solo quien propuso el intercambio puede cancelarlo.';
  end if;

  if v_trade.status <> 'pendiente' then
    raise exception 'Este intercambio ya no está pendiente.';
  end if;

  update public.trades
  set status = 'cancelado', resolved_at = now()
  where id = p_trade_id;
end;
$$;

revoke all on function public.cancel_trade(uuid) from public;
grant execute on function public.cancel_trade(uuid) to authenticated;


-- ============================================================================
-- TABLA: contacts
-- Libreta privada de cada usuario: no requiere aceptación del otro lado
-- (como guardar un número de teléfono). CRUD directo vía RLS scoped a
-- user_id = auth.uid(): no hay ningún riesgo en que cada quien administre
-- sus propias filas, así que no hace falta una función security definer
-- para esto (a diferencia de trades, acá no hay estado compartido que
-- proteger).
-- ============================================================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_user_id uuid not null references auth.users (id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now(),
  unique (user_id, contact_user_id),
  check (user_id <> contact_user_id)
);

comment on table public.contacts is 'Libreta de contactos privada de cada usuario (no requiere aceptación del otro lado).';

create index idx_contacts_user_id on public.contacts (user_id);

alter table public.contacts enable row level security;

create policy contacts_select_own
  on public.contacts for select
  to authenticated
  using (user_id = auth.uid());

create policy contacts_insert_own
  on public.contacts for insert
  to authenticated
  with check (user_id = auth.uid());

create policy contacts_update_own
  on public.contacts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy contacts_delete_own
  on public.contacts for delete
  to authenticated
  using (user_id = auth.uid());


-- ============================================================================
-- Archivo: supabase/migrations/20260831000000_public_profile_names.sql
-- ============================================================================

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


-- ============================================================================
-- Archivo: supabase/migrations/20260901000000_trade_privacy.sql
-- ============================================================================

-- ============================================================================
-- Control de privacidad por carta para intercambios: cada jugador decide
-- cuántas copias de cada carta están disponibles para que OTROS se las
-- pidan, con una preferencia por defecto que se aplica sola a las cartas
-- nuevas (sobres, o cartas recibidas en un intercambio).
--
-- Todo el peso vive en Postgres, no en el cliente:
--   1. profiles.trade_default + user_cards.public_quantity (con su check).
--   2. increase_user_card / decrease_user_card: único camino para mover
--      user_cards.quantity de acá en más -- aplican trade_default al subir
--      y hacen clamp de public_quantity al bajar. redeem_code y
--      accept_trade se reescriben para usarlas en vez de tocar user_cards
--      directo.
--   3. set_card_public_quantity / set_all_cards_public / set_all_cards_private:
--      las acciones que dispara el jugador.
--   4. create_trade y accept_trade: lo que se PIDE al otro no puede superar
--      su public_quantity actual (ni al crear la oferta ni, revalidado de
--      nuevo, al aceptarla). Lo que cada uno OFRECE de lo suyo sigue sin
--      esa restricción: un jugador siempre puede ofrecer voluntariamente
--      cualquier carta que tenga, sea pública o no.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- profiles.trade_default
-- ============================================================================

alter table public.profiles
  add column trade_default text not null default 'publicas'
  check (trade_default in ('publicas', 'privadas'));

comment on column public.profiles.trade_default is
  'Preferencia por defecto para cartas nuevas: si los duplicados quedan '
  'disponibles para intercambio solos ("publicas") o quedan privados hasta '
  'que el jugador los habilite a mano ("privadas").';

-- La migración de admin_and_storage ya había restringido el UPDATE de
-- authenticated sobre profiles a (display_name, avatar_url) -- GRANT es
-- acumulativo, así que esto solo suma la columna nueva a esa lista, sin
-- reabrir is_admin ni ninguna otra.
grant update (trade_default) on public.profiles to authenticated;


-- ============================================================================
-- user_cards.public_quantity
-- Cuántas de las copias que tiene el jugador están disponibles para que
-- otros se las pidan en un intercambio. El check garantiza que siempre
-- quede al menos 1 copia privada (nunca se puede hacer pública la
-- totalidad de lo que se tiene).
-- ============================================================================

alter table public.user_cards
  add column public_quantity integer not null default 0
  check (public_quantity >= 0 and public_quantity <= quantity - 1);

comment on column public.user_cards.public_quantity is
  'Cuántas copias de esta carta están disponibles para que OTROS jugadores '
  'las pidan en un intercambio. Siempre <= quantity - 1: al menos una copia '
  'queda privada siempre.';


-- ============================================================================
-- increase_user_card / decrease_user_card: a partir de acá, el único
-- camino para mover user_cards.quantity (redeem_code al otorgar cartas de
-- un sobre, accept_trade al mover las de un intercambio aceptado).
-- Encapsulan el ajuste de public_quantity que exige el punto 2 del pedido:
--   - Al SUBIR la cantidad: si trade_default del dueño es "publicas",
--     public_quantity pasa a ser (cantidad nueva - 1) -- todo duplicado
--     queda disponible solo. Si es "privadas", no se toca: las copias
--     nuevas quedan privadas hasta que el jugador decida lo contrario.
--   - Al BAJAR la cantidad: se hace clamp de public_quantity para que
--     nunca quede por encima de lo que permite la cantidad nueva (nunca
--     puede haber 0 copias privadas).
-- No se otorga ejecución a authenticated: solo las llaman funciones
-- security definer del mismo dueño (mismo patrón que pick_weighted_rarity
-- en redeem_code.sql), nunca directo desde el cliente.
-- ============================================================================

create or replace function public.increase_user_card(p_user_id uuid, p_card_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default text;
  v_new_quantity integer;
begin
  select trade_default into v_default from public.profiles where id = p_user_id;

  insert into public.user_cards (user_id, card_id, quantity, public_quantity)
  values (p_user_id, p_card_id, p_delta, 0)
  on conflict (user_id, card_id)
  do update set quantity = public.user_cards.quantity + p_delta
  returning quantity into v_new_quantity;

  if v_default = 'publicas' then
    update public.user_cards
    set public_quantity = v_new_quantity - 1
    where user_id = p_user_id and card_id = p_card_id;
  end if;

  return v_new_quantity;
end;
$$;

revoke all on function public.increase_user_card(uuid, uuid, integer) from public;


create or replace function public.decrease_user_card(p_user_id uuid, p_card_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_qty integer;
  v_new_quantity integer;
begin
  select quantity into v_current_qty
  from public.user_cards
  where user_id = p_user_id and card_id = p_card_id
  for update;

  if v_current_qty is null or v_current_qty < p_delta then
    raise exception 'No hay suficientes copias para descontar.';
  end if;

  v_new_quantity := v_current_qty - p_delta;

  if v_new_quantity = 0 then
    delete from public.user_cards where user_id = p_user_id and card_id = p_card_id;
  else
    update public.user_cards
    set quantity = v_new_quantity,
        public_quantity = least(public_quantity, v_new_quantity - 1)
    where user_id = p_user_id and card_id = p_card_id;
  end if;
end;
$$;

revoke all on function public.decrease_user_card(uuid, uuid, integer) from public;


-- ============================================================================
-- set_card_public_quantity / set_all_cards_public / set_all_cards_private:
-- las acciones que el jugador dispara directamente sobre su colección.
-- ============================================================================

create or replace function public.set_card_public_quantity(p_card_id uuid, p_public_quantity integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quantity integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select quantity into v_quantity
  from public.user_cards
  where user_id = v_user_id and card_id = p_card_id;

  if v_quantity is null then
    raise exception 'No tienes esa carta.';
  end if;

  if p_public_quantity < 0 or p_public_quantity > v_quantity - 1 then
    raise exception 'La cantidad disponible debe estar entre 0 y %.', v_quantity - 1;
  end if;

  update public.user_cards
  set public_quantity = p_public_quantity
  where user_id = v_user_id and card_id = p_card_id;
end;
$$;

revoke all on function public.set_card_public_quantity(uuid, integer) from public;
grant execute on function public.set_card_public_quantity(uuid, integer) to authenticated;


create or replace function public.set_all_cards_public()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_cards
  set public_quantity = quantity - 1
  where user_id = auth.uid();
$$;

revoke all on function public.set_all_cards_public() from public;
grant execute on function public.set_all_cards_public() to authenticated;


create or replace function public.set_all_cards_private()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_cards
  set public_quantity = 0
  where user_id = auth.uid();
$$;

revoke all on function public.set_all_cards_private() from public;
grant execute on function public.set_all_cards_private() to authenticated;


-- ============================================================================
-- redeem_code: mismo cuerpo que la migración de pack_images, cambiando
-- solo el paso 5 para usar increase_user_card (así las cartas de un sobre
-- respetan trade_default) y sumando quantity + trade_default al resultado
-- devuelto -- el cliente los necesita para el interruptor "Disponible para
-- intercambio" de cada carta repetida en /canjear.
-- ============================================================================

create or replace function public.redeem_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_clean text;
  v_lookup_code text;
  v_code_row public.codes%rowtype;
  v_pack public.pack_types%rowtype;
  v_already_redeemed boolean;
  v_selected_card_ids uuid[] := '{}';
  v_awarded jsonb := '[]'::jsonb;
  v_card_json jsonb;
  v_redemption_id uuid;
  v_rarity public.card_rarity;
  v_card_id uuid;
  v_is_new boolean;
  v_current_qty integer;
  v_new_qty integer;
  v_base_pack_image_url text;
  v_pack_image_url text;
  v_trade_default text;
  i integer;
begin
  if v_user_id is null then
    raise exception 'Tenés que iniciar sesión para canjear un código.';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'Ingresá un código.';
  end if;

  -- 1. Normalizar: mayúsculas, sin guiones ni espacios, y reconstruir el
  -- formato XXXX-XXXX-XXXX (así el lookup usa el índice único de code en
  -- vez de escanear toda la tabla).
  v_clean := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if length(v_clean) <> 12 then
    raise exception 'Ese código no existe.';
  end if;
  v_lookup_code := substr(v_clean, 1, 4) || '-' || substr(v_clean, 5, 4) || '-' || substr(v_clean, 9, 4);

  -- 2. Buscar + bloquear la fila. El lock se mantiene hasta el commit/rollback
  -- de esta transacción, así que un segundo canje simultáneo del MISMO
  -- código queda esperando acá hasta que este termine.
  select * into v_code_row
  from public.codes
  where code = v_lookup_code
  for update;

  if not found then
    raise exception 'Ese código no existe.';
  end if;

  if not v_code_row.is_active then
    raise exception 'Ese código ya no está activo.';
  end if;

  if v_code_row.expires_at is not null and v_code_row.expires_at < now() then
    raise exception 'Ese código venció.';
  end if;

  if v_code_row.uses_count >= v_code_row.max_uses then
    raise exception 'Ese código ya alcanzó el máximo de usos.';
  end if;

  -- 3. one_per_user
  if v_code_row.one_per_user then
    select exists(
      select 1 from public.redemptions
      where code_id = v_code_row.id and user_id = v_user_id
    ) into v_already_redeemed;

    if v_already_redeemed then
      raise exception 'Ya canjeaste este código antes.';
    end if;
  end if;

  select * into v_pack from public.pack_types where id = v_code_row.pack_type_id;
  if not found then
    raise exception 'El tipo de sobre de este código ya no existe. Contactá a un admin.';
  end if;

  -- 4. Sortear las cartas. Si hay guaranteed_rarity, la primera carta sale
  -- de esa rareza; el resto (y esa misma si no hay garantía) se sortea por
  -- rarity_weights. Solo entre cartas activas de los sets permitidos. Si no
  -- hay ninguna de la rareza sorteada en esos sets, se degrada a cualquier
  -- carta activa permitida en vez de romper el canje.
  for i in 1..v_pack.cards_count loop
    if i = 1 and v_pack.guaranteed_rarity is not null then
      v_rarity := v_pack.guaranteed_rarity;
    else
      v_rarity := public.pick_weighted_rarity(v_pack.rarity_weights);
    end if;

    select id into v_card_id
    from public.cards
    where is_active
      and set_id = any(v_pack.allowed_set_ids)
      and rarity = v_rarity
    order by random()
    limit 1;

    if v_card_id is null then
      select id into v_card_id
      from public.cards
      where is_active
        and set_id = any(v_pack.allowed_set_ids)
      order by random()
      limit 1;
    end if;

    if v_card_id is null then
      raise exception 'No hay cartas disponibles para este sobre. Contactá a un admin.';
    end if;

    v_selected_card_ids := array_append(v_selected_card_ids, v_card_id);
  end loop;

  -- 5. Otorgar las cartas vía increase_user_card (aplica trade_default a
  -- las nuevas) y armar el detalle, marcando is_new según si el usuario ya
  -- tenía esa carta.
  for i in 1..array_length(v_selected_card_ids, 1) loop
    v_card_id := v_selected_card_ids[i];

    select quantity into v_current_qty
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    v_is_new := v_current_qty is null;

    select public.increase_user_card(v_user_id, v_card_id, 1) into v_new_qty;

    select jsonb_build_object(
      'card_id', c.id,
      'slug', c.slug,
      'name', c.name,
      'rarity', c.rarity,
      'image_front_url', c.image_front_url,
      'is_new', v_is_new,
      'quantity', v_new_qty
    ) into v_card_json
    from public.cards c
    where c.id = v_card_id;

    v_awarded := v_awarded || jsonb_build_array(v_card_json);
  end loop;

  -- 6. Registrar la redención con el detalle de lo otorgado.
  insert into public.redemptions (code_id, user_id, cards_awarded)
  values (v_code_row.id, v_user_id, v_awarded)
  returning id into v_redemption_id;

  -- 7. Incrementar uses_count.
  update public.codes
  set uses_count = uses_count + 1
  where id = v_code_row.id;

  -- Imagen del sobre: la propia del pack_type si tiene, si no la base de
  -- game_settings. Se resuelve acá para que el cliente no tenga que hacer
  -- una consulta aparte.
  select pack_image_url into v_base_pack_image_url from public.game_settings where id = true;
  v_pack_image_url := coalesce(v_pack.image_url, v_base_pack_image_url);

  select trade_default into v_trade_default from public.profiles where id = v_user_id;

  -- 8. Devolver el detalle.
  return jsonb_build_object(
    'redemption_id', v_redemption_id,
    'pack_type_name', v_pack.name,
    'pack_image_url', v_pack_image_url,
    'trade_default', v_trade_default,
    'cards', v_awarded
  );
end;
$$;

revoke all on function public.redeem_code(text) from public;
grant execute on function public.redeem_code(text) to authenticated;


-- ============================================================================
-- create_trade: mismo cuerpo que la migración de trades_and_contacts,
-- sumando la validación de que lo PEDIDO al otro jugador no supere su
-- public_quantity actual (lo OFRECIDO de lo propio sigue sin esta
-- restricción -- ver el bloque de arriba).
-- ============================================================================

create or replace function public.create_trade(
  p_receiver_id uuid,
  p_message text,
  p_offer jsonb,
  p_request jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade_id uuid;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_owned integer;
  v_committed integer;
  v_card_name text;
  v_public_qty integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión para proponer un intercambio.';
  end if;

  if p_receiver_id is null then
    raise exception 'Elige con quién quieres intercambiar.';
  end if;

  if p_receiver_id = v_user_id then
    raise exception 'No puedes proponerte un intercambio a ti mismo.';
  end if;

  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'Ese jugador no existe.';
  end if;

  if p_message is not null and length(p_message) > 280 then
    raise exception 'El mensaje es demasiado largo (máximo 280 caracteres).';
  end if;

  if p_offer is null or jsonb_typeof(p_offer) <> 'array' or jsonb_array_length(p_offer) = 0 then
    raise exception 'Elige al menos una carta para ofrecer.';
  end if;

  if p_request is not null and jsonb_typeof(p_request) <> 'array' then
    raise exception 'Pedido inválido.';
  end if;

  if (select count(*) from jsonb_array_elements(p_offer) e)
     <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_offer) e) then
    raise exception 'No repitas la misma carta en la oferta: sumá la cantidad en una sola entrada.';
  end if;

  if p_request is not null and jsonb_array_length(p_request) > 0
     and (select count(*) from jsonb_array_elements(p_request) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_request) e) then
    raise exception 'No repitas la misma carta en el pedido: sumá la cantidad en una sola entrada.';
  end if;

  -- Cada carta ofrecida: tiene que existir, y lo que ya tiene el usuario
  -- (menos lo que ya comprometió en sus otras ofertas pendientes) tiene que
  -- alcanzar para esta cantidad. Sin restricción de public_quantity: un
  -- jugador siempre puede ofrecer voluntariamente sus propias cartas.
  for v_item in select * from jsonb_array_elements(p_offer)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Oferta inválida.';
    end if;

    select name into v_card_name from public.cards where id = v_card_id and is_active;
    if v_card_name is null then
      raise exception 'Una de las cartas ofrecidas ya no existe.';
    end if;

    select coalesce(quantity, 0) into v_owned
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    select coalesce(sum(ti.quantity), 0) into v_committed
    from public.trade_items ti
    join public.trades t on t.id = ti.trade_id
    where ti.user_id = v_user_id
      and ti.card_id = v_card_id
      and t.status = 'pendiente';

    if coalesce(v_owned, 0) - v_committed < v_quantity then
      raise exception 'No te alcanzan las copias de "%" (ya tienes % comprometidas en otras ofertas pendientes).',
        v_card_name, v_committed;
    end if;
  end loop;

  -- Cada carta pedida: tiene que existir, y no puede superar el
  -- public_quantity actual del receptor (lo que él marcó como disponible
  -- para intercambio, no toda su cantidad).
  if p_request is not null then
    for v_item in select * from jsonb_array_elements(p_request)
    loop
      v_card_id := (v_item ->> 'card_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;

      if v_card_id is null or v_quantity is null or v_quantity <= 0 then
        raise exception 'Pedido inválido.';
      end if;

      select name into v_card_name from public.cards where id = v_card_id and is_active;
      if v_card_name is null then
        raise exception 'Una de las cartas pedidas ya no existe.';
      end if;

      select coalesce(public_quantity, 0) into v_public_qty
      from public.user_cards
      where user_id = p_receiver_id and card_id = v_card_id;

      if coalesce(v_public_qty, 0) < v_quantity then
        raise exception '"%" no tiene suficientes copias disponibles para intercambio.', v_card_name;
      end if;
    end loop;
  end if;

  insert into public.trades (sender_id, receiver_id, message, status, expires_at)
  values (v_user_id, p_receiver_id, nullif(trim(p_message), ''), 'pendiente', now() + interval '7 days')
  returning id into v_trade_id;

  insert into public.trade_items (trade_id, user_id, card_id, quantity)
  select v_trade_id, v_user_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
  from jsonb_array_elements(p_offer) elem;

  if p_request is not null and jsonb_array_length(p_request) > 0 then
    insert into public.trade_items (trade_id, user_id, card_id, quantity)
    select v_trade_id, p_receiver_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_request) elem;
  end if;

  return v_trade_id;
end;
$$;

revoke all on function public.create_trade(uuid, text, jsonb, jsonb) from public;
grant execute on function public.create_trade(uuid, text, jsonb, jsonb) to authenticated;


-- ============================================================================
-- accept_trade: mismo cuerpo que la migración de trades_and_contacts,
-- reescrito para usar increase_user_card/decrease_user_card (así el
-- intercambio también respeta trade_default y el clamp de public_quantity)
-- y sumando la revalidación de que lo pedido al receiver no supere su
-- public_quantity ACTUAL -- pudo cambiar desde que se creó la oferta.
-- ============================================================================

create or replace function public.accept_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade public.trades%rowtype;
  v_item record;
  v_current_qty integer;
  v_current_public_qty integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Ese intercambio no existe.';
  end if;

  if v_user_id <> v_trade.receiver_id then
    raise exception 'Solo quien recibe la oferta puede aceptarla.';
  end if;

  if v_trade.status <> 'pendiente' then
    raise exception 'Este intercambio ya no está pendiente.';
  end if;

  if v_trade.expires_at is not null and v_trade.expires_at < now() then
    update public.trades set status = 'expirado', resolved_at = now() where id = p_trade_id;
    raise exception 'Este intercambio ya venció.';
  end if;

  -- order by card_id, user_id: orden determinístico al bloquear filas, para
  -- reducir (no elimina del todo) la chance de deadlock contra otro
  -- accept_trade concurrente que toque cartas en común.
  for v_item in
    select
      ti.user_id,
      ti.card_id,
      ti.quantity,
      c.name as card_name,
      case when ti.user_id = v_trade.sender_id then v_trade.receiver_id else v_trade.sender_id end as other_user_id
    from public.trade_items ti
    join public.cards c on c.id = ti.card_id
    where ti.trade_id = p_trade_id
    order by ti.card_id, ti.user_id
  loop
    select quantity, public_quantity into v_current_qty, v_current_public_qty
    from public.user_cards
    where user_id = v_item.user_id and card_id = v_item.card_id
    for update;

    if v_current_qty is null or v_current_qty < v_item.quantity then
      raise exception 'Ya no hay suficientes copias de "%" para completar el intercambio.', v_item.card_name;
    end if;

    -- Lo que el receiver entrega es lo que el sender había PEDIDO: no
    -- puede superar lo que el receiver tiene marcado como disponible
    -- ahora mismo (pudo cambiar desde que se creó la oferta). Lo que el
    -- sender entrega (lo que ofreció) no tiene esta restricción.
    if v_item.user_id = v_trade.receiver_id and coalesce(v_current_public_qty, 0) < v_item.quantity then
      raise exception '"%" ya no tiene suficientes copias disponibles para intercambio.', v_item.card_name;
    end if;

    perform public.decrease_user_card(v_item.user_id, v_item.card_id, v_item.quantity);
    perform public.increase_user_card(v_item.other_user_id, v_item.card_id, v_item.quantity);
  end loop;

  update public.trades
  set status = 'aceptado', resolved_at = now()
  where id = p_trade_id;
end;
$$;

revoke all on function public.accept_trade(uuid) from public;
grant execute on function public.accept_trade(uuid) to authenticated;


-- ============================================================================
-- Archivo: supabase/migrations/20260902000000_trade_keep_one_copy.sql
-- ============================================================================

-- ============================================================================
-- Bug: al OFRECER cartas en un intercambio (a diferencia de lo PEDIDO, que
-- ya estaba protegido por public_quantity <= quantity - 1), no había nada
-- que impidiera ofrecer la totalidad de las copias de una carta -- un
-- jugador con 4 copias podía ofrecer las 4, quedándose en 0. La regla real
-- es: nunca podés quedarte con 0 copias de una carta por ningún camino de
-- intercambio, ni pidiendo ni ofreciendo.
--
-- create_trade: la validación de lo ofrecido ahora reserva 1 copia
-- siempre (owned - 1 - comprometido en otras ofertas >= lo que se ofrece
-- acá).
-- accept_trade: se revalida lo mismo justo antes de mover las cartas, por
-- si la cantidad cambió entre que se creó la oferta y que se aceptó. Del
-- lado de lo PEDIDO no hace falta un chequeo nuevo: como public_quantity
-- ya está limitado por el check de la tabla a <= quantity - 1, y
-- accept_trade ya revalida contra el public_quantity ACTUAL, matemáticamente
-- nunca puede dejar al dueño en 0 (quantity - pedido >= quantity - (quantity - 1) = 1).
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.create_trade(
  p_receiver_id uuid,
  p_message text,
  p_offer jsonb,
  p_request jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade_id uuid;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_owned integer;
  v_committed integer;
  v_card_name text;
  v_public_qty integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión para proponer un intercambio.';
  end if;

  if p_receiver_id is null then
    raise exception 'Elige con quién quieres intercambiar.';
  end if;

  if p_receiver_id = v_user_id then
    raise exception 'No puedes proponerte un intercambio a ti mismo.';
  end if;

  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'Ese jugador no existe.';
  end if;

  if p_message is not null and length(p_message) > 280 then
    raise exception 'El mensaje es demasiado largo (máximo 280 caracteres).';
  end if;

  if p_offer is null or jsonb_typeof(p_offer) <> 'array' or jsonb_array_length(p_offer) = 0 then
    raise exception 'Elige al menos una carta para ofrecer.';
  end if;

  if p_request is not null and jsonb_typeof(p_request) <> 'array' then
    raise exception 'Pedido inválido.';
  end if;

  if (select count(*) from jsonb_array_elements(p_offer) e)
     <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_offer) e) then
    raise exception 'No repitas la misma carta en la oferta: sumá la cantidad en una sola entrada.';
  end if;

  if p_request is not null and jsonb_array_length(p_request) > 0
     and (select count(*) from jsonb_array_elements(p_request) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_request) e) then
    raise exception 'No repitas la misma carta en el pedido: sumá la cantidad en una sola entrada.';
  end if;

  -- Cada carta ofrecida: tiene que existir, y lo que ya tiene el usuario
  -- MENOS 1 (siempre se reserva una copia propia) y menos lo ya
  -- comprometido en sus otras ofertas pendientes, tiene que alcanzar para
  -- esta cantidad. Nunca se puede ofrecer la totalidad de las copias.
  for v_item in select * from jsonb_array_elements(p_offer)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Oferta inválida.';
    end if;

    select name into v_card_name from public.cards where id = v_card_id and is_active;
    if v_card_name is null then
      raise exception 'Una de las cartas ofrecidas ya no existe.';
    end if;

    select coalesce(quantity, 0) into v_owned
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    select coalesce(sum(ti.quantity), 0) into v_committed
    from public.trade_items ti
    join public.trades t on t.id = ti.trade_id
    where ti.user_id = v_user_id
      and ti.card_id = v_card_id
      and t.status = 'pendiente';

    if coalesce(v_owned, 0) - 1 - v_committed < v_quantity then
      raise exception 'No puedes ofrecer esa cantidad de "%": siempre te queda al menos 1 copia propia (tienes %, ya tienes % comprometidas en otras ofertas pendientes).',
        v_card_name, coalesce(v_owned, 0), v_committed;
    end if;
  end loop;

  -- Cada carta pedida: tiene que existir, y no puede superar el
  -- public_quantity actual del receptor (lo que él marcó como disponible
  -- para intercambio, no toda su cantidad).
  if p_request is not null then
    for v_item in select * from jsonb_array_elements(p_request)
    loop
      v_card_id := (v_item ->> 'card_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;

      if v_card_id is null or v_quantity is null or v_quantity <= 0 then
        raise exception 'Pedido inválido.';
      end if;

      select name into v_card_name from public.cards where id = v_card_id and is_active;
      if v_card_name is null then
        raise exception 'Una de las cartas pedidas ya no existe.';
      end if;

      select coalesce(public_quantity, 0) into v_public_qty
      from public.user_cards
      where user_id = p_receiver_id and card_id = v_card_id;

      if coalesce(v_public_qty, 0) < v_quantity then
        raise exception '"%" no tiene suficientes copias disponibles para intercambio.', v_card_name;
      end if;
    end loop;
  end if;

  insert into public.trades (sender_id, receiver_id, message, status, expires_at)
  values (v_user_id, p_receiver_id, nullif(trim(p_message), ''), 'pendiente', now() + interval '7 days')
  returning id into v_trade_id;

  insert into public.trade_items (trade_id, user_id, card_id, quantity)
  select v_trade_id, v_user_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
  from jsonb_array_elements(p_offer) elem;

  if p_request is not null and jsonb_array_length(p_request) > 0 then
    insert into public.trade_items (trade_id, user_id, card_id, quantity)
    select v_trade_id, p_receiver_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_request) elem;
  end if;

  return v_trade_id;
end;
$$;

revoke all on function public.create_trade(uuid, text, jsonb, jsonb) from public;
grant execute on function public.create_trade(uuid, text, jsonb, jsonb) to authenticated;


create or replace function public.accept_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade public.trades%rowtype;
  v_item record;
  v_current_qty integer;
  v_current_public_qty integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Ese intercambio no existe.';
  end if;

  if v_user_id <> v_trade.receiver_id then
    raise exception 'Solo quien recibe la oferta puede aceptarla.';
  end if;

  if v_trade.status <> 'pendiente' then
    raise exception 'Este intercambio ya no está pendiente.';
  end if;

  if v_trade.expires_at is not null and v_trade.expires_at < now() then
    update public.trades set status = 'expirado', resolved_at = now() where id = p_trade_id;
    raise exception 'Este intercambio ya venció.';
  end if;

  -- order by card_id, user_id: orden determinístico al bloquear filas, para
  -- reducir (no elimina del todo) la chance de deadlock contra otro
  -- accept_trade concurrente que toque cartas en común.
  for v_item in
    select
      ti.user_id,
      ti.card_id,
      ti.quantity,
      c.name as card_name,
      case when ti.user_id = v_trade.sender_id then v_trade.receiver_id else v_trade.sender_id end as other_user_id
    from public.trade_items ti
    join public.cards c on c.id = ti.card_id
    where ti.trade_id = p_trade_id
    order by ti.card_id, ti.user_id
  loop
    select quantity, public_quantity into v_current_qty, v_current_public_qty
    from public.user_cards
    where user_id = v_item.user_id and card_id = v_item.card_id
    for update;

    if v_current_qty is null or v_current_qty < v_item.quantity then
      raise exception 'Ya no hay suficientes copias de "%" para completar el intercambio.', v_item.card_name;
    end if;

    -- Lo OFRECIDO (items del sender) nunca puede dejarlo en 0: siempre se
    -- reserva 1 copia propia, revalidado acá por si la cantidad cambió
    -- desde que se creó la oferta.
    if v_item.user_id = v_trade.sender_id and v_current_qty - v_item.quantity < 1 then
      raise exception 'Quien ofreció "%" ya no tiene copias de sobra para completar el intercambio.', v_item.card_name;
    end if;

    -- Lo PEDIDO (items del receiver) no puede superar lo que tiene marcado
    -- como disponible ahora mismo (pudo cambiar desde que se creó la
    -- oferta). Esto por sí solo ya garantiza que nunca llegue a 0
    -- (public_quantity siempre <= quantity - 1 por el check de la tabla).
    if v_item.user_id = v_trade.receiver_id and coalesce(v_current_public_qty, 0) < v_item.quantity then
      raise exception '"%" ya no tiene suficientes copias disponibles para intercambio.', v_item.card_name;
    end if;

    perform public.decrease_user_card(v_item.user_id, v_item.card_id, v_item.quantity);
    perform public.increase_user_card(v_item.other_user_id, v_item.card_id, v_item.quantity);
  end loop;

  update public.trades
  set status = 'aceptado', resolved_at = now()
  where id = p_trade_id;
end;
$$;

revoke all on function public.accept_trade(uuid) from public;
grant execute on function public.accept_trade(uuid) to authenticated;


-- ============================================================================
-- Archivo: supabase/migrations/20260903000000_trade_history_clear.sql
-- ============================================================================

-- ============================================================================
-- Borrar historial de intercambios: cada usuario puede ocultar de SU lado
-- los intercambios ya resueltos (aceptado/rechazado/cancelado/expirado).
-- No es un delete físico de la fila (la otra parte del intercambio puede
-- seguir queriendo verlo en su propio historial), así que se resuelve con
-- dos columnas booleanas -- una por lado -- en vez de tocar la fila de
-- trades en sí.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.trades
  add column hidden_by_sender boolean not null default false,
  add column hidden_by_receiver boolean not null default false;

comment on column public.trades.hidden_by_sender is
  'El sender borró este intercambio (ya resuelto) de SU historial. No afecta lo que ve el receiver.';
comment on column public.trades.hidden_by_receiver is
  'El receiver borró este intercambio (ya resuelto) de SU historial. No afecta lo que ve el sender.';


create or replace function public.clear_trade_history()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  update public.trades
  set hidden_by_sender = true
  where sender_id = v_user_id and status <> 'pendiente';

  update public.trades
  set hidden_by_receiver = true
  where receiver_id = v_user_id and status <> 'pendiente';
end;
$$;

revoke all on function public.clear_trade_history() from public;
grant execute on function public.clear_trade_history() to authenticated;


-- ============================================================================
-- Archivo: supabase/migrations/20260904000000_decks.sql
-- ============================================================================

-- ============================================================================
-- Mazos guardados: hasta 3 por jugador, hasta 40 cartas cada uno, con
-- límites de copias por carta (según Poder, que sigue oculto para el
-- jugador -- acá solo se usa como regla interna de validación).
--
-- decks/deck_cards quedan igual que trades: RLS habilitado con SELECT de
-- las propias filas, pero SIN policies de insert/update/delete -- toda
-- escritura pasa por save_deck/delete_deck (ambas security definer), que
-- son las únicas que pueden validar "no más de 3 mazos", "no más copias
-- de las que tengo", "no más de lo que permite el Poder de esa carta" y
-- aplicar la protección automática de public_quantity en una sola
-- transacción. Dejar insert/update directo abierto por RLS haría trivial
-- saltarse todas esas reglas desde el cliente.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- TABLAS
-- ============================================================================

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.decks is 'Mazos guardados de cada jugador (hasta 3).';
comment on column public.decks.is_complete is
  'true solo cuando el mazo tiene exactamente 40 cartas y cumple todas las reglas. Se recalcula en cada save_deck.';

create index idx_decks_user_id on public.decks (user_id);


create table public.deck_cards (
  deck_id uuid not null references public.decks (id) on delete cascade,
  card_id uuid not null references public.cards (id),
  quantity integer not null check (quantity > 0),
  primary key (deck_id, card_id)
);

comment on table public.deck_cards is 'Cartas y cantidades de cada mazo.';

create index idx_deck_cards_card_id on public.deck_cards (card_id);


alter table public.decks enable row level security;
alter table public.deck_cards enable row level security;

create policy decks_select_own
  on public.decks for select
  to authenticated
  using (user_id = auth.uid());

create policy deck_cards_select_own
  on public.deck_cards for select
  to authenticated
  using (
    exists (
      select 1 from public.decks d
      where d.id = deck_cards.deck_id and d.user_id = auth.uid()
    )
  );


-- ============================================================================
-- release_unused_reservation: sube public_quantity de una carta hasta lo
-- que corresponde según cuánto se usa AHORA en los mazos del jugador --
-- nunca la baja (eso es trabajo de save_deck). Se llama después de sacar
-- una carta de un mazo (o borrar el mazo entero) para la carta que
-- corresponda, no antes.
-- ============================================================================

create or replace function public.release_unused_reservation(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_max_in_decks integer;
  v_owned integer;
  v_new_public integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select coalesce(max(dc.quantity), 0) into v_max_in_decks
  from public.deck_cards dc
  join public.decks d on d.id = dc.deck_id
  where d.user_id = v_user_id and dc.card_id = p_card_id;

  select quantity into v_owned
  from public.user_cards
  where user_id = v_user_id and card_id = p_card_id;

  if v_owned is null then
    return;
  end if;

  v_new_public := v_owned - v_max_in_decks;

  update public.user_cards
  set public_quantity = v_new_public
  where user_id = v_user_id and card_id = p_card_id
    and public_quantity < v_new_public;
end;
$$;

revoke all on function public.release_unused_reservation(uuid) from public;
grant execute on function public.release_unused_reservation(uuid) to authenticated;


-- ============================================================================
-- save_deck: crea o actualiza un mazo completo (nombre + lista de cartas)
-- en una sola transacción, con toda la validación server-side.
-- p_deck_id null = mazo nuevo. p_cards: jsonb array de
-- {"card_id": uuid, "quantity": int}.
-- ============================================================================

create or replace function public.save_deck(p_deck_id uuid, p_name text, p_cards jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deck_id uuid;
  v_deck_count integer;
  v_total_qty integer := 0;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_owned integer;
  v_power integer;
  v_card_name text;
  v_max_for_card integer;
  v_is_complete boolean;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Ingresa un nombre para el mazo.';
  end if;

  if p_cards is null or jsonb_typeof(p_cards) <> 'array' then
    raise exception 'Formato de mazo inválido.';
  end if;

  if p_deck_id is not null then
    if not exists (select 1 from public.decks where id = p_deck_id and user_id = v_user_id) then
      raise exception 'Ese mazo no existe.';
    end if;
    v_deck_id := p_deck_id;
  else
    select count(*) into v_deck_count from public.decks where user_id = v_user_id;
    if v_deck_count >= 3 then
      raise exception 'Ya tienes 3 mazos. Borra alguno antes de crear uno nuevo.';
    end if;
  end if;

  if jsonb_array_length(p_cards) > 0
     and (select count(*) from jsonb_array_elements(p_cards) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_cards) e) then
    raise exception 'No repitas la misma carta: sumá la cantidad en una sola entrada.';
  end if;

  -- Cada carta: tiene que existir, no puede pedir más copias de las que
  -- tengo en mi colección, y no puede superar el máximo que permite el
  -- Poder de esa carta (0 = sin límite, 10 = máximo 1, el resto = máximo 3).
  for v_item in select * from jsonb_array_elements(p_cards)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Carta inválida en el mazo.';
    end if;

    select name, power into v_card_name, v_power
    from public.cards where id = v_card_id and is_active;

    if v_card_name is null then
      raise exception 'Una de las cartas del mazo ya no existe.';
    end if;

    select coalesce(quantity, 0) into v_owned
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    if coalesce(v_owned, 0) < v_quantity then
      raise exception 'No tienes suficientes copias de "%" (tienes %, el mazo pide %).',
        v_card_name, coalesce(v_owned, 0), v_quantity;
    end if;

    v_max_for_card := case
      when v_power = 0 then v_quantity
      when v_power = 10 then 1
      else 3
    end;

    if v_quantity > v_max_for_card then
      raise exception 'No puedes tener más de % copias de "%" en el mazo.', v_max_for_card, v_card_name;
    end if;

    v_total_qty := v_total_qty + v_quantity;
  end loop;

  -- Si se llegó hasta acá, todas las cartas son válidas: is_complete solo
  -- depende de si el total llegó exacto a 40.
  v_is_complete := (v_total_qty = 40);

  if v_deck_id is null then
    insert into public.decks (user_id, name, is_complete)
    values (v_user_id, trim(p_name), v_is_complete)
    returning id into v_deck_id;
  else
    update public.decks
    set name = trim(p_name), is_complete = v_is_complete, updated_at = now()
    where id = v_deck_id;
  end if;

  delete from public.deck_cards where deck_id = v_deck_id;

  if jsonb_array_length(p_cards) > 0 then
    insert into public.deck_cards (deck_id, card_id, quantity)
    select v_deck_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_cards) elem;
  end if;

  -- Protección automática: por cada carta del mazo, public_quantity no
  -- puede quedar por encima de (cantidad total - lo que usa este mazo).
  -- Solo aprieta -- si ya estaba más bajo (por otro mazo, o porque el
  -- jugador la puso privada a mano), no se toca.
  for v_item in select * from jsonb_array_elements(p_cards)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    update public.user_cards
    set public_quantity = quantity - v_quantity
    where user_id = v_user_id and card_id = v_card_id
      and public_quantity > quantity - v_quantity;
  end loop;

  return v_deck_id;
end;
$$;

revoke all on function public.save_deck(uuid, text, jsonb) from public;
grant execute on function public.save_deck(uuid, text, jsonb) to authenticated;


-- ============================================================================
-- delete_deck: borra un mazo entero. p_release_unused controla si, después
-- de borrarlo, se llama release_unused_reservation para cada carta que
-- tenía (para que dejen de estar "protegidas" si ya no las usa otro
-- mazo). Se calcula la lista de cartas ANTES de borrar (el delete
-- cascadea a deck_cards) y se libera DESPUÉS, así release_unused_reservation
-- ya no cuenta este mazo al recalcular el máximo.
-- ============================================================================

create or replace function public.delete_deck(p_deck_id uuid, p_release_unused boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_card_ids uuid[];
  v_card_id uuid;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  if not exists (select 1 from public.decks where id = p_deck_id and user_id = v_user_id) then
    raise exception 'Ese mazo no existe.';
  end if;

  if p_release_unused then
    select array_agg(distinct card_id) into v_card_ids
    from public.deck_cards
    where deck_id = p_deck_id;
  end if;

  delete from public.decks where id = p_deck_id and user_id = v_user_id;

  if p_release_unused and v_card_ids is not null then
    foreach v_card_id in array v_card_ids loop
      perform public.release_unused_reservation(v_card_id);
    end loop;
  end if;
end;
$$;

revoke all on function public.delete_deck(uuid, boolean) from public;
grant execute on function public.delete_deck(uuid, boolean) to authenticated;


-- ============================================================================
-- Archivo: supabase/migrations/20260905000000_decks_protect_on_gain.sql
-- ============================================================================

-- ============================================================================
-- Bug real encontrado en producción: ganar más copias de una carta (canje
-- o intercambio) pasaba por increase_user_card, que -- si trade_default es
-- "publicas" (el default) -- pisaba public_quantity a (cantidad nueva - 1)
-- SIN mirar si algún mazo ya reservaba esa carta. Resultado: guardar un
-- mazo protegía la carta correctamente, pero la siguiente vez que el
-- jugador ganaba una copia más (de esa misma carta, en cualquier otro
-- canje o intercambio) la protección del mazo quedaba pisada, y la carta
-- volvía a aparecer disponible para que otros la pidieran -- exactamente
-- lo que reportó el jugador ("un mazo completo con 34 copias de la misma
-- carta seguía saliendo disponible en intercambios").
--
-- Fix: increase_user_card ahora respeta el máximo reservado entre TODOS
-- los mazos del jugador para esa carta (mismo cálculo que ya usa
-- release_unused_reservation) -- nunca hace pública más cantidad de la
-- que los mazos necesitan tener privada, sin importar trade_default. Si
-- ningún mazo usa la carta, el comportamiento es idéntico al de antes
-- (guarda 1 copia privada siempre).
--
-- De paso, save_deck también se corrige: antes calculaba cuánto proteger
-- mirando SOLO el mazo que se estaba guardando en ese momento, así que si
-- una carta se usaba en dos mazos a la vez, guardar el segundo podía
-- destrabar de más lo que el primero necesitaba. Ahora usa el mismo
-- cálculo de "máximo entre todos los mazos" en los dos lados.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.increase_user_card(p_user_id uuid, p_card_id uuid, p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default text;
  v_new_quantity integer;
  v_deck_usage integer;
  v_reserved integer;
begin
  select trade_default into v_default from public.profiles where id = p_user_id;

  insert into public.user_cards (user_id, card_id, quantity, public_quantity)
  values (p_user_id, p_card_id, p_delta, 0)
  on conflict (user_id, card_id)
  do update set quantity = public.user_cards.quantity + p_delta
  returning quantity into v_new_quantity;

  if v_default = 'publicas' then
    -- Cuánto necesitan los mazos que usan esta carta que quede privado
    -- (el máximo entre todos ellos, no la suma -- mismo criterio que
    -- release_unused_reservation). Si ningún mazo la usa, sigue rigiendo
    -- la regla de siempre: al menos 1 copia privada.
    select coalesce(max(dc.quantity), 0) into v_deck_usage
    from public.deck_cards dc
    join public.decks d on d.id = dc.deck_id
    where d.user_id = p_user_id and dc.card_id = p_card_id;

    v_reserved := greatest(1, v_deck_usage);

    update public.user_cards
    set public_quantity = greatest(0, v_new_quantity - v_reserved)
    where user_id = p_user_id and card_id = p_card_id;
  end if;

  return v_new_quantity;
end;
$$;

revoke all on function public.increase_user_card(uuid, uuid, integer) from public;


create or replace function public.save_deck(p_deck_id uuid, p_name text, p_cards jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deck_id uuid;
  v_deck_count integer;
  v_total_qty integer := 0;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_owned integer;
  v_power integer;
  v_card_name text;
  v_max_for_card integer;
  v_is_complete boolean;
  v_max_in_decks integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Ingresa un nombre para el mazo.';
  end if;

  if p_cards is null or jsonb_typeof(p_cards) <> 'array' then
    raise exception 'Formato de mazo inválido.';
  end if;

  if p_deck_id is not null then
    if not exists (select 1 from public.decks where id = p_deck_id and user_id = v_user_id) then
      raise exception 'Ese mazo no existe.';
    end if;
    v_deck_id := p_deck_id;
  else
    select count(*) into v_deck_count from public.decks where user_id = v_user_id;
    if v_deck_count >= 3 then
      raise exception 'Ya tienes 3 mazos. Borra alguno antes de crear uno nuevo.';
    end if;
  end if;

  if jsonb_array_length(p_cards) > 0
     and (select count(*) from jsonb_array_elements(p_cards) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_cards) e) then
    raise exception 'No repitas la misma carta: sumá la cantidad en una sola entrada.';
  end if;

  for v_item in select * from jsonb_array_elements(p_cards)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Carta inválida en el mazo.';
    end if;

    select name, power into v_card_name, v_power
    from public.cards where id = v_card_id and is_active;

    if v_card_name is null then
      raise exception 'Una de las cartas del mazo ya no existe.';
    end if;

    select coalesce(quantity, 0) into v_owned
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    if coalesce(v_owned, 0) < v_quantity then
      raise exception 'No tienes suficientes copias de "%" (tienes %, el mazo pide %).',
        v_card_name, coalesce(v_owned, 0), v_quantity;
    end if;

    v_max_for_card := case
      when v_power = 0 then v_quantity
      when v_power = 10 then 1
      else 3
    end;

    if v_quantity > v_max_for_card then
      raise exception 'No puedes tener más de % copias de "%" en el mazo.', v_max_for_card, v_card_name;
    end if;

    v_total_qty := v_total_qty + v_quantity;
  end loop;

  v_is_complete := (v_total_qty = 40);

  if v_deck_id is null then
    insert into public.decks (user_id, name, is_complete)
    values (v_user_id, trim(p_name), v_is_complete)
    returning id into v_deck_id;
  else
    update public.decks
    set name = trim(p_name), is_complete = v_is_complete, updated_at = now()
    where id = v_deck_id;
  end if;

  delete from public.deck_cards where deck_id = v_deck_id;

  if jsonb_array_length(p_cards) > 0 then
    insert into public.deck_cards (deck_id, card_id, quantity)
    select v_deck_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_cards) elem;
  end if;

  -- Protección automática: para cada carta del mazo, se recalcula cuánto
  -- necesita quedar privado mirando el MÁXIMO entre TODOS los mazos del
  -- jugador que usan esa carta (no solo este mazo) -- así una carta
  -- compartida entre dos mazos queda protegida para el que más necesite,
  -- sin que guardar el segundo destrabe de más lo que pedía el primero.
  -- Solo aprieta -- si ya estaba más bajo, no se toca.
  for v_item in select * from jsonb_array_elements(p_cards)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;

    select coalesce(max(dc.quantity), 0) into v_max_in_decks
    from public.deck_cards dc
    join public.decks d on d.id = dc.deck_id
    where d.user_id = v_user_id and dc.card_id = v_card_id;

    update public.user_cards
    set public_quantity = quantity - v_max_in_decks
    where user_id = v_user_id and card_id = v_card_id
      and public_quantity > quantity - v_max_in_decks;
  end loop;

  return v_deck_id;
end;
$$;

revoke all on function public.save_deck(uuid, text, jsonb) from public;
grant execute on function public.save_deck(uuid, text, jsonb) to authenticated;


-- ============================================================================
-- Backfill: corrige de una vez las cartas que ya quedaron mal por el bug
-- de arriba (protección pisada por una ganancia posterior), sin esperar a
-- que el jugador vuelva a guardar cada mazo a mano.
-- ============================================================================

with reserved as (
  select
    d.user_id,
    dc.card_id,
    max(dc.quantity) as max_reserved
  from public.deck_cards dc
  join public.decks d on d.id = dc.deck_id
  group by d.user_id, dc.card_id
)
update public.user_cards uc
set public_quantity = uc.quantity - r.max_reserved
from reserved r
where uc.user_id = r.user_id
  and uc.card_id = r.card_id
  and uc.public_quantity > uc.quantity - r.max_reserved;


-- ============================================================================
-- Archivo: supabase/migrations/20260906000000_trades_respect_deck_reservation.sql
-- ============================================================================

-- ============================================================================
-- Bug confirmado: ofrecer una carta en un intercambio (a diferencia de
-- pedirla) está diseñado a propósito para no depender de public_quantity
-- -- un jugador siempre puede ofrecer voluntariamente sus propias cartas,
-- estén marcadas públicas o no (así se pidió explícitamente cuando se
-- armó el sistema de privacidad). Pero eso significaba que una carta
-- reservada por un mazo completo (o en armado) SÍ se podía ofrecer y
-- mandar en un intercambio igual, rompiendo el mazo.
--
-- Fix: create_trade y accept_trade ahora also protegen contra romper un
-- mazo del lado de lo OFRECIDO, con el mismo criterio que ya usan
-- increase_user_card/save_deck: la cantidad mínima que nunca se puede
-- ofrecer es el máximo entre 1 (la regla de siempre) y lo que reserva
-- cualquiera de los mazos del jugador para esa carta.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.create_trade(
  p_receiver_id uuid,
  p_message text,
  p_offer jsonb,
  p_request jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade_id uuid;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_owned integer;
  v_committed integer;
  v_card_name text;
  v_public_qty integer;
  v_deck_reserved integer;
  v_min_reserved integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión para proponer un intercambio.';
  end if;

  if p_receiver_id is null then
    raise exception 'Elige con quién quieres intercambiar.';
  end if;

  if p_receiver_id = v_user_id then
    raise exception 'No puedes proponerte un intercambio a ti mismo.';
  end if;

  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'Ese jugador no existe.';
  end if;

  if p_message is not null and length(p_message) > 280 then
    raise exception 'El mensaje es demasiado largo (máximo 280 caracteres).';
  end if;

  if p_offer is null or jsonb_typeof(p_offer) <> 'array' or jsonb_array_length(p_offer) = 0 then
    raise exception 'Elige al menos una carta para ofrecer.';
  end if;

  if p_request is not null and jsonb_typeof(p_request) <> 'array' then
    raise exception 'Pedido inválido.';
  end if;

  if (select count(*) from jsonb_array_elements(p_offer) e)
     <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_offer) e) then
    raise exception 'No repitas la misma carta en la oferta: sumá la cantidad en una sola entrada.';
  end if;

  if p_request is not null and jsonb_array_length(p_request) > 0
     and (select count(*) from jsonb_array_elements(p_request) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_request) e) then
    raise exception 'No repitas la misma carta en el pedido: sumá la cantidad en una sola entrada.';
  end if;

  -- Cada carta ofrecida: tiene que existir, y lo que ya tiene el usuario
  -- menos lo ya comprometido en otras ofertas pendientes menos lo que
  -- reserva cualquiera de sus mazos (o 1, lo que sea mayor) tiene que
  -- alcanzar para esta cantidad. Ofrecer una carta reservada por un mazo
  -- rompería ese mazo.
  for v_item in select * from jsonb_array_elements(p_offer)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Oferta inválida.';
    end if;

    select name into v_card_name from public.cards where id = v_card_id and is_active;
    if v_card_name is null then
      raise exception 'Una de las cartas ofrecidas ya no existe.';
    end if;

    select coalesce(quantity, 0) into v_owned
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    select coalesce(sum(ti.quantity), 0) into v_committed
    from public.trade_items ti
    join public.trades t on t.id = ti.trade_id
    where ti.user_id = v_user_id
      and ti.card_id = v_card_id
      and t.status = 'pendiente';

    select coalesce(max(dc.quantity), 0) into v_deck_reserved
    from public.deck_cards dc
    join public.decks d on d.id = dc.deck_id
    where d.user_id = v_user_id and dc.card_id = v_card_id;

    v_min_reserved := greatest(1, v_deck_reserved);

    if coalesce(v_owned, 0) - v_min_reserved - v_committed < v_quantity then
      raise exception 'No puedes ofrecer esa cantidad de "%": tienes % copias protegidas (en un mazo, o comprometidas en otras ofertas pendientes).',
        v_card_name, v_min_reserved + v_committed;
    end if;
  end loop;

  -- Cada carta pedida: tiene que existir, y no puede superar el
  -- public_quantity actual del receptor (lo que él marcó como disponible
  -- para intercambio, no toda su cantidad).
  if p_request is not null then
    for v_item in select * from jsonb_array_elements(p_request)
    loop
      v_card_id := (v_item ->> 'card_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;

      if v_card_id is null or v_quantity is null or v_quantity <= 0 then
        raise exception 'Pedido inválido.';
      end if;

      select name into v_card_name from public.cards where id = v_card_id and is_active;
      if v_card_name is null then
        raise exception 'Una de las cartas pedidas ya no existe.';
      end if;

      select coalesce(public_quantity, 0) into v_public_qty
      from public.user_cards
      where user_id = p_receiver_id and card_id = v_card_id;

      if coalesce(v_public_qty, 0) < v_quantity then
        raise exception '"%" no tiene suficientes copias disponibles para intercambio.', v_card_name;
      end if;
    end loop;
  end if;

  insert into public.trades (sender_id, receiver_id, message, status, expires_at)
  values (v_user_id, p_receiver_id, nullif(trim(p_message), ''), 'pendiente', now() + interval '7 days')
  returning id into v_trade_id;

  insert into public.trade_items (trade_id, user_id, card_id, quantity)
  select v_trade_id, v_user_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
  from jsonb_array_elements(p_offer) elem;

  if p_request is not null and jsonb_array_length(p_request) > 0 then
    insert into public.trade_items (trade_id, user_id, card_id, quantity)
    select v_trade_id, p_receiver_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_request) elem;
  end if;

  return v_trade_id;
end;
$$;

revoke all on function public.create_trade(uuid, text, jsonb, jsonb) from public;
grant execute on function public.create_trade(uuid, text, jsonb, jsonb) to authenticated;


create or replace function public.accept_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade public.trades%rowtype;
  v_item record;
  v_current_qty integer;
  v_current_public_qty integer;
  v_deck_reserved integer;
  v_min_reserved integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Ese intercambio no existe.';
  end if;

  if v_user_id <> v_trade.receiver_id then
    raise exception 'Solo quien recibe la oferta puede aceptarla.';
  end if;

  if v_trade.status <> 'pendiente' then
    raise exception 'Este intercambio ya no está pendiente.';
  end if;

  if v_trade.expires_at is not null and v_trade.expires_at < now() then
    update public.trades set status = 'expirado', resolved_at = now() where id = p_trade_id;
    raise exception 'Este intercambio ya venció.';
  end if;

  for v_item in
    select
      ti.user_id,
      ti.card_id,
      ti.quantity,
      c.name as card_name,
      case when ti.user_id = v_trade.sender_id then v_trade.receiver_id else v_trade.sender_id end as other_user_id
    from public.trade_items ti
    join public.cards c on c.id = ti.card_id
    where ti.trade_id = p_trade_id
    order by ti.card_id, ti.user_id
  loop
    select quantity, public_quantity into v_current_qty, v_current_public_qty
    from public.user_cards
    where user_id = v_item.user_id and card_id = v_item.card_id
    for update;

    if v_current_qty is null or v_current_qty < v_item.quantity then
      raise exception 'Ya no hay suficientes copias de "%" para completar el intercambio.', v_item.card_name;
    end if;

    -- Lo OFRECIDO (items del sender) nunca puede dejarlo por debajo de lo
    -- que reserva alguno de sus mazos (o 1, la regla de siempre) --
    -- revalidado acá por si armó/guardó un mazo con esta carta después de
    -- crear la oferta.
    if v_item.user_id = v_trade.sender_id then
      select coalesce(max(dc.quantity), 0) into v_deck_reserved
      from public.deck_cards dc
      join public.decks d on d.id = dc.deck_id
      where d.user_id = v_item.user_id and dc.card_id = v_item.card_id;

      v_min_reserved := greatest(1, v_deck_reserved);

      if v_current_qty - v_item.quantity < v_min_reserved then
        raise exception 'Quien ofreció "%" la tiene reservada en un mazo y ya no puede completar el intercambio.', v_item.card_name;
      end if;
    end if;

    -- Lo PEDIDO (items del receiver) no puede superar lo que tiene marcado
    -- como disponible ahora mismo (pudo cambiar desde que se creó la
    -- oferta). Esto por sí solo ya garantiza que nunca llegue a 0
    -- (public_quantity siempre <= quantity - 1 por el check de la tabla).
    if v_item.user_id = v_trade.receiver_id and coalesce(v_current_public_qty, 0) < v_item.quantity then
      raise exception '"%" ya no tiene suficientes copias disponibles para intercambio.', v_item.card_name;
    end if;

    perform public.decrease_user_card(v_item.user_id, v_item.card_id, v_item.quantity);
    perform public.increase_user_card(v_item.other_user_id, v_item.card_id, v_item.quantity);
  end loop;

  update public.trades
  set status = 'aceptado', resolved_at = now()
  where id = p_trade_id;
end;
$$;

revoke all on function public.accept_trade(uuid) from public;
grant execute on function public.accept_trade(uuid) to authenticated;


-- ============================================================================
-- Archivo: supabase/migrations/20260907000000_feedback.sql
-- ============================================================================

-- ============================================================================
-- Feedback de jugadores: botón flotante en toda la app que abre un
-- formulario corto (tipo + mensaje). page_path se guarda solo, sin
-- pedírselo al jugador. No hay política de SELECT para anon/authenticated
-- a propósito (mismo patrón que `codes`): solo se lee desde /admin/feedback,
-- que usa el cliente service_role.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('falla', 'sugerencia', 'otro')),
  page_path text not null,
  message text not null check (length(trim(message)) > 0),
  created_at timestamptz not null default now()
);

comment on table public.feedback is
  'Feedback enviado por jugadores desde el botón flotante. Solo lectura para admins (service_role).';
comment on column public.feedback.user_id is
  'Null si se envió sin sesión iniciada. on delete set null: no se pierde el feedback si se borra la cuenta.';
comment on column public.feedback.page_path is
  'Ruta desde la que se envió, capturada sola (nunca la escribe el jugador).';

create index idx_feedback_created_at on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Cualquiera puede dejar feedback (con o sin sesión), pero solo puede
-- adjudicárselo a sí mismo: user_id tiene que ser null o su propio uid.
-- Sin policy de SELECT/UPDATE/DELETE: una vez enviado, ni se puede leer ni
-- tocar desde el cliente.
create policy feedback_insert_any
  on public.feedback for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());


-- ============================================================================
-- Archivo: supabase/migrations/20260907010000_profile_welcome.sql
-- ============================================================================

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


-- ============================================================================
-- Archivo: supabase/migrations/20260908000000_privacy_respects_decks.sql
-- ============================================================================

-- ============================================================================
-- Bug confirmado: la privacidad de cartas (public_quantity) y la reserva
-- por mazos vivían en dos mundos separados. Cinco lugares distintos tenían
-- copiada la misma cuenta de "cuánto reserva esta carta en mis mazos", y
-- dos de ellos nunca la aplicaron:
--   - set_card_public_quantity (el stepper de una carta puntual en
--     /coleccion/[slug]) dejaba marcar como pública una cantidad que
--     invadía la reserva de un mazo.
--   - set_all_cards_public ("Marcar todo público" en Preferencia de
--     intercambio) hacía lo mismo para TODA la colección de una sola vez.
--   - Y peor: create_trade/accept_trade nunca miraban public_quantity al
--     OFRECER (una decisión explícita de una vuelta anterior: "ofrecer
--     siempre está permitido"), solo chequeaban la reserva de mazo directo
--     -- así que aunque una carta apareciera con 0 marcadas para
--     intercambio en /coleccion, igual se podía ofrecer en un intercambio.
--
-- Fix: se centraliza el cálculo en deck_reserved_quantity() y se aplica
-- ahora en TODOS los lugares que tocan public_quantity o mueven cartas
-- (set_card_public_quantity, set_all_cards_public, decrease_user_card), y
-- create_trade/accept_trade pasan a exigir que lo OFRECIDO no supere el
-- public_quantity de quien ofrece -- ya no hace falta que miren la reserva
-- de mazo por separado, porque public_quantity ahora siempre la tiene
-- descontada en origen. Termina con un backfill que reclama cualquier
-- public_quantity que haya quedado mal por el bug de arriba.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- deck_reserved_quantity: cuánto de esta carta está en uso en alguno de los
-- mazos del jugador -- el MÁXIMO entre todos los mazos que la usan, no la
-- suma (un jugador solo juega un mazo a la vez). Mismo cálculo que ya
-- usaban por separado save_deck, increase_user_card,
-- release_unused_reservation y create_trade/accept_trade: se centraliza
-- acá para que dejen de poder desincronizarse entre sí.
-- ============================================================================

create or replace function public.deck_reserved_quantity(p_user_id uuid, p_card_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(dc.quantity), 0)
  from public.deck_cards dc
  join public.decks d on d.id = dc.deck_id
  where d.user_id = p_user_id and dc.card_id = p_card_id;
$$;

revoke all on function public.deck_reserved_quantity(uuid, uuid) from public;


-- ============================================================================
-- set_card_public_quantity: el máximo ya no es "quantity - 1" a secas, sino
-- "quantity - reservado" (reservado = máximo entre 1 y lo que use algún
-- mazo) -- así el jugador no puede marcar como pública una copia que su
-- mazo necesita.
-- ============================================================================

create or replace function public.set_card_public_quantity(p_card_id uuid, p_public_quantity integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quantity integer;
  v_max_public integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select quantity into v_quantity
  from public.user_cards
  where user_id = v_user_id and card_id = p_card_id;

  if v_quantity is null then
    raise exception 'No tienes esa carta.';
  end if;

  v_max_public := v_quantity - greatest(1, public.deck_reserved_quantity(v_user_id, p_card_id));

  if p_public_quantity < 0 or p_public_quantity > v_max_public then
    raise exception 'La cantidad disponible debe estar entre 0 y %.', v_max_public;
  end if;

  update public.user_cards
  set public_quantity = p_public_quantity
  where user_id = v_user_id and card_id = p_card_id;
end;
$$;

revoke all on function public.set_card_public_quantity(uuid, integer) from public;
grant execute on function public.set_card_public_quantity(uuid, integer) to authenticated;


-- ============================================================================
-- set_all_cards_public: mismo criterio, carta por carta (antes ponía
-- "quantity - 1" para todas por igual, sin mirar mazos).
-- ============================================================================

create or replace function public.set_all_cards_public()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_cards uc
  set public_quantity = greatest(
    0,
    uc.quantity - greatest(1, public.deck_reserved_quantity(uc.user_id, uc.card_id))
  )
  where uc.user_id = auth.uid();
$$;

revoke all on function public.set_all_cards_public() from public;
grant execute on function public.set_all_cards_public() to authenticated;

-- set_all_cards_private no cambia: 0 siempre es válido, con o sin mazo.


-- ============================================================================
-- decrease_user_card: al bajar quantity (ofrecer/perder copias), el clamp
-- de public_quantity ahora también respeta la reserva de mazo, no solo
-- "quantity - 1".
-- ============================================================================

create or replace function public.decrease_user_card(p_user_id uuid, p_card_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_qty integer;
  v_new_quantity integer;
  v_min_reserved integer;
begin
  select quantity into v_current_qty
  from public.user_cards
  where user_id = p_user_id and card_id = p_card_id
  for update;

  if v_current_qty is null or v_current_qty < p_delta then
    raise exception 'No hay suficientes copias para descontar.';
  end if;

  v_new_quantity := v_current_qty - p_delta;

  if v_new_quantity = 0 then
    delete from public.user_cards where user_id = p_user_id and card_id = p_card_id;
  else
    v_min_reserved := greatest(1, public.deck_reserved_quantity(p_user_id, p_card_id));
    update public.user_cards
    set quantity = v_new_quantity,
        public_quantity = least(public_quantity, greatest(0, v_new_quantity - v_min_reserved))
    where user_id = p_user_id and card_id = p_card_id;
  end if;
end;
$$;

revoke all on function public.decrease_user_card(uuid, uuid, integer) from public;


-- ============================================================================
-- create_trade: lo OFRECIDO ahora tiene que respetar public_quantity (ya no
-- alcanza con "dejar al menos 1 copia propia"). Como public_quantity ya
-- tiene descontada la reserva de mazo en origen (ver funciones de arriba),
-- un solo chequeo cubre las dos reglas -- no hace falta mirar deck_cards
-- de nuevo acá.
-- ============================================================================

create or replace function public.create_trade(
  p_receiver_id uuid,
  p_message text,
  p_offer jsonb,
  p_request jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade_id uuid;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_committed integer;
  v_card_name text;
  v_public_qty integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión para proponer un intercambio.';
  end if;

  if p_receiver_id is null then
    raise exception 'Elige con quién quieres intercambiar.';
  end if;

  if p_receiver_id = v_user_id then
    raise exception 'No puedes proponerte un intercambio a ti mismo.';
  end if;

  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'Ese jugador no existe.';
  end if;

  if p_message is not null and length(p_message) > 280 then
    raise exception 'El mensaje es demasiado largo (máximo 280 caracteres).';
  end if;

  if p_offer is null or jsonb_typeof(p_offer) <> 'array' or jsonb_array_length(p_offer) = 0 then
    raise exception 'Elige al menos una carta para ofrecer.';
  end if;

  if p_request is not null and jsonb_typeof(p_request) <> 'array' then
    raise exception 'Pedido inválido.';
  end if;

  if (select count(*) from jsonb_array_elements(p_offer) e)
     <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_offer) e) then
    raise exception 'No repitas la misma carta en la oferta: sumá la cantidad en una sola entrada.';
  end if;

  if p_request is not null and jsonb_array_length(p_request) > 0
     and (select count(*) from jsonb_array_elements(p_request) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_request) e) then
    raise exception 'No repitas la misma carta en el pedido: sumá la cantidad en una sola entrada.';
  end if;

  -- Cada carta ofrecida: tiene que existir, y no puede superar lo que el
  -- propio jugador marcó como disponible para intercambio (public_quantity)
  -- menos lo ya comprometido en sus otras ofertas pendientes.
  for v_item in select * from jsonb_array_elements(p_offer)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Oferta inválida.';
    end if;

    select name into v_card_name from public.cards where id = v_card_id and is_active;
    if v_card_name is null then
      raise exception 'Una de las cartas ofrecidas ya no existe.';
    end if;

    select coalesce(public_quantity, 0) into v_public_qty
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    select coalesce(sum(ti.quantity), 0) into v_committed
    from public.trade_items ti
    join public.trades t on t.id = ti.trade_id
    where ti.user_id = v_user_id
      and ti.card_id = v_card_id
      and t.status = 'pendiente';

    if coalesce(v_public_qty, 0) - v_committed < v_quantity then
      raise exception 'No puedes ofrecer esa cantidad de "%": solo tienes % copias disponibles para intercambio ahora mismo (contando lo ya comprometido en otras ofertas). Revisa la privacidad de esa carta en tu colección.',
        v_card_name, greatest(0, coalesce(v_public_qty, 0) - v_committed);
    end if;
  end loop;

  -- Cada carta pedida: tiene que existir, y no puede superar el
  -- public_quantity actual del receptor (lo que él marcó como disponible
  -- para intercambio, no toda su cantidad).
  if p_request is not null then
    for v_item in select * from jsonb_array_elements(p_request)
    loop
      v_card_id := (v_item ->> 'card_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;

      if v_card_id is null or v_quantity is null or v_quantity <= 0 then
        raise exception 'Pedido inválido.';
      end if;

      select name into v_card_name from public.cards where id = v_card_id and is_active;
      if v_card_name is null then
        raise exception 'Una de las cartas pedidas ya no existe.';
      end if;

      select coalesce(public_quantity, 0) into v_public_qty
      from public.user_cards
      where user_id = p_receiver_id and card_id = v_card_id;

      if coalesce(v_public_qty, 0) < v_quantity then
        raise exception '"%" no tiene suficientes copias disponibles para intercambio.', v_card_name;
      end if;
    end loop;
  end if;

  insert into public.trades (sender_id, receiver_id, message, status, expires_at)
  values (v_user_id, p_receiver_id, nullif(trim(p_message), ''), 'pendiente', now() + interval '7 days')
  returning id into v_trade_id;

  insert into public.trade_items (trade_id, user_id, card_id, quantity)
  select v_trade_id, v_user_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
  from jsonb_array_elements(p_offer) elem;

  if p_request is not null and jsonb_array_length(p_request) > 0 then
    insert into public.trade_items (trade_id, user_id, card_id, quantity)
    select v_trade_id, p_receiver_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_request) elem;
  end if;

  return v_trade_id;
end;
$$;

revoke all on function public.create_trade(uuid, text, jsonb, jsonb) from public;
grant execute on function public.create_trade(uuid, text, jsonb, jsonb) to authenticated;


-- ============================================================================
-- accept_trade: la revalidación de último momento (por si algo cambió
-- desde que se creó la oferta) ahora es UN solo chequeo simétrico para
-- ambos lados del trade -- tanto lo ofrecido como lo pedido son "cartas que
-- esta persona está entregando", y las dos tienen que respetar su propio
-- public_quantity actual. Ya no hace falta mirar deck_cards acá: al estar
-- garantizado en origen, alcanza con public_quantity.
-- ============================================================================

create or replace function public.accept_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade public.trades%rowtype;
  v_item record;
  v_current_qty integer;
  v_current_public_qty integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Ese intercambio no existe.';
  end if;

  if v_user_id <> v_trade.receiver_id then
    raise exception 'Solo quien recibe la oferta puede aceptarla.';
  end if;

  if v_trade.status <> 'pendiente' then
    raise exception 'Este intercambio ya no está pendiente.';
  end if;

  if v_trade.expires_at is not null and v_trade.expires_at < now() then
    update public.trades set status = 'expirado', resolved_at = now() where id = p_trade_id;
    raise exception 'Este intercambio ya venció.';
  end if;

  for v_item in
    select
      ti.user_id,
      ti.card_id,
      ti.quantity,
      c.name as card_name,
      case when ti.user_id = v_trade.sender_id then v_trade.receiver_id else v_trade.sender_id end as other_user_id
    from public.trade_items ti
    join public.cards c on c.id = ti.card_id
    where ti.trade_id = p_trade_id
    order by ti.card_id, ti.user_id
  loop
    select quantity, public_quantity into v_current_qty, v_current_public_qty
    from public.user_cards
    where user_id = v_item.user_id and card_id = v_item.card_id
    for update;

    if v_current_qty is null or v_current_qty < v_item.quantity then
      raise exception 'Ya no hay suficientes copias de "%" para completar el intercambio.', v_item.card_name;
    end if;

    if coalesce(v_current_public_qty, 0) < v_item.quantity then
      raise exception '"%" ya no tiene suficientes copias disponibles para intercambio (quedó reservada, o ya se comprometió en otra oferta).', v_item.card_name;
    end if;

    perform public.decrease_user_card(v_item.user_id, v_item.card_id, v_item.quantity);
    perform public.increase_user_card(v_item.other_user_id, v_item.card_id, v_item.quantity);
  end loop;

  update public.trades
  set status = 'aceptado', resolved_at = now()
  where id = p_trade_id;
end;
$$;

revoke all on function public.accept_trade(uuid) from public;
grant execute on function public.accept_trade(uuid) to authenticated;


-- ============================================================================
-- Backfill: reclama cualquier public_quantity que haya quedado invadiendo
-- una reserva de mazo por el bug de arriba, sin esperar a que el jugador
-- vuelva a tocar cada carta a mano.
-- ============================================================================

update public.user_cards uc
set public_quantity = greatest(
  0,
  uc.quantity - greatest(1, public.deck_reserved_quantity(uc.user_id, uc.card_id))
)
where uc.public_quantity > greatest(
  0,
  uc.quantity - greatest(1, public.deck_reserved_quantity(uc.user_id, uc.card_id))
);


-- ============================================================================
-- Archivo: supabase/migrations/20260909000000_accounts_blocking_bans.sql
-- ============================================================================

-- ============================================================================
-- Tres funciones de cuenta:
--   1. Eliminar cuenta: audita que todas las tablas con datos del jugador
--      cascadeen al borrar el auth.users (el borrado en sí lo hace un
--      Server Action con service_role, ver app/cuenta/eliminar/actions.ts).
--   2. Bloquear jugador: tabla blocked_users + block_user() (cancela
--      intercambios pendientes entre los dos y saca al bloqueado de mis
--      contactos) + create_trade rechaza si hay bloqueo en cualquier
--      dirección.
--   3. Banear jugador (admin): profiles.banned_until (date) + is_banned()
--      + chequeo en redeem_code/create_trade/accept_trade/save_deck. El
--      chequeo del lado del middleware (redirect a /baneado) vive en
--      lib/supabase/middleware.ts, no acá.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- 1. ELIMINAR CUENTA: auditoría de ON DELETE CASCADE
-- Todas las tablas ya cascadeaban desde auth.users salvo feedback, que a
-- propósito usaba ON DELETE SET NULL (para no perder el feedback si se
-- borraba la cuenta) -- se cambia a CASCADE porque ahora se pidió
-- explícitamente que borrar la cuenta limpie TODO, feedback incluido.
-- user_cards, decks (y deck_cards vía decks), trades/trade_items,
-- redemptions, contacts ya tenían CASCADE desde que se crearon.
-- ============================================================================

alter table public.feedback drop constraint feedback_user_id_fkey;
alter table public.feedback
  add constraint feedback_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;


-- ============================================================================
-- 2. BLOQUEAR JUGADOR
-- ============================================================================

create table public.blocked_users (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

comment on table public.blocked_users is
  'blocker_id bloqueó a blocked_id: no puede proponerle intercambios.';

create index idx_blocked_users_blocked_id on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

-- Cada uno ve y administra solo sus propios bloqueos. No hay policy de
-- INSERT: crear un bloqueo pasa por block_user() (de abajo), que además
-- cancela intercambios pendientes y limpia contactos en la misma
-- transacción -- un insert directo por RLS se saltearía eso. Desbloquear
-- no tiene efectos secundarios, así que sí es un delete directo.
create policy blocked_users_select_own
  on public.blocked_users for select
  to authenticated
  using (blocker_id = auth.uid());

create policy blocked_users_delete_own
  on public.blocked_users for delete
  to authenticated
  using (blocker_id = auth.uid());


create or replace function public.block_user(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  if p_blocked_id is null or p_blocked_id = v_user_id then
    raise exception 'No puedes bloquearte a ti mismo.';
  end if;

  if not exists (select 1 from public.profiles where id = p_blocked_id) then
    raise exception 'Ese jugador no existe.';
  end if;

  insert into public.blocked_users (blocker_id, blocked_id)
  values (v_user_id, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;

  -- Cancela cualquier intercambio pendiente entre los dos, sin importar
  -- quién lo propuso (bloquear tiene que cortar la relación en los dos
  -- sentidos, no solo hacia adelante).
  update public.trades
  set status = 'cancelado', resolved_at = now()
  where status = 'pendiente'
    and ((sender_id = v_user_id and receiver_id = p_blocked_id)
      or (sender_id = p_blocked_id and receiver_id = v_user_id));

  -- Lo saca de MIS contactos si estaba guardado (no toca los contactos del
  -- otro: no tiene por qué enterarse de que lo bloquearon).
  delete from public.contacts
  where user_id = v_user_id and contact_user_id = p_blocked_id;
end;
$$;

revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;


-- ============================================================================
-- 3. BANEAR JUGADOR (admin)
-- ============================================================================

alter table public.profiles
  add column banned_until date;

comment on column public.profiles.banned_until is
  'Baneado mientras current_date < banned_until. Null = sin baneo. Se '
  'setea desde /admin/usuarios (service_role, nunca desde el cliente).';

-- Está baneado mientras hoy sea ANTERIOR a banned_until (si banéas hoy por
-- 1 día, banned_until queda en mañana, y la persona ya puede entrar apenas
-- empiece ese día). Único lugar donde vive esta regla -- todo lo demás
-- (redeem_code, create_trade, accept_trade, save_deck, y el middleware del
-- lado de Next) la consulta acá para no poder desincronizarse.
create or replace function public.is_banned(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = p_user_id
      and banned_until is not null
      and current_date < banned_until
  );
$$;

revoke all on function public.is_banned(uuid) from public;


-- ----------------------------------------------------------------------------
-- redeem_code: mismo cuerpo que trade_privacy.sql, sumando el chequeo de
-- baneo como primer paso después de validar la sesión.
-- ----------------------------------------------------------------------------

create or replace function public.redeem_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_clean text;
  v_lookup_code text;
  v_code_row public.codes%rowtype;
  v_pack public.pack_types%rowtype;
  v_already_redeemed boolean;
  v_selected_card_ids uuid[] := '{}';
  v_awarded jsonb := '[]'::jsonb;
  v_card_json jsonb;
  v_redemption_id uuid;
  v_rarity public.card_rarity;
  v_card_id uuid;
  v_is_new boolean;
  v_current_qty integer;
  v_new_qty integer;
  v_base_pack_image_url text;
  v_pack_image_url text;
  v_trade_default text;
  i integer;
begin
  if v_user_id is null then
    raise exception 'Tenés que iniciar sesión para canjear un código.';
  end if;

  if public.is_banned(v_user_id) then
    raise exception 'Tu cuenta está inhabilitada temporalmente y no puede canjear códigos.';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'Ingresá un código.';
  end if;

  -- 1. Normalizar: mayúsculas, sin guiones ni espacios, y reconstruir el
  -- formato XXXX-XXXX-XXXX (así el lookup usa el índice único de code en
  -- vez de escanear toda la tabla).
  v_clean := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if length(v_clean) <> 12 then
    raise exception 'Ese código no existe.';
  end if;
  v_lookup_code := substr(v_clean, 1, 4) || '-' || substr(v_clean, 5, 4) || '-' || substr(v_clean, 9, 4);

  -- 2. Buscar + bloquear la fila. El lock se mantiene hasta el commit/rollback
  -- de esta transacción, así que un segundo canje simultáneo del MISMO
  -- código queda esperando acá hasta que este termine.
  select * into v_code_row
  from public.codes
  where code = v_lookup_code
  for update;

  if not found then
    raise exception 'Ese código no existe.';
  end if;

  if not v_code_row.is_active then
    raise exception 'Ese código ya no está activo.';
  end if;

  if v_code_row.expires_at is not null and v_code_row.expires_at < now() then
    raise exception 'Ese código venció.';
  end if;

  if v_code_row.uses_count >= v_code_row.max_uses then
    raise exception 'Ese código ya alcanzó el máximo de usos.';
  end if;

  -- 3. one_per_user
  if v_code_row.one_per_user then
    select exists(
      select 1 from public.redemptions
      where code_id = v_code_row.id and user_id = v_user_id
    ) into v_already_redeemed;

    if v_already_redeemed then
      raise exception 'Ya canjeaste este código antes.';
    end if;
  end if;

  select * into v_pack from public.pack_types where id = v_code_row.pack_type_id;
  if not found then
    raise exception 'El tipo de sobre de este código ya no existe. Contactá a un admin.';
  end if;

  -- 4. Sortear las cartas. Si hay guaranteed_rarity, la primera carta sale
  -- de esa rareza; el resto (y esa misma si no hay garantía) se sortea por
  -- rarity_weights. Solo entre cartas activas de los sets permitidos. Si no
  -- hay ninguna de la rareza sorteada en esos sets, se degrada a cualquier
  -- carta activa permitida en vez de romper el canje.
  for i in 1..v_pack.cards_count loop
    if i = 1 and v_pack.guaranteed_rarity is not null then
      v_rarity := v_pack.guaranteed_rarity;
    else
      v_rarity := public.pick_weighted_rarity(v_pack.rarity_weights);
    end if;

    select id into v_card_id
    from public.cards
    where is_active
      and set_id = any(v_pack.allowed_set_ids)
      and rarity = v_rarity
    order by random()
    limit 1;

    if v_card_id is null then
      select id into v_card_id
      from public.cards
      where is_active
        and set_id = any(v_pack.allowed_set_ids)
      order by random()
      limit 1;
    end if;

    if v_card_id is null then
      raise exception 'No hay cartas disponibles para este sobre. Contactá a un admin.';
    end if;

    v_selected_card_ids := array_append(v_selected_card_ids, v_card_id);
  end loop;

  -- 5. Otorgar las cartas vía increase_user_card (aplica trade_default a
  -- las nuevas) y armar el detalle, marcando is_new según si el usuario ya
  -- tenía esa carta.
  for i in 1..array_length(v_selected_card_ids, 1) loop
    v_card_id := v_selected_card_ids[i];

    select quantity into v_current_qty
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    v_is_new := v_current_qty is null;

    select public.increase_user_card(v_user_id, v_card_id, 1) into v_new_qty;

    select jsonb_build_object(
      'card_id', c.id,
      'slug', c.slug,
      'name', c.name,
      'rarity', c.rarity,
      'image_front_url', c.image_front_url,
      'is_new', v_is_new,
      'quantity', v_new_qty
    ) into v_card_json
    from public.cards c
    where c.id = v_card_id;

    v_awarded := v_awarded || jsonb_build_array(v_card_json);
  end loop;

  -- 6. Registrar la redención con el detalle de lo otorgado.
  insert into public.redemptions (code_id, user_id, cards_awarded)
  values (v_code_row.id, v_user_id, v_awarded)
  returning id into v_redemption_id;

  -- 7. Incrementar uses_count.
  update public.codes
  set uses_count = uses_count + 1
  where id = v_code_row.id;

  -- Imagen del sobre: la propia del pack_type si tiene, si no la base de
  -- game_settings. Se resuelve acá para que el cliente no tenga que hacer
  -- una consulta aparte.
  select pack_image_url into v_base_pack_image_url from public.game_settings where id = true;
  v_pack_image_url := coalesce(v_pack.image_url, v_base_pack_image_url);

  select trade_default into v_trade_default from public.profiles where id = v_user_id;

  -- 8. Devolver el detalle.
  return jsonb_build_object(
    'redemption_id', v_redemption_id,
    'pack_type_name', v_pack.name,
    'pack_image_url', v_pack_image_url,
    'trade_default', v_trade_default,
    'cards', v_awarded
  );
end;
$$;

revoke all on function public.redeem_code(text) from public;
grant execute on function public.redeem_code(text) to authenticated;


-- ----------------------------------------------------------------------------
-- save_deck: mismo cuerpo que decks_protect_on_gain.sql, sumando el
-- chequeo de baneo.
-- ----------------------------------------------------------------------------

create or replace function public.save_deck(p_deck_id uuid, p_name text, p_cards jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deck_id uuid;
  v_deck_count integer;
  v_total_qty integer := 0;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_owned integer;
  v_power integer;
  v_card_name text;
  v_max_for_card integer;
  v_is_complete boolean;
  v_max_in_decks integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  if public.is_banned(v_user_id) then
    raise exception 'Tu cuenta está inhabilitada temporalmente y no puede guardar mazos.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Ingresa un nombre para el mazo.';
  end if;

  if p_cards is null or jsonb_typeof(p_cards) <> 'array' then
    raise exception 'Formato de mazo inválido.';
  end if;

  if p_deck_id is not null then
    if not exists (select 1 from public.decks where id = p_deck_id and user_id = v_user_id) then
      raise exception 'Ese mazo no existe.';
    end if;
    v_deck_id := p_deck_id;
  else
    select count(*) into v_deck_count from public.decks where user_id = v_user_id;
    if v_deck_count >= 3 then
      raise exception 'Ya tienes 3 mazos. Borra alguno antes de crear uno nuevo.';
    end if;
  end if;

  if jsonb_array_length(p_cards) > 0
     and (select count(*) from jsonb_array_elements(p_cards) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_cards) e) then
    raise exception 'No repitas la misma carta: sumá la cantidad en una sola entrada.';
  end if;

  for v_item in select * from jsonb_array_elements(p_cards)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Carta inválida en el mazo.';
    end if;

    select name, power into v_card_name, v_power
    from public.cards where id = v_card_id and is_active;

    if v_card_name is null then
      raise exception 'Una de las cartas del mazo ya no existe.';
    end if;

    select coalesce(quantity, 0) into v_owned
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    if coalesce(v_owned, 0) < v_quantity then
      raise exception 'No tienes suficientes copias de "%" (tienes %, el mazo pide %).',
        v_card_name, coalesce(v_owned, 0), v_quantity;
    end if;

    v_max_for_card := case
      when v_power = 0 then v_quantity
      when v_power = 10 then 1
      else 3
    end;

    if v_quantity > v_max_for_card then
      raise exception 'No puedes tener más de % copias de "%" en el mazo.', v_max_for_card, v_card_name;
    end if;

    v_total_qty := v_total_qty + v_quantity;
  end loop;

  v_is_complete := (v_total_qty = 40);

  if v_deck_id is null then
    insert into public.decks (user_id, name, is_complete)
    values (v_user_id, trim(p_name), v_is_complete)
    returning id into v_deck_id;
  else
    update public.decks
    set name = trim(p_name), is_complete = v_is_complete, updated_at = now()
    where id = v_deck_id;
  end if;

  delete from public.deck_cards where deck_id = v_deck_id;

  if jsonb_array_length(p_cards) > 0 then
    insert into public.deck_cards (deck_id, card_id, quantity)
    select v_deck_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_cards) elem;
  end if;

  -- Protección automática: para cada carta del mazo, se recalcula cuánto
  -- necesita quedar privado mirando el MÁXIMO entre TODOS los mazos del
  -- jugador que usan esa carta (no solo este mazo) -- así una carta
  -- compartida entre dos mazos queda protegida para el que más necesite,
  -- sin que guardar el segundo destrabe de más lo que pedía el primero.
  -- Solo aprieta -- si ya estaba más bajo, no se toca.
  for v_item in select * from jsonb_array_elements(p_cards)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;

    select coalesce(max(dc.quantity), 0) into v_max_in_decks
    from public.deck_cards dc
    join public.decks d on d.id = dc.deck_id
    where d.user_id = v_user_id and dc.card_id = v_card_id;

    update public.user_cards
    set public_quantity = quantity - v_max_in_decks
    where user_id = v_user_id and card_id = v_card_id
      and public_quantity > quantity - v_max_in_decks;
  end loop;

  return v_deck_id;
end;
$$;

revoke all on function public.save_deck(uuid, text, jsonb) from public;
grant execute on function public.save_deck(uuid, text, jsonb) to authenticated;


-- ----------------------------------------------------------------------------
-- create_trade: mismo cuerpo que privacy_respects_decks.sql, sumando el
-- chequeo de baneo y el de bloqueo mutuo (en cualquier dirección).
-- ----------------------------------------------------------------------------

create or replace function public.create_trade(
  p_receiver_id uuid,
  p_message text,
  p_offer jsonb,
  p_request jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade_id uuid;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_committed integer;
  v_card_name text;
  v_public_qty integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión para proponer un intercambio.';
  end if;

  if public.is_banned(v_user_id) then
    raise exception 'Tu cuenta está inhabilitada temporalmente y no puede proponer intercambios.';
  end if;

  if p_receiver_id is null then
    raise exception 'Elige con quién quieres intercambiar.';
  end if;

  if p_receiver_id = v_user_id then
    raise exception 'No puedes proponerte un intercambio a ti mismo.';
  end if;

  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'Ese jugador no existe.';
  end if;

  if exists (
    select 1 from public.blocked_users
    where (blocker_id = v_user_id and blocked_id = p_receiver_id)
       or (blocker_id = p_receiver_id and blocked_id = v_user_id)
  ) then
    raise exception 'No puedes proponer un intercambio con este jugador.';
  end if;

  if p_message is not null and length(p_message) > 280 then
    raise exception 'El mensaje es demasiado largo (máximo 280 caracteres).';
  end if;

  if p_offer is null or jsonb_typeof(p_offer) <> 'array' or jsonb_array_length(p_offer) = 0 then
    raise exception 'Elige al menos una carta para ofrecer.';
  end if;

  if p_request is not null and jsonb_typeof(p_request) <> 'array' then
    raise exception 'Pedido inválido.';
  end if;

  if (select count(*) from jsonb_array_elements(p_offer) e)
     <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_offer) e) then
    raise exception 'No repitas la misma carta en la oferta: sumá la cantidad en una sola entrada.';
  end if;

  if p_request is not null and jsonb_array_length(p_request) > 0
     and (select count(*) from jsonb_array_elements(p_request) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_request) e) then
    raise exception 'No repitas la misma carta en el pedido: sumá la cantidad en una sola entrada.';
  end if;

  -- Cada carta ofrecida: tiene que existir, y no puede superar lo que el
  -- propio jugador marcó como disponible para intercambio (public_quantity)
  -- menos lo ya comprometido en sus otras ofertas pendientes.
  for v_item in select * from jsonb_array_elements(p_offer)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Oferta inválida.';
    end if;

    select name into v_card_name from public.cards where id = v_card_id and is_active;
    if v_card_name is null then
      raise exception 'Una de las cartas ofrecidas ya no existe.';
    end if;

    select coalesce(public_quantity, 0) into v_public_qty
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    select coalesce(sum(ti.quantity), 0) into v_committed
    from public.trade_items ti
    join public.trades t on t.id = ti.trade_id
    where ti.user_id = v_user_id
      and ti.card_id = v_card_id
      and t.status = 'pendiente';

    if coalesce(v_public_qty, 0) - v_committed < v_quantity then
      raise exception 'No puedes ofrecer esa cantidad de "%": solo tienes % copias disponibles para intercambio ahora mismo (contando lo ya comprometido en otras ofertas). Revisa la privacidad de esa carta en tu colección.',
        v_card_name, greatest(0, coalesce(v_public_qty, 0) - v_committed);
    end if;
  end loop;

  -- Cada carta pedida: tiene que existir, y no puede superar el
  -- public_quantity actual del receptor (lo que él marcó como disponible
  -- para intercambio, no toda su cantidad).
  if p_request is not null then
    for v_item in select * from jsonb_array_elements(p_request)
    loop
      v_card_id := (v_item ->> 'card_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;

      if v_card_id is null or v_quantity is null or v_quantity <= 0 then
        raise exception 'Pedido inválido.';
      end if;

      select name into v_card_name from public.cards where id = v_card_id and is_active;
      if v_card_name is null then
        raise exception 'Una de las cartas pedidas ya no existe.';
      end if;

      select coalesce(public_quantity, 0) into v_public_qty
      from public.user_cards
      where user_id = p_receiver_id and card_id = v_card_id;

      if coalesce(v_public_qty, 0) < v_quantity then
        raise exception '"%" no tiene suficientes copias disponibles para intercambio.', v_card_name;
      end if;
    end loop;
  end if;

  insert into public.trades (sender_id, receiver_id, message, status, expires_at)
  values (v_user_id, p_receiver_id, nullif(trim(p_message), ''), 'pendiente', now() + interval '7 days')
  returning id into v_trade_id;

  insert into public.trade_items (trade_id, user_id, card_id, quantity)
  select v_trade_id, v_user_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
  from jsonb_array_elements(p_offer) elem;

  if p_request is not null and jsonb_array_length(p_request) > 0 then
    insert into public.trade_items (trade_id, user_id, card_id, quantity)
    select v_trade_id, p_receiver_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_request) elem;
  end if;

  return v_trade_id;
end;
$$;

revoke all on function public.create_trade(uuid, text, jsonb, jsonb) from public;
grant execute on function public.create_trade(uuid, text, jsonb, jsonb) to authenticated;


-- ----------------------------------------------------------------------------
-- accept_trade: mismo cuerpo que privacy_respects_decks.sql, sumando el
-- chequeo de baneo (de quien acepta -- que exista el bloqueo ya lo impidió
-- create_trade, no hace falta revalidarlo acá).
-- ----------------------------------------------------------------------------

create or replace function public.accept_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade public.trades%rowtype;
  v_item record;
  v_current_qty integer;
  v_current_public_qty integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  if public.is_banned(v_user_id) then
    raise exception 'Tu cuenta está inhabilitada temporalmente y no puede aceptar intercambios.';
  end if;

  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found then
    raise exception 'Ese intercambio no existe.';
  end if;

  if v_user_id <> v_trade.receiver_id then
    raise exception 'Solo quien recibe la oferta puede aceptarla.';
  end if;

  if v_trade.status <> 'pendiente' then
    raise exception 'Este intercambio ya no está pendiente.';
  end if;

  if v_trade.expires_at is not null and v_trade.expires_at < now() then
    update public.trades set status = 'expirado', resolved_at = now() where id = p_trade_id;
    raise exception 'Este intercambio ya venció.';
  end if;

  for v_item in
    select
      ti.user_id,
      ti.card_id,
      ti.quantity,
      c.name as card_name,
      case when ti.user_id = v_trade.sender_id then v_trade.receiver_id else v_trade.sender_id end as other_user_id
    from public.trade_items ti
    join public.cards c on c.id = ti.card_id
    where ti.trade_id = p_trade_id
    order by ti.card_id, ti.user_id
  loop
    select quantity, public_quantity into v_current_qty, v_current_public_qty
    from public.user_cards
    where user_id = v_item.user_id and card_id = v_item.card_id
    for update;

    if v_current_qty is null or v_current_qty < v_item.quantity then
      raise exception 'Ya no hay suficientes copias de "%" para completar el intercambio.', v_item.card_name;
    end if;

    if coalesce(v_current_public_qty, 0) < v_item.quantity then
      raise exception '"%" ya no tiene suficientes copias disponibles para intercambio (quedó reservada, o ya se comprometió en otra oferta).', v_item.card_name;
    end if;

    perform public.decrease_user_card(v_item.user_id, v_item.card_id, v_item.quantity);
    perform public.increase_user_card(v_item.other_user_id, v_item.card_id, v_item.quantity);
  end loop;

  update public.trades
  set status = 'aceptado', resolved_at = now()
  where id = p_trade_id;
end;
$$;

revoke all on function public.accept_trade(uuid) from public;
grant execute on function public.accept_trade(uuid) to authenticated;


-- ============================================================================
-- Archivo: supabase/migrations/20260910000000_admin_players_display_name.sql
-- ============================================================================

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


-- ============================================================================
-- Archivo: supabase/migrations/20260911000000_fix_release_unused_reservation.sql
-- ============================================================================

-- ============================================================================
-- Bug confirmado: borrar un mazo con "liberar cartas" tildado (o sacar una
-- carta del todo en el editor con el interruptor de autoliberar prendido)
-- podía romper con "new row for relation user_cards violates check
-- constraint user_cards_check" y, al reventar la transacción entera,
-- terminaba SIN borrar el mazo tampoco.
--
-- Causa: release_unused_reservation calculaba
--   public_quantity = quantity - (lo que usan los mazos restantes)
-- y si la carta ya no está en NINGÚN mazo, eso da quantity - 0 = quantity
-- completa -- pisando la regla de siempre de dejar al menos 1 copia
-- privada (el check public_quantity <= quantity - 1). El resto de las
-- funciones (increase_user_card, save_deck, set_card_public_quantity,
-- set_all_cards_public) ya usaban greatest(1, ...) para esto; esta se
-- quedó afuera cuando se centralizó ese criterio.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.release_unused_reservation(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_max_in_decks integer;
  v_owned integer;
  v_new_public integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select coalesce(max(dc.quantity), 0) into v_max_in_decks
  from public.deck_cards dc
  join public.decks d on d.id = dc.deck_id
  where d.user_id = v_user_id and dc.card_id = p_card_id;

  select quantity into v_owned
  from public.user_cards
  where user_id = v_user_id and card_id = p_card_id;

  if v_owned is null then
    return;
  end if;

  v_new_public := v_owned - greatest(1, v_max_in_decks);

  update public.user_cards
  set public_quantity = v_new_public
  where user_id = v_user_id and card_id = p_card_id
    and public_quantity < v_new_public;
end;
$$;

revoke all on function public.release_unused_reservation(uuid) from public;
grant execute on function public.release_unused_reservation(uuid) to authenticated;


-- ============================================================================
-- Backfill: por si alguien ya pisó esta regla antes de este fix (aunque en
-- la práctica el check de la tabla lo habría bloqueado siempre, así que
-- esto es solo por las dudas -- no debería tocar ninguna fila).
-- ============================================================================

update public.user_cards uc
set public_quantity = greatest(
  0,
  uc.quantity - greatest(1, public.deck_reserved_quantity(uc.user_id, uc.card_id))
)
where uc.public_quantity > greatest(
  0,
  uc.quantity - greatest(1, public.deck_reserved_quantity(uc.user_id, uc.card_id))
);


-- ============================================================================
-- Archivo: supabase/migrations/20260912000000_tuteo_fixes.sql
-- ============================================================================

-- ============================================================================
-- Corrección de tono: estas tres funciones traían voseo colado desde su
-- versión original (antes de que se definiera la regla de tuteo tipo
-- Colombia) que sobrevivió sin querer en cada reescritura posterior porque
-- solo se tocaba la lógica, nunca ese texto puntual. Mismo cuerpo que la
-- versión anterior (accounts_blocking_bans.sql), solo cambia el texto de
-- los mensajes de error:
--   redeem_code: "Tenés"/"Ingresá"/"Contactá" -> "Tienes"/"Ingresa"/"Contacta"
--   save_deck / create_trade: "sumá" -> "suma"
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.redeem_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_clean text;
  v_lookup_code text;
  v_code_row public.codes%rowtype;
  v_pack public.pack_types%rowtype;
  v_already_redeemed boolean;
  v_selected_card_ids uuid[] := '{}';
  v_awarded jsonb := '[]'::jsonb;
  v_card_json jsonb;
  v_redemption_id uuid;
  v_rarity public.card_rarity;
  v_card_id uuid;
  v_is_new boolean;
  v_current_qty integer;
  v_new_qty integer;
  v_base_pack_image_url text;
  v_pack_image_url text;
  v_trade_default text;
  i integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión para canjear un código.';
  end if;

  if public.is_banned(v_user_id) then
    raise exception 'Tu cuenta está inhabilitada temporalmente y no puede canjear códigos.';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'Ingresa un código.';
  end if;

  -- 1. Normalizar: mayúsculas, sin guiones ni espacios, y reconstruir el
  -- formato XXXX-XXXX-XXXX (así el lookup usa el índice único de code en
  -- vez de escanear toda la tabla).
  v_clean := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if length(v_clean) <> 12 then
    raise exception 'Ese código no existe.';
  end if;
  v_lookup_code := substr(v_clean, 1, 4) || '-' || substr(v_clean, 5, 4) || '-' || substr(v_clean, 9, 4);

  -- 2. Buscar + bloquear la fila. El lock se mantiene hasta el commit/rollback
  -- de esta transacción, así que un segundo canje simultáneo del MISMO
  -- código queda esperando acá hasta que este termine.
  select * into v_code_row
  from public.codes
  where code = v_lookup_code
  for update;

  if not found then
    raise exception 'Ese código no existe.';
  end if;

  if not v_code_row.is_active then
    raise exception 'Ese código ya no está activo.';
  end if;

  if v_code_row.expires_at is not null and v_code_row.expires_at < now() then
    raise exception 'Ese código venció.';
  end if;

  if v_code_row.uses_count >= v_code_row.max_uses then
    raise exception 'Ese código ya alcanzó el máximo de usos.';
  end if;

  -- 3. one_per_user
  if v_code_row.one_per_user then
    select exists(
      select 1 from public.redemptions
      where code_id = v_code_row.id and user_id = v_user_id
    ) into v_already_redeemed;

    if v_already_redeemed then
      raise exception 'Ya canjeaste este código antes.';
    end if;
  end if;

  select * into v_pack from public.pack_types where id = v_code_row.pack_type_id;
  if not found then
    raise exception 'El tipo de sobre de este código ya no existe. Contacta a un admin.';
  end if;

  -- 4. Sortear las cartas. Si hay guaranteed_rarity, la primera carta sale
  -- de esa rareza; el resto (y esa misma si no hay garantía) se sortea por
  -- rarity_weights. Solo entre cartas activas de los sets permitidos. Si no
  -- hay ninguna de la rareza sorteada en esos sets, se degrada a cualquier
  -- carta activa permitida en vez de romper el canje.
  for i in 1..v_pack.cards_count loop
    if i = 1 and v_pack.guaranteed_rarity is not null then
      v_rarity := v_pack.guaranteed_rarity;
    else
      v_rarity := public.pick_weighted_rarity(v_pack.rarity_weights);
    end if;

    select id into v_card_id
    from public.cards
    where is_active
      and set_id = any(v_pack.allowed_set_ids)
      and rarity = v_rarity
    order by random()
    limit 1;

    if v_card_id is null then
      select id into v_card_id
      from public.cards
      where is_active
        and set_id = any(v_pack.allowed_set_ids)
      order by random()
      limit 1;
    end if;

    if v_card_id is null then
      raise exception 'No hay cartas disponibles para este sobre. Contacta a un admin.';
    end if;

    v_selected_card_ids := array_append(v_selected_card_ids, v_card_id);
  end loop;

  -- 5. Otorgar las cartas vía increase_user_card (aplica trade_default a
  -- las nuevas) y armar el detalle, marcando is_new según si el usuario ya
  -- tenía esa carta.
  for i in 1..array_length(v_selected_card_ids, 1) loop
    v_card_id := v_selected_card_ids[i];

    select quantity into v_current_qty
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    v_is_new := v_current_qty is null;

    select public.increase_user_card(v_user_id, v_card_id, 1) into v_new_qty;

    select jsonb_build_object(
      'card_id', c.id,
      'slug', c.slug,
      'name', c.name,
      'rarity', c.rarity,
      'image_front_url', c.image_front_url,
      'is_new', v_is_new,
      'quantity', v_new_qty
    ) into v_card_json
    from public.cards c
    where c.id = v_card_id;

    v_awarded := v_awarded || jsonb_build_array(v_card_json);
  end loop;

  -- 6. Registrar la redención con el detalle de lo otorgado.
  insert into public.redemptions (code_id, user_id, cards_awarded)
  values (v_code_row.id, v_user_id, v_awarded)
  returning id into v_redemption_id;

  -- 7. Incrementar uses_count.
  update public.codes
  set uses_count = uses_count + 1
  where id = v_code_row.id;

  -- Imagen del sobre: la propia del pack_type si tiene, si no la base de
  -- game_settings. Se resuelve acá para que el cliente no tenga que hacer
  -- una consulta aparte.
  select pack_image_url into v_base_pack_image_url from public.game_settings where id = true;
  v_pack_image_url := coalesce(v_pack.image_url, v_base_pack_image_url);

  select trade_default into v_trade_default from public.profiles where id = v_user_id;

  -- 8. Devolver el detalle.
  return jsonb_build_object(
    'redemption_id', v_redemption_id,
    'pack_type_name', v_pack.name,
    'pack_image_url', v_pack_image_url,
    'trade_default', v_trade_default,
    'cards', v_awarded
  );
end;
$$;

revoke all on function public.redeem_code(text) from public;
grant execute on function public.redeem_code(text) to authenticated;


create or replace function public.save_deck(p_deck_id uuid, p_name text, p_cards jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deck_id uuid;
  v_deck_count integer;
  v_total_qty integer := 0;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_owned integer;
  v_power integer;
  v_card_name text;
  v_max_for_card integer;
  v_is_complete boolean;
  v_max_in_decks integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  if public.is_banned(v_user_id) then
    raise exception 'Tu cuenta está inhabilitada temporalmente y no puede guardar mazos.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Ingresa un nombre para el mazo.';
  end if;

  if p_cards is null or jsonb_typeof(p_cards) <> 'array' then
    raise exception 'Formato de mazo inválido.';
  end if;

  if p_deck_id is not null then
    if not exists (select 1 from public.decks where id = p_deck_id and user_id = v_user_id) then
      raise exception 'Ese mazo no existe.';
    end if;
    v_deck_id := p_deck_id;
  else
    select count(*) into v_deck_count from public.decks where user_id = v_user_id;
    if v_deck_count >= 3 then
      raise exception 'Ya tienes 3 mazos. Borra alguno antes de crear uno nuevo.';
    end if;
  end if;

  if jsonb_array_length(p_cards) > 0
     and (select count(*) from jsonb_array_elements(p_cards) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_cards) e) then
    raise exception 'No repitas la misma carta: suma la cantidad en una sola entrada.';
  end if;

  for v_item in select * from jsonb_array_elements(p_cards)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Carta inválida en el mazo.';
    end if;

    select name, power into v_card_name, v_power
    from public.cards where id = v_card_id and is_active;

    if v_card_name is null then
      raise exception 'Una de las cartas del mazo ya no existe.';
    end if;

    select coalesce(quantity, 0) into v_owned
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    if coalesce(v_owned, 0) < v_quantity then
      raise exception 'No tienes suficientes copias de "%" (tienes %, el mazo pide %).',
        v_card_name, coalesce(v_owned, 0), v_quantity;
    end if;

    v_max_for_card := case
      when v_power = 0 then v_quantity
      when v_power = 10 then 1
      else 3
    end;

    if v_quantity > v_max_for_card then
      raise exception 'No puedes tener más de % copias de "%" en el mazo.', v_max_for_card, v_card_name;
    end if;

    v_total_qty := v_total_qty + v_quantity;
  end loop;

  v_is_complete := (v_total_qty = 40);

  if v_deck_id is null then
    insert into public.decks (user_id, name, is_complete)
    values (v_user_id, trim(p_name), v_is_complete)
    returning id into v_deck_id;
  else
    update public.decks
    set name = trim(p_name), is_complete = v_is_complete, updated_at = now()
    where id = v_deck_id;
  end if;

  delete from public.deck_cards where deck_id = v_deck_id;

  if jsonb_array_length(p_cards) > 0 then
    insert into public.deck_cards (deck_id, card_id, quantity)
    select v_deck_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_cards) elem;
  end if;

  -- Protección automática: para cada carta del mazo, se recalcula cuánto
  -- necesita quedar privado mirando el MÁXIMO entre TODOS los mazos del
  -- jugador que usan esa carta (no solo este mazo) -- así una carta
  -- compartida entre dos mazos queda protegida para el que más necesite,
  -- sin que guardar el segundo destrabe de más lo que pedía el primero.
  -- Solo aprieta -- si ya estaba más bajo, no se toca.
  for v_item in select * from jsonb_array_elements(p_cards)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;

    select coalesce(max(dc.quantity), 0) into v_max_in_decks
    from public.deck_cards dc
    join public.decks d on d.id = dc.deck_id
    where d.user_id = v_user_id and dc.card_id = v_card_id;

    update public.user_cards
    set public_quantity = quantity - v_max_in_decks
    where user_id = v_user_id and card_id = v_card_id
      and public_quantity > quantity - v_max_in_decks;
  end loop;

  return v_deck_id;
end;
$$;

revoke all on function public.save_deck(uuid, text, jsonb) from public;
grant execute on function public.save_deck(uuid, text, jsonb) to authenticated;


create or replace function public.create_trade(
  p_receiver_id uuid,
  p_message text,
  p_offer jsonb,
  p_request jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade_id uuid;
  v_item jsonb;
  v_card_id uuid;
  v_quantity integer;
  v_committed integer;
  v_card_name text;
  v_public_qty integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión para proponer un intercambio.';
  end if;

  if public.is_banned(v_user_id) then
    raise exception 'Tu cuenta está inhabilitada temporalmente y no puede proponer intercambios.';
  end if;

  if p_receiver_id is null then
    raise exception 'Elige con quién quieres intercambiar.';
  end if;

  if p_receiver_id = v_user_id then
    raise exception 'No puedes proponerte un intercambio a ti mismo.';
  end if;

  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'Ese jugador no existe.';
  end if;

  if exists (
    select 1 from public.blocked_users
    where (blocker_id = v_user_id and blocked_id = p_receiver_id)
       or (blocker_id = p_receiver_id and blocked_id = v_user_id)
  ) then
    raise exception 'No puedes proponer un intercambio con este jugador.';
  end if;

  if p_message is not null and length(p_message) > 280 then
    raise exception 'El mensaje es demasiado largo (máximo 280 caracteres).';
  end if;

  if p_offer is null or jsonb_typeof(p_offer) <> 'array' or jsonb_array_length(p_offer) = 0 then
    raise exception 'Elige al menos una carta para ofrecer.';
  end if;

  if p_request is not null and jsonb_typeof(p_request) <> 'array' then
    raise exception 'Pedido inválido.';
  end if;

  if (select count(*) from jsonb_array_elements(p_offer) e)
     <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_offer) e) then
    raise exception 'No repitas la misma carta en la oferta: suma la cantidad en una sola entrada.';
  end if;

  if p_request is not null and jsonb_array_length(p_request) > 0
     and (select count(*) from jsonb_array_elements(p_request) e)
       <> (select count(distinct (e ->> 'card_id')) from jsonb_array_elements(p_request) e) then
    raise exception 'No repitas la misma carta en el pedido: suma la cantidad en una sola entrada.';
  end if;

  -- Cada carta ofrecida: tiene que existir, y no puede superar lo que el
  -- propio jugador marcó como disponible para intercambio (public_quantity)
  -- menos lo ya comprometido en sus otras ofertas pendientes.
  for v_item in select * from jsonb_array_elements(p_offer)
  loop
    v_card_id := (v_item ->> 'card_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_card_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'Oferta inválida.';
    end if;

    select name into v_card_name from public.cards where id = v_card_id and is_active;
    if v_card_name is null then
      raise exception 'Una de las cartas ofrecidas ya no existe.';
    end if;

    select coalesce(public_quantity, 0) into v_public_qty
    from public.user_cards
    where user_id = v_user_id and card_id = v_card_id;

    select coalesce(sum(ti.quantity), 0) into v_committed
    from public.trade_items ti
    join public.trades t on t.id = ti.trade_id
    where ti.user_id = v_user_id
      and ti.card_id = v_card_id
      and t.status = 'pendiente';

    if coalesce(v_public_qty, 0) - v_committed < v_quantity then
      raise exception 'No puedes ofrecer esa cantidad de "%": solo tienes % copias disponibles para intercambio ahora mismo (contando lo ya comprometido en otras ofertas). Revisa la privacidad de esa carta en tu colección.',
        v_card_name, greatest(0, coalesce(v_public_qty, 0) - v_committed);
    end if;
  end loop;

  -- Cada carta pedida: tiene que existir, y no puede superar el
  -- public_quantity actual del receptor (lo que él marcó como disponible
  -- para intercambio, no toda su cantidad).
  if p_request is not null then
    for v_item in select * from jsonb_array_elements(p_request)
    loop
      v_card_id := (v_item ->> 'card_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;

      if v_card_id is null or v_quantity is null or v_quantity <= 0 then
        raise exception 'Pedido inválido.';
      end if;

      select name into v_card_name from public.cards where id = v_card_id and is_active;
      if v_card_name is null then
        raise exception 'Una de las cartas pedidas ya no existe.';
      end if;

      select coalesce(public_quantity, 0) into v_public_qty
      from public.user_cards
      where user_id = p_receiver_id and card_id = v_card_id;

      if coalesce(v_public_qty, 0) < v_quantity then
        raise exception '"%" no tiene suficientes copias disponibles para intercambio.', v_card_name;
      end if;
    end loop;
  end if;

  insert into public.trades (sender_id, receiver_id, message, status, expires_at)
  values (v_user_id, p_receiver_id, nullif(trim(p_message), ''), 'pendiente', now() + interval '7 days')
  returning id into v_trade_id;

  insert into public.trade_items (trade_id, user_id, card_id, quantity)
  select v_trade_id, v_user_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
  from jsonb_array_elements(p_offer) elem;

  if p_request is not null and jsonb_array_length(p_request) > 0 then
    insert into public.trade_items (trade_id, user_id, card_id, quantity)
    select v_trade_id, p_receiver_id, (elem ->> 'card_id')::uuid, (elem ->> 'quantity')::integer
    from jsonb_array_elements(p_request) elem;
  end if;

  return v_trade_id;
end;
$$;

revoke all on function public.create_trade(uuid, text, jsonb, jsonb) from public;
grant execute on function public.create_trade(uuid, text, jsonb, jsonb) to authenticated;


-- ============================================================================
-- Archivo: supabase/migrations/20260913000000_reset_all_progress.sql
-- ============================================================================

-- ============================================================================
-- RESET COMPLETO DE PROGRESO DE JUGADORES -- no es una migración de esquema,
-- es un borrado de datos de una sola vez (antes del lanzamiento, para
-- limpiar todo lo cargado en pruebas). Cuentas, perfiles y player_code
-- quedan intactos: nadie tiene que volver a loguearse.
--
-- Confirmado contra la base real antes de escribir esto:
--   user_cards 11 filas, deck_cards 2, decks 1, trade_items 15, trades 10
--   (0 pendientes), redemptions 13, y 13 de los 19 códigos con uso > 0.
--
-- Todo en una sola transacción: si algo falla a mitad de camino, no queda
-- nada a medio borrar -- se revierte entero.
--
-- NO toca profiles, auth.users, cards, card_sets, pack_types, ni la tabla
-- codes en sí (solo su columna uses_count).
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

begin;

-- Intercambios: primero los items (referencian trades), después los trades.
-- trade_items.trade_id ya tiene on delete cascade, así que borrar trades
-- solo también alcanzaría, pero se hace explícito en el mismo orden que se
-- pidió.
delete from public.trade_items;
delete from public.trades;

-- Mazos: mismo criterio, deck_cards.deck_id también cascadea desde decks,
-- pero se borra explícito.
delete from public.deck_cards;
delete from public.decks;

-- Canjes ya hechos.
delete from public.redemptions;

-- Colección de cada jugador.
delete from public.user_cards;

-- Códigos: no se borra ninguno, solo se resetea el contador de usos para
-- que vuelvan a estar disponibles como si no se hubieran canjeado.
update public.codes set uses_count = 0;

commit;


