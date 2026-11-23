-- ============================================================================
-- HUELLA DEL ESQUEMA -- solo lee, no cambia nada. Se puede correr en cualquier
-- proyecto (Pruebas o producción) sin riesgo.
--
-- Devuelve una fila por cada parte del esquema de public, con un código corto
-- (md5) y cuántos elementos tiene. Corre esta misma consulta en el SQL Editor
-- de Pruebas y en el de producción y compara:
--   * Si TODOS los códigos coinciden, las dos bases tienen el mismo esquema.
--   * Si uno cambia, esa parte difiere (la fila "TOTAL" cambia siempre que
--     cualquier otra cambie). Típico: una migración que está en un proyecto y
--     todavía no en el otro.
--
-- Qué cubre: columnas (tipo, nulidad, valor por defecto), restricciones,
-- índices, funciones (el texto completo de su definición), triggers,
-- políticas de RLS, si cada tabla tiene RLS activado, y los permisos (GRANT)
-- sobre tablas y funciones para anon, authenticated y service_role.
-- No cubre datos (filas), ni Storage, ni usuarios de auth.
-- ============================================================================

with partes as (
  select '1 columnas' as parte,
         count(*) as elementos,
         coalesce(md5(string_agg(
           table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, ''),
           E'\n' order by table_name, column_name)), md5('')) as huella
  from information_schema.columns
  where table_schema = 'public'

  union all
  select '2 restricciones', count(*),
         coalesce(md5(string_agg(
           c.conrelid::regclass::text || '.' || c.conname || ':' || pg_get_constraintdef(c.oid),
           E'\n' order by c.conrelid::regclass::text, c.conname)), md5(''))
  from pg_constraint c
  join pg_namespace n on n.oid = c.connamespace
  where n.nspname = 'public'

  union all
  select '3 índices', count(*),
         coalesce(md5(string_agg(indexdef, E'\n' order by tablename, indexname)), md5(''))
  from pg_indexes
  where schemaname = 'public'

  union all
  select '4 funciones', count(*),
         coalesce(md5(string_agg(
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || '):' || md5(pg_get_functiondef(p.oid)),
           E'\n' order by p.proname, pg_get_function_identity_arguments(p.oid))), md5(''))
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'

  union all
  select '5 triggers', count(*),
         coalesce(md5(string_agg(pg_get_triggerdef(t.oid), E'\n' order by t.tgrelid::regclass::text, t.tgname)), md5(''))
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal

  union all
  select '6 políticas RLS', count(*),
         coalesce(md5(string_agg(
           tablename || '.' || policyname || ':' || cmd || ':' || array_to_string(roles, ',') || ':' ||
           coalesce(qual, '') || ':' || coalesce(with_check, ''),
           E'\n' order by tablename, policyname)), md5(''))
  from pg_policies
  where schemaname = 'public'

  union all
  select '7 RLS activado por tabla', count(*),
         coalesce(md5(string_agg(c.relname || ':' || c.relrowsecurity::text, E'\n' order by c.relname)), md5(''))
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'

  union all
  select '8 permisos de tablas', count(*),
         coalesce(md5(string_agg(
           table_name || ':' || grantee || ':' || privilege_type,
           E'\n' order by table_name, grantee, privilege_type)), md5(''))
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')

  union all
  select '9 permisos de funciones', count(*),
         coalesce(md5(string_agg(
           routine_name || ':' || grantee,
           E'\n' order by routine_name, grantee)), md5(''))
  from information_schema.routine_privileges
  where routine_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
)
select parte, elementos, huella from partes
union all
select 'TOTAL', sum(elementos), md5(string_agg(huella, '' order by parte)) from partes
order by parte;
