import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { getCodeBatchStats } from "../actions";
import { BatchCard } from "./batch-card";

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
          <p className="py-6 text-center text-sm text-marca-noche/50">
            Todavía no se generó ningún lote de códigos.
          </p>
        )}
      </div>
    </div>
  );
}
