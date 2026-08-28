-- ============================================================================
-- Admin: columna is_admin en profiles + buckets de Storage para imágenes de
-- cartas. No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================


-- ============================================================================
-- profiles.is_admin
-- Se activa a mano desde el dashboard de Supabase (Table Editor), nunca
-- desde la app.
-- ============================================================================

alter table public.profiles
  add column is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Acceso al panel /admin. Se activa manualmente desde Supabase.';

-- IMPORTANTE: antes de esto, la policy profiles_update_own dejaba actualizar
-- CUALQUIER columna de la propia fila -- a partir de agregar is_admin, eso
-- incluiría poder hacer `update profiles set is_admin = true where id =
-- auth.uid()` directo desde el cliente y auto-otorgarse acceso de admin.
-- Se cierra restringiendo, a nivel de GRANT (no de policy), qué columnas
-- puede tocar el rol authenticated en un UPDATE. is_admin queda afuera.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;


-- ============================================================================
-- Storage: buckets para las imágenes de cartas.
--
-- card-images (público): frente/dorso en resolución de pantalla, lo que ve
-- el jugador en la app. Mismo nivel de confianza que la tabla `cards`
-- (que ya es de lectura pública), así que el bucket es público.
--
-- card-print (privado): frente/dorso en alta resolución para imprimir.
-- No se expone directamente -- ni siquiera a usuarios autenticados -- para
-- no filtrar los archivos maestros de impresión. Cuando exista la función
-- de impresión real (Fase 2, ruta /imprimir), se sirven con signed URLs
-- generadas server-side bajo demanda, no con acceso público directo.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('card-print', 'card-print', false)
on conflict (id) do nothing;

-- Lectura pública de las imágenes de pantalla (equivalente a la policy de
-- lectura pública que ya tiene la tabla cards).
create policy card_images_select_public
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'card-images');

-- card-print: a propósito NO se crea ninguna policy (mismo patrón que la
-- tabla `codes`). Sin policies, ni anon ni authenticated pueden leer ni
-- escribir ahí bajo ninguna circunstancia; solo service_role, que es
-- justamente el que usan los Server Actions del panel /admin para subir
-- los archivos de impresión y (a futuro) generar signed URLs.
--
-- Ninguno de los dos buckets tiene policy de INSERT/UPDATE/DELETE para
-- anon/authenticated: toda escritura de imágenes pasa por Server Actions
-- que ya verificaron is_admin y usan el cliente service_role.
