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
