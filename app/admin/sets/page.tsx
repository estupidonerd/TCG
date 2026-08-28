import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CardSet } from "@/lib/supabase/types";

export default async function AdminSetsPage() {
  const supabase = await createClient();
  const { data: sets } = await supabase
    .from("card_sets")
    .select("id, name, slug, description, released_at, is_active")
    .order("released_at", { ascending: false, nullsFirst: false });

  const rows = (sets as CardSet[] | null) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl">Expansiones</h1>
        <Link
          href="/admin/sets/new"
          className="rounded bg-marca-violeta px-4 py-2 text-sm font-semibold text-white"
        >
          Nueva expansión
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-marca-noche/10 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-marca-noche/10 text-left text-marca-noche/60">
              <th className="px-4 py-2 font-semibold">Nombre</th>
              <th className="px-4 py-2 font-semibold">Slug</th>
              <th className="px-4 py-2 font-semibold">Lanzamiento</th>
              <th className="px-4 py-2 font-semibold">Activa</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((set) => (
              <tr
                key={set.id}
                className="border-b border-marca-noche/5 last:border-0"
              >
                <td className="px-4 py-2">{set.name}</td>
                <td className="px-4 py-2 text-marca-noche/60">{set.slug}</td>
                <td className="px-4 py-2 text-marca-noche/60">
                  {set.released_at
                    ? new Date(set.released_at).toLocaleDateString("es-AR")
                    : "—"}
                </td>
                <td className="px-4 py-2">{set.is_active ? "Sí" : "No"}</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/sets/${set.id}`}
                    className="text-marca-violeta hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-marca-noche/50">
                  Todavía no hay expansiones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
