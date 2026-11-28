-- ============================================================================
-- CIERRE DE PERMISOS DE EJECUCIÓN DE LAS FUNCIONES DE public.
--
-- El problema: en Supabase, toda función nueva de public recibe EXECUTE para
-- anon y authenticated por defecto, y `revoke ... from public` NO se lo quita
-- (eso solo quita el permiso del pseudo-rol PUBLIC). Las migraciones antiguas
-- solo revocaron PUBLIC, así que 27 de las 30 funciones se podían llamar desde
-- el navegador con .rpc(), incluso sin sesión. Entre ellas, increase_user_card
-- y decrease_user_card (reciben un id de usuario y no validan quién llama:
-- cualquiera podía regalarse o quitarle cartas a otro), admin_list_players,
-- is_banned y deck_reserved_quantity (revelan datos de cualquier jugador).
--
-- Qué hace esta migración (nada más): cambia solo los permisos EXECUTE de 25
-- funciones. No cambia ninguna función, tabla, política, columna ni dato.
--
--   A) 9 funciones internas -> solo service_role (y el dueño, postgres). Las
--      usan otras funciones SECURITY DEFINER, dos triggers y una acción de
--      servidor con service_role; el navegador nunca las llama.
--        admin_list_players, increase_user_card, decrease_user_card,
--        deck_reserved_quantity, is_banned, pick_weighted_rarity,
--        generate_player_code, handle_new_user, set_redemption_one_per_user
--
--   B) 16 funciones del jugador -> authenticated + service_role (se quita anon
--      y PUBLIC; la app solo las llama con sesión iniciada).
--        redeem_code, find_profile_by_code, get_public_profiles,
--        expire_old_trades, create_trade, accept_trade, reject_trade,
--        cancel_trade, set_card_public_quantity, set_all_cards_public,
--        set_all_cards_private, clear_trade_history,
--        release_unused_reservation, save_deck, delete_deck, block_user
--
--   Sin cambios (ya estaban bien a propósito): get_public_access_state y
--   get_active_splash (anon + authenticated + service_role: la pantalla de
--   entrada las necesita sin sesión), game_now, save_vote_response,
--   admin_set_test_clock.
--
-- Por qué no rompe nada (auditado): las funciones que llaman a las internas son
-- todas SECURITY DEFINER y corren como su dueño (postgres), que conserva el
-- permiso; ninguna política RLS, vista, valor por defecto ni restricción usa
-- estas funciones; los triggers no exigen EXECUTE al dispararse.
--
-- Al final, la migración se verifica sola: si algún permiso no quedó como
-- debe, lanza una excepción y TODO se deshace (es una transacción).
--
-- Rollback: supabase/rollback/permisos_funciones_rollback.sql
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase
-- (primero en el proyecto de pruebas).
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- A) Internas: solo service_role.
-- ----------------------------------------------------------------------------
revoke all on function public.admin_list_players()                         from public, anon, authenticated;
revoke all on function public.increase_user_card(uuid, uuid, integer)      from public, anon, authenticated;
revoke all on function public.decrease_user_card(uuid, uuid, integer)      from public, anon, authenticated;
revoke all on function public.deck_reserved_quantity(uuid, uuid)           from public, anon, authenticated;
revoke all on function public.is_banned(uuid)                              from public, anon, authenticated;
revoke all on function public.pick_weighted_rarity(jsonb)                  from public, anon, authenticated;
revoke all on function public.generate_player_code()                       from public, anon, authenticated;
revoke all on function public.handle_new_user()                            from public, anon, authenticated;
revoke all on function public.set_redemption_one_per_user()                from public, anon, authenticated;

grant execute on function public.admin_list_players()                      to service_role;
grant execute on function public.increase_user_card(uuid, uuid, integer)   to service_role;
grant execute on function public.decrease_user_card(uuid, uuid, integer)   to service_role;
grant execute on function public.deck_reserved_quantity(uuid, uuid)        to service_role;
grant execute on function public.is_banned(uuid)                           to service_role;
grant execute on function public.pick_weighted_rarity(jsonb)               to service_role;
grant execute on function public.generate_player_code()                    to service_role;
grant execute on function public.handle_new_user()                         to service_role;
grant execute on function public.set_redemption_one_per_user()             to service_role;

-- ----------------------------------------------------------------------------
-- B) Del jugador: authenticated + service_role (sin anon, sin PUBLIC).
-- ----------------------------------------------------------------------------
revoke all on function public.redeem_code(text)                                  from public, anon, authenticated;
revoke all on function public.find_profile_by_code(text)                         from public, anon, authenticated;
revoke all on function public.get_public_profiles(uuid[])                        from public, anon, authenticated;
revoke all on function public.expire_old_trades()                                from public, anon, authenticated;
revoke all on function public.create_trade(uuid, text, jsonb, jsonb)             from public, anon, authenticated;
revoke all on function public.accept_trade(uuid)                                 from public, anon, authenticated;
revoke all on function public.reject_trade(uuid)                                 from public, anon, authenticated;
revoke all on function public.cancel_trade(uuid)                                 from public, anon, authenticated;
revoke all on function public.set_card_public_quantity(uuid, integer)            from public, anon, authenticated;
revoke all on function public.set_all_cards_public()                             from public, anon, authenticated;
revoke all on function public.set_all_cards_private()                            from public, anon, authenticated;
revoke all on function public.clear_trade_history()                              from public, anon, authenticated;
revoke all on function public.release_unused_reservation(uuid)                   from public, anon, authenticated;
revoke all on function public.save_deck(uuid, text, jsonb)                       from public, anon, authenticated;
revoke all on function public.delete_deck(uuid, boolean)                         from public, anon, authenticated;
revoke all on function public.block_user(uuid)                                   from public, anon, authenticated;

grant execute on function public.redeem_code(text)                               to authenticated, service_role;
grant execute on function public.find_profile_by_code(text)                      to authenticated, service_role;
grant execute on function public.get_public_profiles(uuid[])                     to authenticated, service_role;
grant execute on function public.expire_old_trades()                             to authenticated, service_role;
grant execute on function public.create_trade(uuid, text, jsonb, jsonb)          to authenticated, service_role;
grant execute on function public.accept_trade(uuid)                              to authenticated, service_role;
grant execute on function public.reject_trade(uuid)                              to authenticated, service_role;
grant execute on function public.cancel_trade(uuid)                              to authenticated, service_role;
grant execute on function public.set_card_public_quantity(uuid, integer)         to authenticated, service_role;
grant execute on function public.set_all_cards_public()                          to authenticated, service_role;
grant execute on function public.set_all_cards_private()                         to authenticated, service_role;
grant execute on function public.clear_trade_history()                           to authenticated, service_role;
grant execute on function public.release_unused_reservation(uuid)                to authenticated, service_role;
grant execute on function public.save_deck(uuid, text, jsonb)                    to authenticated, service_role;
grant execute on function public.delete_deck(uuid, boolean)                      to authenticated, service_role;
grant execute on function public.block_user(uuid)                                to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Verificación: la matriz completa de las 30 funciones tiene que quedar como
-- está aprobada. Si algo no coincide, se aborta y se deshace todo.
--   formato: función(argumentos), anon?, authenticated?, service_role?
-- ----------------------------------------------------------------------------
do $verificar$
declare
  r record;
  v_oid oid;
  v_errores text := '';
begin
  for r in
    select * from (values
      -- A) internas
      ('admin_list_players()',                    false, false, true),
      ('increase_user_card(uuid, uuid, integer)', false, false, true),
      ('decrease_user_card(uuid, uuid, integer)', false, false, true),
      ('deck_reserved_quantity(uuid, uuid)',      false, false, true),
      ('is_banned(uuid)',                         false, false, true),
      ('pick_weighted_rarity(jsonb)',             false, false, true),
      ('generate_player_code()',                  false, false, true),
      ('handle_new_user()',                       false, false, true),
      ('set_redemption_one_per_user()',           false, false, true),
      -- B) del jugador
      ('redeem_code(text)',                       false, true,  true),
      ('find_profile_by_code(text)',              false, true,  true),
      ('get_public_profiles(uuid[])',             false, true,  true),
      ('expire_old_trades()',                     false, true,  true),
      ('create_trade(uuid, text, jsonb, jsonb)',  false, true,  true),
      ('accept_trade(uuid)',                      false, true,  true),
      ('reject_trade(uuid)',                      false, true,  true),
      ('cancel_trade(uuid)',                      false, true,  true),
      ('set_card_public_quantity(uuid, integer)', false, true,  true),
      ('set_all_cards_public()',                  false, true,  true),
      ('set_all_cards_private()',                 false, true,  true),
      ('clear_trade_history()',                   false, true,  true),
      ('release_unused_reservation(uuid)',        false, true,  true),
      ('save_deck(uuid, text, jsonb)',            false, true,  true),
      ('delete_deck(uuid, boolean)',              false, true,  true),
      ('block_user(uuid)',                        false, true,  true),
      -- sin cambios
      ('get_public_access_state()',               true,  true,  true),
      ('get_active_splash()',                     true,  true,  true),
      ('game_now()',                              false, true,  true),
      ('save_vote_response(jsonb, text)',         false, true,  true),
      ('admin_set_test_clock(integer)',           false, false, true)
    ) as t(firma, esperado_anon, esperado_auth, esperado_service)
  loop
    v_oid := to_regprocedure('public.' || r.firma);
    if v_oid is null then
      v_errores := v_errores || E'\n  no existe: ' || r.firma;
      continue;
    end if;
    if has_function_privilege('anon', v_oid, 'execute') is distinct from r.esperado_anon then
      v_errores := v_errores || E'\n  anon en ' || r.firma || ': esperado ' || r.esperado_anon;
    end if;
    if has_function_privilege('authenticated', v_oid, 'execute') is distinct from r.esperado_auth then
      v_errores := v_errores || E'\n  authenticated en ' || r.firma || ': esperado ' || r.esperado_auth;
    end if;
    if has_function_privilege('service_role', v_oid, 'execute') is distinct from r.esperado_service then
      v_errores := v_errores || E'\n  service_role en ' || r.firma || ': esperado ' || r.esperado_service;
    end if;
  end loop;

  if v_errores <> '' then
    raise exception 'Los permisos de funciones no quedaron como se esperaba; se deshace todo:%', v_errores;
  end if;
end
$verificar$;

commit;
