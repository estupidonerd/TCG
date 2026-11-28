-- ============================================================================
-- ROLLBACK de 20260924000000_lock_function_permissions.sql
--
-- Restaura los permisos de EXECUTE de las 25 funciones afectadas EXACTAMENTE
-- como estaban antes (según los permisos reales de Pruebas el 2026-11-28):
--   * las 22 primeras: anon, authenticated, service_role (y el dueño postgres,
--     que nunca se toca);
--   * las 3 que nunca revocaron PUBLIC (generate_player_code, handle_new_user,
--     set_redemption_one_per_user): además, PUBLIC.
-- No toca ninguna otra función: game_now, save_vote_response y
-- admin_set_test_clock (cerradas a anon) y get_public_access_state y
-- get_active_splash (abiertas a anon a propósito) no cambiaron con la migración.
--
-- OJO: esto REABRE el hueco de seguridad (cualquiera puede llamar con .rpc()
-- funciones como increase_user_card, que regala cartas, o admin_list_players).
-- Úsalo solo si la migración causó un problema real, y vuelve a aplicarla
-- apenas se corrija.
--
-- Es seguro correrlo más de una vez. No se ejecuta automáticamente: pegar en el
-- SQL Editor de Supabase.
-- ============================================================================

begin;

grant execute on function public.accept_trade(uuid)                          to anon, authenticated, service_role;
grant execute on function public.admin_list_players()                        to anon, authenticated, service_role;
grant execute on function public.block_user(uuid)                            to anon, authenticated, service_role;
grant execute on function public.cancel_trade(uuid)                          to anon, authenticated, service_role;
grant execute on function public.clear_trade_history()                       to anon, authenticated, service_role;
grant execute on function public.create_trade(uuid, text, jsonb, jsonb)      to anon, authenticated, service_role;
grant execute on function public.deck_reserved_quantity(uuid, uuid)          to anon, authenticated, service_role;
grant execute on function public.decrease_user_card(uuid, uuid, integer)     to anon, authenticated, service_role;
grant execute on function public.delete_deck(uuid, boolean)                  to anon, authenticated, service_role;
grant execute on function public.expire_old_trades()                         to anon, authenticated, service_role;
grant execute on function public.find_profile_by_code(text)                  to anon, authenticated, service_role;
grant execute on function public.get_public_profiles(uuid[])                 to anon, authenticated, service_role;
grant execute on function public.increase_user_card(uuid, uuid, integer)     to anon, authenticated, service_role;
grant execute on function public.is_banned(uuid)                             to anon, authenticated, service_role;
grant execute on function public.pick_weighted_rarity(jsonb)                 to anon, authenticated, service_role;
grant execute on function public.redeem_code(text)                           to anon, authenticated, service_role;
grant execute on function public.reject_trade(uuid)                          to anon, authenticated, service_role;
grant execute on function public.release_unused_reservation(uuid)            to anon, authenticated, service_role;
grant execute on function public.save_deck(uuid, text, jsonb)                to anon, authenticated, service_role;
grant execute on function public.set_all_cards_private()                     to anon, authenticated, service_role;
grant execute on function public.set_all_cards_public()                      to anon, authenticated, service_role;
grant execute on function public.set_card_public_quantity(uuid, integer)     to anon, authenticated, service_role;

-- Las tres que además tenían PUBLIC:
grant execute on function public.generate_player_code()                      to public, anon, authenticated, service_role;
grant execute on function public.handle_new_user()                           to public, anon, authenticated, service_role;
grant execute on function public.set_redemption_one_per_user()               to public, anon, authenticated, service_role;

commit;
