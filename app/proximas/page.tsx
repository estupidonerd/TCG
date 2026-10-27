import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isVoteOpen } from "@/lib/config/vote";
import { EmptyState } from "@/components/ui/empty-state";
import type { VoteOption, VoteResponse } from "@/lib/supabase/types";
import { VoteForm } from "./vote-form";

export default async function ProximasPage() {
  // Fuera de la ventana de fechas esta pantalla no existe para el jugador
  // (el código sigue ahí, solo apagado por fecha).
  if (!isVoteOpen()) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: options }, { data: response }] = await Promise.all([
    supabase
      .from("vote_options")
      .select("id, slug, label, description, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("vote_responses")
      .select("user_id, ranking, other_text, created_at, updated_at")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  const activeOptions = (options as VoteOption[] | null) ?? [];
  const saved = response as VoteResponse | null;

  // Si hay respuesta guardada, se carga en ese orden. Las ideas que ya no
  // existen o están desactivadas se ignoran; las nuevas que el jugador
  // todavía no vio se agregan al final, en su orden de siempre.
  let ordered = activeOptions;
  if (saved) {
    const bySlug = new Map(activeOptions.map((option) => [option.slug, option]));
    const inSavedOrder = (saved.ranking ?? [])
      .map((slug) => bySlug.get(slug))
      .filter((option): option is VoteOption => option !== undefined);
    const placed = new Set(inSavedOrder.map((option) => option.slug));
    ordered = [...inSavedOrder, ...activeOptions.filter((option) => !placed.has(option.slug))];
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-4 px-4 py-8 sm:px-6">
      <h1 className="text-3xl sm:text-4xl">Próximas actualizaciones</h1>
      <p className="text-sm text-marca-noche/70">
        Estamos decidiendo qué construir primero. Ordena estas ideas, de la que más te importa
        (arriba) a la que menos (abajo).
      </p>

      {ordered.length === 0 ? (
        <EmptyState icon="🗳️" message="Por ahora no hay ideas para ordenar." compact />
      ) : (
        <VoteForm
          options={ordered}
          initialOtherText={saved?.other_text ?? ""}
          alreadyVoted={saved !== null}
        />
      )}
    </main>
  );
}
