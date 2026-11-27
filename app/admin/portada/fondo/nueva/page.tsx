import { requireAdminOrRedirect } from "@/lib/admin/require-admin";
import { SplashForm } from "../splash-form";

export const metadata = { title: "Nueva portada" };

export default async function NuevaPortadaPage() {
  await requireAdminOrRedirect();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl">Nueva portada</h2>
      <SplashForm />
    </div>
  );
}
