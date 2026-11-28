-- ============================================================================
-- ROLLBACK de 20260925000000_default_privileges_functions.sql
--
-- Deja el permiso por defecto de las funciones nuevas que crea postgres en
-- public EXACTAMENTE como estaba antes (confirmado en Pruebas el 2026-11-28):
--   {postgres=X/postgres, anon=X/postgres, authenticated=X/postgres,
--    service_role=X/postgres}
-- es decir, toda función nueva vuelve a nacer ejecutable por anon y
-- authenticated.
--
-- No toca ninguna función existente (el default solo aplica a las nuevas).
--
-- OJO: vuelve al comportamiento que causó el hueco de seguridad (una función
-- nueva con solo `revoke ... from public` queda abierta a anon y authenticated).
-- Úsalo solo si la migración causó un problema real.
--
-- Es seguro correrlo más de una vez. No se ejecuta automáticamente: pegar en el
-- SQL Editor de Supabase.
-- ============================================================================

begin;

alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated;

commit;
