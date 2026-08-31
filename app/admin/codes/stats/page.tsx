import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { getCodeBatchStats } from "../actions";
import { BatchCard } from "./batch-card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AdminCodesStatsPage() {
  // Esta página llama directo a una acción que usa el cliente service_role
  // (getCodeBatchStats). Next puede empezar a renderizar esta página en
  // paralelo con el layout, así que no alcanza con el guard del layout: hay
  // que repetirlo acá para no depender de en qué orden gana la carrera.
  await requireAdminOrRedirect();
  const batches = await getCodeBatchStats();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">Estadísticas de códigos</h1>

      <div className="flex flex-col gap-3">
        {batches.map((batch) => (
          <BatchCard key={batch.batch_label} batch={batch} />
        ))}
        {batches.length === 0 && (
          <EmptyState icon="🎟️" message="Todavía no se generó ningún lote de códigos." compact />
        )}
      </div>
    </div>
  );
}
