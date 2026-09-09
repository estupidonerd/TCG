import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fieldInputClass } from "@/components/admin/form-field";
import { EmptyState } from "@/components/ui/empty-state";
import { RARITIES, RARITY_LABELS } from "@/lib/supabase/types";
import type { Card, CardSet } from "@/lib/supabase/types";

type SortMode = "name" | "orden";

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; rarity?: string; q?: string; sort?: string }>;
}) {
  const { set: setFilter, rarity: rarityFilter, q, sort } = await searchParams;
  const sortMode: SortMode = sort === "orden" ? "orden" : "name";
  const supabase = await createClient();

  const { data: sets } = await supabase
    .from("card_sets")
    .select("id, name, slug, description, released_at, is_active")
    .order("name");

  let query = supabase
    .from("cards")
    .select("id, set_id, slug, name, rarity, image_front_url, is_active, sort_order")
    .order("name", { ascending: true });

  if (setFilter) query = query.eq("set_id", setFilter);
  if (rarityFilter) query = query.eq("rarity", rarityFilter);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const { data: cards } = await query;

  const typedSets = (sets as CardSet[] | null) ?? [];
  const setsById = new Map(typedSets.map((s) => [s.id, s]));

  // Agrupadas por expansión (alfabético, mismo orden que el selector de
  // arriba), y adentro de cada una por nombre o por el número interno
  // (sort_order) según lo que se elija -- sort_order es el orden que ve el
  // jugador en /coleccion, acá es solo una forma más de navegar el catálogo,
  // no la que manda por defecto.
  const typedCards = (cards as Card[] | null) ?? [];
  const cardsBySet = new Map<string, Card[]>();
  for (const card of typedCards) {
    const list = cardsBySet.get(card.set_id) ?? [];
    list.push(card);
    cardsBySet.set(card.set_id, list);
  }
  if (sortMode === "orden") {
    for (const list of cardsBySet.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order);
    }
  }
  const knownSetIds = new Set(typedSets.map((s) => s.id));
  const orderedCards = [
    ...typedSets.flatMap((set) => cardsBySet.get(set.id) ?? []),
    ...typedCards.filter((card) => !knownSetIds.has(card.set_id)),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl">Cartas</h1>
        <Link
          href="/admin/cards/new"
          className="rounded bg-marca-rojo px-4 py-2 text-sm font-semibold text-marca-claro"
        >
          Nueva carta
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar carta por nombre…"
          className={`${fieldInputClass} w-full sm:w-56`}
        />
        <select name="set" defaultValue={setFilter ?? ""} className={fieldInputClass}>
          <option value="">Todas las expansiones</option>
          {typedSets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="rarity" defaultValue={rarityFilter ?? ""} className={fieldInputClass}>
          <option value="">Todas las rarezas</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {RARITY_LABELS[r]}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sortMode} className={fieldInputClass}>
          <option value="name">Ordenar por nombre</option>
          <option value="orden">Ordenar por número interno</option>
        </select>
        <button
          type="submit"
          className="rounded border border-marca-noche/20 px-4 py-2 text-sm font-semibold text-marca-noche"
        >
          Filtrar
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orderedCards.map((card) => (
          <Link
            key={card.id}
            href={`/admin/cards/${card.id}`}
            className="flex gap-3 rounded-lg border border-marca-noche/10 bg-white p-3 transition-colors hover:border-marca-violeta"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-marca-noche/10">
              {card.image_front_url && (
                // eslint-disable-next-line @next/next/no-img-element -- thumbnail remoto
                <img
                  src={card.image_front_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-semibold text-marca-noche">{card.name}</span>
              <span className="text-xs text-marca-noche/60">
                {setsById.get(card.set_id)?.name ?? "—"} · {RARITY_LABELS[card.rarity]}
                {!card.is_active && " · inactiva"}
              </span>
            </div>
          </Link>
        ))}
        {orderedCards.length === 0 && (
          <div className="col-span-full">
            <EmptyState icon="🃏" message="No hay cartas con esos filtros." compact />
          </div>
        )}
      </div>
    </div>
  );
}
