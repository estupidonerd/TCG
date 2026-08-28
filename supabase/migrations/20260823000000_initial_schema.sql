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
