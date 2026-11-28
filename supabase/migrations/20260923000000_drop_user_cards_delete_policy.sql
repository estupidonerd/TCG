-- ============================================================================
-- CIERRE DE UN HUECO DE SEGURIDAD -- quita la policy user_cards_delete_own.
--
-- Esa policy (creada en 20260823000000_initial_schema) dejaba a cualquier
-- jugador con sesión borrar sus propias filas de user_cards directo desde el
-- cliente, saltándose las reservas de mazo y los intercambios pendientes. Las
-- policies de insert y update ya se habían quitado (20260826000000), y la
-- migración 20260830000000 dice que "las escrituras siguen cerradas al
-- cliente", pero la de delete se quedó por olvido.
--
-- Nada del código del juego depende de ella: ningún lugar de la app borra
-- user_cards con el cliente. Las cartas solo se mueven con funciones
-- SECURITY DEFINER (redeem_code, accept_trade, save_deck, decrease_user_card,
-- delete_deck), que corren con permisos del dueño y no pasan por las
-- policies. Borrar una cuenta limpia user_cards por ON DELETE CASCADE, que
-- tampoco pasa por las policies.
--
-- Sin policy de DELETE y con RLS activado, un DELETE desde el cliente no falla
-- con error: simplemente no borra ninguna fila.
--
-- No toca nada más (ni los GRANTs de la tabla ni ninguna otra policy).
--
-- Rollback: supabase/rollback/user_cards_delete_rollback.sql
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase
-- (primero en el proyecto de pruebas).
-- ============================================================================

begin;

drop policy if exists user_cards_delete_own on public.user_cards;

commit;
