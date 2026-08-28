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
