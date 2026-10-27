import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { profileLabel } from "@/lib/utils/profile-label";
import type { PublicProfile, VoteOption, VoteResponse } from "@/lib/supabase/types";
import { ExportCsvButton } from "./export-csv-button";
import { VoteOptionsEditor } from "./vote-options-editor";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO");
}

export default async function AdminVotosPage() {
  // Repite el guard del layout: esta página lee vote_responses de todos los
  // jugadores con el cliente service_role (la RLS solo deja a cada uno ver
  // la suya), y Next puede empezar a renderizarla en paralelo con el layout.
  // Esta pantalla NO se apaga por fecha: hay que poder ver los resultados
  // después de que cierre la votación.
  await requireAdminOrRedirect();
  const admin = createAdminClient();

  const [{ data: optionRows }, { data: responseRows }, { count: totalPlayers }] =
    await Promise.all([
      admin
        .from("vote_options")
        .select("id, slug, label, description, sort_order, is_active")
        .order("sort_order"),
      admin
        .from("vote_responses")
        .select("user_id, ranking, other_text, created_at, updated_at")
        .order("created_at", { ascending: false }),
      admin.from("profiles").select("*", { count: "exact", head: true }),
    ]);

  const options = (optionRows as VoteOption[] | null) ?? [];
  const responses = (responseRows as VoteResponse[] | null) ?? [];
  const activeOptions = options.filter((option) => option.is_active);
  const activeSlugs = new Set(activeOptions.map((option) => option.slug));

  const userIds = responses.map((response) => response.user_id);
  const profilesById = new Map<string, PublicProfile>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, player_code, avatar_url")
      .in("id", userIds);
    for (const profile of (profiles as PublicProfile[] | null) ?? []) {
      profilesById.set(profile.id, profile);
    }
  }

  // Las respuestas guardadas con ideas que ya no existen (o están
  // desactivadas) se ignoran: cada ranking se filtra a las ideas activas
  // y las posiciones se cuentan sobre lo que queda.
  const filteredRankings = responses.map((response) =>
    (Array.isArray(response.ranking) ? response.ranking : []).filter((slug) =>
      activeSlugs.has(slug),
    ),
  );

  const stats = activeOptions
    .map((option) => {
      let positionSum = 0;
      let timesRanked = 0;
      let firstPlace = 0;
      for (const ranking of filteredRankings) {
        const index = ranking.indexOf(option.slug);
        if (index === -1) continue;
        positionSum += index + 1;
        timesRanked += 1;
        if (index === 0) firstPlace += 1;
      }
      return {
        option,
        average: timesRanked > 0 ? positionSum / timesRanked : null,
        timesRanked,
        firstPlace,
      };
    })
    .sort((a, b) => {
      if (a.average === null && b.average === null) return 0;
      if (a.average === null) return 1;
      if (b.average === null) return -1;
      return a.average - b.average;
    });

  const otherTexts = responses
    .map((response) => ({ response, profile: profilesById.get(response.user_id) ?? null }))
    .filter(({ response }) => response.other_text);

  const csvHeaders = [
    "Jugador",
    "Código de jugador",
    "Respondió",
    "Actualizó",
    ...activeOptions.map((_, index) => `Posición ${index + 1}`),
    "Otro",
  ];
  const labelBySlug = new Map(activeOptions.map((option) => [option.slug, option.label]));
  const csvRows = responses.map((response, responseIndex) => {
    const profile = profilesById.get(response.user_id);
    const ranking = filteredRankings[responseIndex];
    return [
      profileLabel(profile),
      profile?.player_code ?? "",
      formatDate(response.created_at),
      formatDate(response.updated_at),
      ...activeOptions.map((_, index) => labelBySlug.get(ranking[index]) ?? ""),
      response.other_text ?? "",
    ];
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Votos: próximas actualizaciones</h1>
        <ExportCsvButton headers={csvHeaders} rows={csvRows} />
      </div>

      <section className="rounded-lg border border-marca-noche/10 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-marca-noche/60">
          Respuestas recibidas
        </p>
        <p className="mt-1 text-3xl font-bold text-marca-noche">
          {responses.length.toLocaleString("es-CO")}{" "}
          <span className="text-base font-normal text-marca-noche/60">
            de {(totalPlayers ?? 0).toLocaleString("es-CO")} jugadores
          </span>
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">Por idea</h2>
        {stats.length === 0 ? (
          <EmptyState icon="🗳️" message="No hay ideas activas." compact />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-marca-noche/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-marca-noche/10 text-xs uppercase tracking-wide text-marca-noche/60">
                <tr>
                  <th className="px-3 py-2">Idea</th>
                  <th className="px-3 py-2 text-right">Posición promedio</th>
                  <th className="px-3 py-2 text-right">Primer lugar</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(({ option, average, timesRanked, firstPlace }) => (
                  <tr key={option.id} className="border-b border-marca-noche/5 last:border-0">
                    <td className="px-3 py-2 font-semibold text-marca-noche">{option.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {average === null ? "—" : average.toFixed(2)}
                      {timesRanked > 0 && (
                        <span className="ml-1 text-xs text-marca-noche/50">({timesRanked})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {firstPlace.toLocaleString("es-CO")} {firstPlace === 1 ? "vez" : "veces"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">Otras ideas de los jugadores</h2>
        {otherTexts.length === 0 ? (
          <EmptyState icon="💬" message="Todavía nadie dejó una idea propia." compact />
        ) : (
          <ul className="flex flex-col gap-3">
            {otherTexts.map(({ response, profile }) => (
              <li
                key={response.user_id}
                className="rounded-lg border border-marca-noche/10 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-marca-noche/60">
                  <span className="font-semibold">{profileLabel(profile)}</span>
                  <span>{formatDate(response.updated_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-marca-noche">
                  {response.other_text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">Ideas</h2>
        <p className="text-xs text-marca-noche/60">
          Cambiar el nombre o la descripción no afecta las respuestas ya guardadas. Una idea
          desactivada deja de aparecer para los jugadores y se ignora en los resultados.
        </p>
        <VoteOptionsEditor options={options} />
      </section>
    </div>
  );
}
