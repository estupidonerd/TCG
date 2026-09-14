-- ============================================================================
-- PIEL COSMÉTICA DEL SOBRE -- puramente visual, no toca probabilidades ni
-- cantidad de cartas. 'normal' (default), 'dorado' o 'tornasolado': cambia
-- cómo se ve el sobre CERRADO antes de abrirlo en /canjear.
--
-- Aprovecha para sumar 'skin' (del tipo de sobre) y 'variant_of' (de cada
-- carta, agregado en 20260917000000_card_variants.sql pero nunca sumado acá)
-- al detalle que devuelve redeem_code, mismo patrón de siempre: el jugador
-- necesita esto para saber qué brillo de foil mostrar apenas revela la
-- carta, no solo después en /coleccion.
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.pack_types
  add column skin text not null default 'normal'
    constraint pack_types_skin_valid check (skin in ('normal', 'dorado', 'tornasolado'));

comment on column public.pack_types.skin is 'Piel cosmética del sobre CERRADO en /canjear antes de abrirlo. No afecta pesos de rareza ni cantidad de cartas.';

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

  v_clean := upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'));
  if length(v_clean) <> 12 then
    raise exception 'Ese código no existe.';
  end if;
  v_lookup_code := substr(v_clean, 1, 4) || '-' || substr(v_clean, 5, 4) || '-' || substr(v_clean, 9, 4);

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
      'quantity', v_new_qty,
      'genre_id', c.genre_id,
      'trait_id', c.trait_id,
      'power', c.power,
      'score', c.score,
      'use_card_name_as_display', c.use_card_name_as_display,
      'display_line_1', c.display_line_1,
      'display_line_2', c.display_line_2,
      'display_line_3', c.display_line_3,
      'apply_art_template', c.apply_art_template,
      'name_shadow_intensity', c.name_shadow_intensity,
      'name_font_size', c.name_font_size,
      'name_line_height', c.name_line_height,
      'variant_of', c.variant_of
    ) into v_card_json
    from public.cards c
    where c.id = v_card_id;

    v_awarded := v_awarded || jsonb_build_array(v_card_json);
  end loop;

  insert into public.redemptions (code_id, user_id, cards_awarded)
  values (v_code_row.id, v_user_id, v_awarded)
  returning id into v_redemption_id;

  update public.codes
  set uses_count = uses_count + 1
  where id = v_code_row.id;

  select pack_image_url into v_base_pack_image_url from public.game_settings where id = true;
  v_pack_image_url := coalesce(v_pack.image_url, v_base_pack_image_url);

  select trade_default into v_trade_default from public.profiles where id = v_user_id;

  return jsonb_build_object(
    'redemption_id', v_redemption_id,
    'pack_type_name', v_pack.name,
    'pack_image_url', v_pack_image_url,
    'skin', v_pack.skin,
    'trade_default', v_trade_default,
    'cards', v_awarded
  );
end;
$$;
