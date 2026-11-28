-- ============================================================================
-- ROLLBACK de 20260923000000_drop_user_cards_delete_policy.sql
--
-- Recrea la policy user_cards_delete_own EXACTAMENTE como estaba: el texto sale
-- de 20260823000000_initial_schema.sql (líneas 437-440).
--
-- OJO: volver a crearla reabre el hueco de seguridad (un jugador con sesión
-- puede borrar sus propias filas de user_cards desde el cliente, saltándose
-- reservas de mazo y trades pendientes). Úsalo solo si la migración que la
-- quita causó un problema real, y vuelve a quitarla apenas se corrija.
--
-- Es seguro correrlo aunque la policy ya exista (la quita y la vuelve a crear).
-- No se ejecuta automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

begin;

drop policy if exists user_cards_delete_own on public.user_cards;

create policy user_cards_delete_own
  on public.user_cards for delete
  to authenticated
  using (user_id = auth.uid());

commit;
