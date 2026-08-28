import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { RARITY_LABELS } from "@/lib/supabase/types";
import type { PackType } from "@/lib/supabase/types";

export default async function AdminPacksPage() {
  const supabase = await createClient();
  const { data: packs } = await supabase
    .from("pack_types")
    .select("id, name, cards_count, rarity_weights, allowed_set_ids, guaranteed_rarity, image_url")
    .order("name");

  const rows = (packs as PackType[] | null) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl">Sobres</h1>
        <Link
          href="/admin/packs/new"
          className="rounded bg-marca-violeta px-4 py-2 text-sm font-semibold text-white"
        >
          Nuevo tipo de sobre
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((pack) => (
          <Link
            key={pack.id}
            href={`/admin/packs/${pack.id}`}
            className="flex items-center gap-3 rounded-lg border border-marca-noche/10 bg-white p-4 transition-colors hover:border-marca-violeta"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-marca-noche/10">
              {pack.image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- thumbnail remoto
                <img
                  src={pack.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-marca-noche">{pack.name}</span>
              <span className="text-xs text-marca-noche/60">
                {pack.cards_count} cartas · {pack.allowed_set_ids?.length ?? 0} expansiones
                {pack.guaranteed_rarity &&
                  ` · garantiza ${RARITY_LABELS[pack.guaranteed_rarity]}`}
              </span>
            </div>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-marca-noche/50">
            Todavía no hay tipos de sobre.
          </p>
        )}
      </div>
    </div>
  );
}
