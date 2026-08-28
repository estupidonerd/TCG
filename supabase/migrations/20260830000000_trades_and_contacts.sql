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
