-- ============================================================================
-- Borrar historial de intercambios: cada usuario puede ocultar de SU lado
-- los intercambios ya resueltos (aceptado/rechazado/cancelado/expirado).
-- No es un delete físico de la fila (la otra parte del intercambio puede
-- seguir queriendo verlo en su propio historial), así que se resuelve con
-- dos columnas booleanas -- una por lado -- en vez de tocar la fila de
-- trades en sí.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.trades
  add column hidden_by_sender boolean not null default false,
  add column hidden_by_receiver boolean not null default false;

comment on column public.trades.hidden_by_sender is
  'El sender borró este intercambio (ya resuelto) de SU historial. No afecta lo que ve el receiver.';
comment on column public.trades.hidden_by_receiver is
  'El receiver borró este intercambio (ya resuelto) de SU historial. No afecta lo que ve el sender.';


create or replace function public.clear_trade_history()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  update public.trades
  set hidden_by_sender = true
  where sender_id = v_user_id and status <> 'pendiente';

  update public.trades
  set hidden_by_receiver = true
  where receiver_id = v_user_id and status <> 'pendiente';
end;
$$;

revoke all on function public.clear_trade_history() from public;
grant execute on function public.clear_trade_history() to authenticated;
