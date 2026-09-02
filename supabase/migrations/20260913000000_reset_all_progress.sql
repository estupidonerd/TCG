-- ============================================================================
-- RESET COMPLETO DE PROGRESO DE JUGADORES -- no es una migración de esquema,
-- es un borrado de datos de una sola vez (antes del lanzamiento, para
-- limpiar todo lo cargado en pruebas). Cuentas, perfiles y player_code
-- quedan intactos: nadie tiene que volver a loguearse.
--
-- Confirmado contra la base real antes de escribir esto:
--   user_cards 11 filas, deck_cards 2, decks 1, trade_items 15, trades 10
--   (0 pendientes), redemptions 13, y 13 de los 19 códigos con uso > 0.
--
-- Todo en una sola transacción: si algo falla a mitad de camino, no queda
-- nada a medio borrar -- se revierte entero.
--
-- NO toca profiles, auth.users, cards, card_sets, pack_types, ni la tabla
-- codes en sí (solo su columna uses_count).
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

begin;

-- Intercambios: primero los items (referencian trades), después los trades.
-- trade_items.trade_id ya tiene on delete cascade, así que borrar trades
-- solo también alcanzaría, pero se hace explícito en el mismo orden que se
-- pidió.
delete from public.trade_items;
delete from public.trades;

-- Mazos: mismo criterio, deck_cards.deck_id también cascadea desde decks,
-- pero se borra explícito.
delete from public.deck_cards;
delete from public.decks;

-- Canjes ya hechos.
delete from public.redemptions;

-- Colección de cada jugador.
delete from public.user_cards;

-- Códigos: no se borra ninguno, solo se resetea el contador de usos para
-- que vuelvan a estar disponibles como si no se hubieran canjeado.
update public.codes set uses_count = 0;

commit;
