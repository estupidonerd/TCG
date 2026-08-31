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
