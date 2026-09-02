-- ============================================================================
-- AJUSTES SOBRE LA PLANTILLA DE ARTE (20260914000000_card_art_template.sql):
-- correcciones pedidas después de probar la primera versión. Todo aditivo,
-- no toca ninguna columna existente de antes de esa migración.
--
-- 1. game_settings.postal_back_print_url: la postal tiene su propio reverso,
--    distinto del de la carta normal (antes reusaba card_back_print_url).
-- 2. game_settings.card_name_font_url: la fuente del nombre ahora la sube el
--    admin desde /admin/ajustes (bucket público card-images), no un asset
--    estático del proyecto -- así un cambio de fuente se aplica a todo sin
--    tocar código.
-- 3. cards.apply_art_template: para cartas especiales cuyo arte ya trae
--    marco/íconos/Poder/Score integrados -- por defecto todas necesitan la
--    plantilla (true).
-- 4. cards.name_shadow_intensity: sombra del texto del nombre, ajustable por
--    carta (0-100), por si el arte no lo deja leer bien. Poder y Puntaje NO
--    llevan sombra -- eso lo decide el color, no una sombra.
-- 5. card_template (jsonb) cambia de forma: en vez de un margen compartido
--    para los íconos, cada elemento (ícono de género, ícono de rasgo, Poder,
--    Puntaje) tiene su propio offset_x/offset_y independiente. El tamaño
--    sigue compartido de a pares (un tamaño para los dos íconos, otro para
--    Poder/Puntaje). Se agrega credito.offset_y y credito.tamaño para la
--    línea de crédito de impresión/postal (siempre centrada en X). Como es
--    la misma columna jsonb de antes (no cambia de tipo), se resetea al
--    nuevo shape con un default limpio.
-- 6. redeem_code se reescribe completa (mismo cuerpo que
--    20260912000000_tuteo_fixes.sql) solo para que las cartas del sobre
--    vengan con todos los datos que necesita la plantilla -- así se ven
--    igual que en la colección apenas se revelan, no en blanco.
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.game_settings
  add column postal_back_print_url text,
  add column card_name_font_url text;

alter table public.cards
  add column apply_art_template boolean not null default true,
  add column name_shadow_intensity smallint not null default 50
    constraint cards_name_shadow_intensity_range check (name_shadow_intensity between 0 and 100);

update public.game_settings
set card_template = '{
  "marco_url": null,
  "zona_nombre": {"x": 10, "y": 4, "ancho": 80, "alto": 14, "angulo": 0, "interlineado": 110},
  "tamaño_iconos": 12,
  "tamaño_poder_score": 9,
  "icono_genero": {"offset_x": 4, "offset_y": 4},
  "icono_rasgo": {"offset_x": 4, "offset_y": 4},
  "poder": {"offset_x": 4, "offset_y": 4},
  "score": {"offset_x": 4, "offset_y": 4},
  "credito": {"offset_y": 2, "tamaño": 4}
}'::jsonb
where id = true;

comment on column public.game_settings.postal_back_print_url is 'Reverso de la postal (impresión, alta res) -- distinto del reverso de la carta normal.';
comment on column public.game_settings.card_name_font_url is 'Fuente del nombre de carta, subida por el admin (bucket público card-images). Si es null, se usa Titillium Web de respaldo.';
comment on column public.cards.apply_art_template is 'Si es false, esta carta es especial: su arte ya trae marco/íconos/Poder/Score/nombre integrados y no se le superpone la plantilla en ningún lado.';
comment on column public.cards.name_shadow_intensity is 'Intensidad (0-100) de la sombra detrás del nombre en el arte, por si el arte de fondo no lo deja leer bien.';

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
  -- tenía esa carta. El detalle ahora incluye todo lo que necesita la
  -- plantilla de arte (género, rasgo, poder, score, texto) para que la
  -- carta se vea igual acá que en la colección, no en blanco.
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
      'name_shadow_intensity', c.name_shadow_intensity
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
