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
