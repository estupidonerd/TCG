-- ============================================================================
-- Bug confirmado: borrar un mazo con "liberar cartas" tildado (o sacar una
-- carta del todo en el editor con el interruptor de autoliberar prendido)
-- podía romper con "new row for relation user_cards violates check
-- constraint user_cards_check" y, al reventar la transacción entera,
-- terminaba SIN borrar el mazo tampoco.
--
-- Causa: release_unused_reservation calculaba
--   public_quantity = quantity - (lo que usan los mazos restantes)
-- y si la carta ya no está en NINGÚN mazo, eso da quantity - 0 = quantity
-- completa -- pisando la regla de siempre de dejar al menos 1 copia
-- privada (el check public_quantity <= quantity - 1). El resto de las
-- funciones (increase_user_card, save_deck, set_card_public_quantity,
-- set_all_cards_public) ya usaban greatest(1, ...) para esto; esta se
-- quedó afuera cuando se centralizó ese criterio.
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

create or replace function public.release_unused_reservation(p_card_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_max_in_decks integer;
  v_owned integer;
  v_new_public integer;
begin
  if v_user_id is null then
    raise exception 'Tienes que iniciar sesión.';
  end if;

  select coalesce(max(dc.quantity), 0) into v_max_in_decks
  from public.deck_cards dc
  join public.decks d on d.id = dc.deck_id
  where d.user_id = v_user_id and dc.card_id = p_card_id;

  select quantity into v_owned
  from public.user_cards
  where user_id = v_user_id and card_id = p_card_id;

  if v_owned is null then
    return;
  end if;

  v_new_public := v_owned - greatest(1, v_max_in_decks);

  update public.user_cards
  set public_quantity = v_new_public
  where user_id = v_user_id and card_id = p_card_id
    and public_quantity < v_new_public;
end;
$$;

revoke all on function public.release_unused_reservation(uuid) from public;
grant execute on function public.release_unused_reservation(uuid) to authenticated;


-- ============================================================================
-- Backfill: por si alguien ya pisó esta regla antes de este fix (aunque en
-- la práctica el check de la tabla lo habría bloqueado siempre, así que
-- esto es solo por las dudas -- no debería tocar ninguna fila).
-- ============================================================================

update public.user_cards uc
set public_quantity = greatest(
  0,
  uc.quantity - greatest(1, public.deck_reserved_quantity(uc.user_id, uc.card_id))
)
where uc.public_quantity > greatest(
  0,
  uc.quantity - greatest(1, public.deck_reserved_quantity(uc.user_id, uc.card_id))
);
