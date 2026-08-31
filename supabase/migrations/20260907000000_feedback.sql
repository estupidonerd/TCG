-- ============================================================================
-- Feedback de jugadores: botón flotante en toda la app que abre un
-- formulario corto (tipo + mensaje). page_path se guarda solo, sin
-- pedírselo al jugador. No hay política de SELECT para anon/authenticated
-- a propósito (mismo patrón que `codes`): solo se lee desde /admin/feedback,
-- que usa el cliente service_role.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('falla', 'sugerencia', 'otro')),
  page_path text not null,
  message text not null check (length(trim(message)) > 0),
  created_at timestamptz not null default now()
);

comment on table public.feedback is
  'Feedback enviado por jugadores desde el botón flotante. Solo lectura para admins (service_role).';
comment on column public.feedback.user_id is
  'Null si se envió sin sesión iniciada. on delete set null: no se pierde el feedback si se borra la cuenta.';
comment on column public.feedback.page_path is
  'Ruta desde la que se envió, capturada sola (nunca la escribe el jugador).';

create index idx_feedback_created_at on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Cualquiera puede dejar feedback (con o sin sesión), pero solo puede
-- adjudicárselo a sí mismo: user_id tiene que ser null o su propio uid.
-- Sin policy de SELECT/UPDATE/DELETE: una vez enviado, ni se puede leer ni
-- tocar desde el cliente.
create policy feedback_insert_any
  on public.feedback for insert
  to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
