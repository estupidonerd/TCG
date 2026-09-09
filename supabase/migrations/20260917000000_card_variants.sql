-- ============================================================================
-- CARTAS VARIANTE -- una carta puede ser variante de otra (misma carta base,
-- con su propia rareza y arte). variant_of es nullable: null significa
-- carta independiente, exactamente el comportamiento de siempre.
--
-- Aditivo: no toca ninguna columna existente.
--
-- on delete set null: si alguna vez se borra la carta base, la variante no
-- se borra en cascada -- simplemente deja de ser variante de nada (pasa a
-- comportarse como carta independiente), en vez de fallar el delete o
-- arrastrar borrados en cadena.
--
-- No se ejecutó automáticamente: pegar en el SQL Editor de Supabase.
-- ============================================================================

alter table public.cards
  add column variant_of uuid references public.cards(id) on delete set null,
  add constraint cards_variant_of_not_self check (variant_of is null or variant_of <> id);

create index cards_variant_of_idx on public.cards(variant_of) where variant_of is not null;

comment on column public.cards.variant_of is 'Si no es null, esta carta es una variante de otra (referencia a cards.id). En /coleccion, una variante que el jugador no tiene (quantity 0) no aparece en absoluto -- ni como silueta -- hasta que consigue al menos 1 copia. Cartas con variant_of null se comportan igual que siempre.';
