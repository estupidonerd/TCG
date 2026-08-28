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
