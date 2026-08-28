// cards.sort_order solo ordena DENTRO de una expansión, no entre
// expansiones -- para que la grilla y la navegación anterior/siguiente
// naveguen en un orden coherente (expansión por expansión, según
// released_at, y adentro por sort_order), hay que combinar ambos acá en
// vez de confiar en un solo ORDER BY de Postgres.
export function sortCardsBySet<T extends { set_id: string; sort_order: number }>(
  cards: T[],
  // Se asume que `sets` ya viene ordenado como corresponde (ej. por
  // released_at): acá solo se usa la posición de cada set en ese array.
  sets: { id: string }[],
): T[] {
  const setOrder = new Map(sets.map((set, index) => [set.id, index]));
  return [...cards].sort((a, b) => {
    const setDiff = (setOrder.get(a.set_id) ?? 0) - (setOrder.get(b.set_id) ?? 0);
    if (setDiff !== 0) return setDiff;
    return a.sort_order - b.sort_order;
  });
}
