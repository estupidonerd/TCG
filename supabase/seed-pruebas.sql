-- ============================================================================
-- DATOS DE PRUEBA -- SOLO PARA EL PROYECTO DE PRUEBAS. NUNCA correr en producción.
--
-- Qué hace, para cada correo que ya exista en auth.users:
--   * asegura su fila en public.profiles (si no estaba, la crea);
--   * marca como admin al correo_admin;
--   * le deja en la colección un conjunto de ejemplo: cartas de cada rareza
--     con varias copias repetidas (para probar la forja y los intercambios)
--     y al menos una carta BASE de una variante (una carta que tiene otra
--     carta apuntándole con variant_of; la variante en sí NO se regala, para
--     poder probar cómo se descubre).
--
-- Cómo correrlo (SQL Editor de Supabase del proyecto de PRUEBAS):
--   1. Abre el proyecto de Pruebas -> SQL Editor -> New query.
--   2. Pega este archivo completo.
--   3. Cambia los tres correos de abajo (correo_a, correo_b, correo_admin) por
--      los reales. Tienen que ser cuentas que ya hayan iniciado sesión al
--      menos una vez en la app de Pruebas: el correo sale de auth.users.
--      Los tres pueden ser distintos o repetirse (por ejemplo, tu admin
--      también como correo_a).
--   4. Clic en Run. Los mensajes (NOTICE) aparecen en la pestaña "Results"
--      o "Messages": dicen qué se hizo con cada correo y avisan si alguno
--      no existe o si faltan cartas en el catálogo.
--
-- Requisitos: todas las migraciones al día en Pruebas, y cartas ya cargadas
-- en el catálogo (las cartas son datos: este archivo NO crea cartas, usa las
-- que ya haya, activas y sin variante, ordenadas por sort_order y slug).
--
-- Es idempotente: volver a correrlo no duplica nada. Los perfiles se crean
-- solo si faltan, y a cada carta se le deja AL MENOS la cantidad indicada
-- (nunca se bajan copias que el jugador ya tenga, así no se rompe un mazo
-- reservado ni se pierde lo que ganó probando). Si una persona ya gastó sus
-- repetidas en la forja y quieres volver a tenerlas, aumenta las cantidades
-- de abajo o regálate códigos desde el admin.
--
-- Para que correo_a y correo_b puedan intercambiar, a cada persona le toca
-- un tramo distinto de cada rareza (a correo_b, el siguiente tramo que a
-- correo_a; al admin, el tercero). Si el catálogo es chico, los tramos se
-- repiten y comparten cartas.
-- ============================================================================

do $seed$
declare
  -- ---- EDITA SOLO ESTAS TRES LÍNEAS --------------------------------------
  correo_a     text := 'jugador-a@ejemplo.com';
  correo_b     text := 'jugador-b@ejemplo.com';
  correo_admin text := 'admin@ejemplo.com';
  -- -------------------------------------------------------------------------

  -- Cuántas cartas distintas de cada rareza, y cuántas copias de cada una.
  --   rarezas:  común, rara, épica, legendaria
  c_cartas  constant int[] := array[6, 4, 3, 2];
  c_copias  constant int[] := array[5, 4, 3, 2];
  c_rarezas constant public.card_rarity[] := array['comun', 'rara', 'epica', 'legendaria']::public.card_rarity[];
  -- Copias de la carta base de variante.
  c_copias_base constant int := 2;

  v_correos text[] := array[correo_a, correo_b, correo_admin];
  v_correo text;
  v_slot int;
  v_user_id uuid;
  v_i int;
  v_total int;
  v_dadas int;
  v_base_id uuid;
begin
  if correo_a = 'jugador-a@ejemplo.com' or correo_b = 'jugador-b@ejemplo.com' or correo_admin = 'admin@ejemplo.com' then
    raise notice 'Aviso: todavía hay correos de ejemplo arriba; solo se procesan los que existan en auth.users.';
  end if;

  for v_slot in 1 .. array_length(v_correos, 1) loop
    v_correo := v_correos[v_slot];

    select u.id into v_user_id
    from auth.users u
    where lower(u.email) = lower(trim(v_correo))
    limit 1;

    if v_user_id is null then
      raise notice '[%] "%": no existe en auth.users (inicia sesión una vez en la app de Pruebas con esa cuenta). Se omite.',
        v_slot, v_correo;
      continue;
    end if;

    -- Perfil: lo normal es que el trigger on_auth_user_created ya lo haya
    -- creado; esto solo cubre cuentas anteriores al trigger o borradas a mano.
    insert into public.profiles (id, display_name, player_code)
    select
      u.id,
      coalesce(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name',
        split_part(u.email, '@', 1)
      ),
      public.generate_player_code()
    from auth.users u
    where u.id = v_user_id
    on conflict (id) do nothing;

    -- Admin: solo el correo_admin (si es el mismo correo que otro, queda admin).
    if v_slot = 3 then
      update public.profiles set is_admin = true where id = v_user_id;
      raise notice '[%] "%": marcado como admin.', v_slot, v_correo;
    end if;

    -- Colección de ejemplo: por rareza, un tramo del catálogo propio de cada
    -- persona (v_slot - 1 tramos de distancia del primero).
    for v_i in 1 .. array_length(c_rarezas, 1) loop
      select count(*) into v_total
      from public.cards c
      where c.rarity = c_rarezas[v_i] and c.is_active and c.variant_of is null;

      if v_total = 0 then
        raise notice '[%] "%": no hay cartas % activas en el catálogo; se omite esa rareza.',
          v_slot, v_correo, c_rarezas[v_i];
        continue;
      end if;

      with ranked as (
        select c.id,
               row_number() over (order by c.sort_order, c.slug) - 1 as pos
        from public.cards c
        where c.rarity = c_rarezas[v_i] and c.is_active and c.variant_of is null
      ),
      chosen as (
        select r.id
        from ranked r
        -- Tramo propio: posiciones [(slot-1)*N, slot*N), con vuelta al inicio.
        where ((r.pos - (v_slot - 1) * c_cartas[v_i]) % v_total + v_total) % v_total < c_cartas[v_i]
      ),
      upserted as (
        insert into public.user_cards (user_id, card_id, quantity)
        select v_user_id, ch.id, c_copias[v_i] from chosen ch
        on conflict (user_id, card_id) do update
          set quantity = greatest(public.user_cards.quantity, excluded.quantity)
        returning 1
      )
      select count(*) into v_dadas from upserted;

      raise notice '[%] "%": % cartas % con al menos % copias.',
        v_slot, v_correo, v_dadas, c_rarezas[v_i], c_copias[v_i];
    end loop;

    -- Carta base de una variante (la base, no la variante).
    select b.id into v_base_id
    from public.cards b
    where b.is_active
      and exists (select 1 from public.cards v where v.variant_of = b.id)
    order by b.sort_order, b.slug
    limit 1;

    if v_base_id is null then
      raise notice '[%] "%": el catálogo no tiene ninguna carta variante todavía; no hay carta base que regalar.',
        v_slot, v_correo;
    else
      insert into public.user_cards (user_id, card_id, quantity)
      values (v_user_id, v_base_id, c_copias_base)
      on conflict (user_id, card_id) do update
        set quantity = greatest(public.user_cards.quantity, excluded.quantity);
      raise notice '[%] "%": carta base de variante (%) con al menos % copias.',
        v_slot, v_correo, v_base_id, c_copias_base;
    end if;
  end loop;
end
$seed$;
