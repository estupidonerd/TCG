import { notFound } from "next/navigation";
import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatKb, weightWarning, type SplashTheme } from "@/lib/splash/types";
import { SplashForm } from "../splash-form";

export const metadata = { title: "Editar portada" };

export default async function EditarPortadaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardada?: string; peso?: string }>;
}) {
  await requireAdminOrRedirect();
  const { id } = await params;
  const { guardada, peso } = await searchParams;

  const admin = createAdminClient();
  const { data } = await admin.from("splash_themes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  // Peso de la imagen recién subida (lo manda la acción al redirigir): se
  // muestra y se avisa si pasa de lo recomendado.
  const bytes = Number(peso);
  const hasWeight = Number.isFinite(bytes) && bytes > 0;
  const warning = hasWeight ? weightWarning(bytes) : null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl">Editar portada</h2>

      {guardada && (
        <div className="flex flex-col gap-2">
          <p
            role="status"
            className="rounded border border-marca-violeta/40 bg-marca-violeta/10 px-3 py-2 text-sm text-marca-violeta"
          >
            Guardado.{hasWeight ? ` La imagen pesa ${formatKb(bytes)}.` : ""} Los cambios se ven de inmediato en
            la pantalla de entrada.
          </p>
          {warning && (
            <p
              role="status"
              className="rounded border border-marca-amarillo bg-marca-amarillo/20 px-3 py-2 text-sm text-marca-noche"
            >
              {warning}
            </p>
          )}
        </div>
      )}

      {/* La key hace que, al guardar y volver, el formulario se arme otra vez con lo guardado. */}
      <SplashForm key={`${id}-${(data as SplashTheme).updated_at}`} initial={data as SplashTheme} />
    </div>
  );
}
