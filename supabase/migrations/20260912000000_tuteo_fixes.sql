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
