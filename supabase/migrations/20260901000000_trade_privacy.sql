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
