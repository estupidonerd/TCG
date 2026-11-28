-- ============================================================================
-- PERMISOS POR DEFECTO DE LAS FUNCIONES NUEVAS EN public -- que nazcan cerradas.
--
-- El problema que causó el hueco de 20260924000000_lock_function_permissions:
-- en Supabase, toda función nueva que crea el rol postgres en el esquema public
-- recibe EXECUTE para anon y authenticated automáticamente (entrada de
-- pg_default_acl: postgres / public / funciones =
-- {postgres, anon, authenticated, service_role}). Un `revoke ... from public`
-- no se lo quita, y las migraciones antiguas solo hacían eso.
--
-- Qué hace esta migración: quita anon y authenticated de ESE valor por defecto.
-- Desde ahora, una función nueva creada por postgres en public:
--   * ya no es ejecutable por anon ni authenticated por simple herencia;
--   * si debe ser llamada desde el navegador, hay que darle `grant execute`
--     de forma explícita (y si se olvida, falla con "permission denied" en las
--     pruebas, no en producción).
--
-- Qué NO hace:
--   * No cambia ninguna función existente ni ningún permiso actual (el default
--     solo aplica a funciones que se creen DESPUÉS). Tampoco `create or replace`
--     sobre una función existente cambia sus permisos.
--   * No toca tablas ni secuencias (sus defaults siguen igual).
--   * No cierra el pseudo-rol PUBLIC: Postgres da EXECUTE a PUBLIC a toda
--     función nueva y anon/authenticated lo heredan. Por eso sigue siendo
--     obligatorio terminar cada función nueva con `revoke execute ... from
--     public` (regla en CLAUDE.md).
--   * No toca las entradas de otros roles (supabase_admin, supabase_auth_admin)
--     ni de otros esquemas: no creamos funciones con esos roles.
--
-- Rol: las migraciones y el SQL Editor corren como postgres (confirmado en
-- Pruebas), que además es el dueño de las 30 funciones de public. Se nombra
-- `for role postgres` a propósito: así la migración hace lo mismo sin importar
-- desde dónde se corra, y falla claro (no en silencio) si la corre un rol sin
-- permiso para hablar por postgres.
--
-- Se verifica sola al final; si el valor por defecto no queda como debe, se
-- deshace todo.
--
-- Rollback: supabase/rollback/permisos_por_defecto_rollback.sql
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase
-- (primero en el proyecto de pruebas).
-- ============================================================================

begin;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

do $verificar$
declare
  v_roles text[];
begin
  select coalesce(array_agg(distinct r.rolname::text order by r.rolname::text), '{}')
    into v_roles
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) a
  join pg_roles r on r.oid = a.grantee
  where pg_get_userbyid(d.defaclrole) = 'postgres'
    and n.nspname = 'public'
    and d.defaclobjtype = 'f'
    and a.privilege_type = 'EXECUTE';

  -- Lo que importa: anon y authenticated ya no están, y service_role se conserva.
  if 'anon' = any(v_roles) or 'authenticated' = any(v_roles) or not ('service_role' = any(v_roles)) then
    raise exception 'El permiso por defecto de funciones nuevas no quedó como se esperaba (sin anon ni authenticated, con service_role); quedó: %. Se deshace todo.', v_roles;
  end if;
end
$verificar$;

commit;
