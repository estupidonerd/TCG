import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export default async function BaneadoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("banned_until")
    .eq("id", user.id)
    .single();

  const bannedUntil = profile?.banned_until ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isBanned = bannedUntil !== null && todayStr < bannedUntil;

  // Si alguien llega acá sin estar baneado (por ejemplo, el baneo ya
  // venció), no tiene sentido mostrarle esta pantalla.
  if (!isBanned) redirect("/coleccion");

  const formattedDate = new Date(`${bannedUntil}T00:00:00Z`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-marca-noche px-6 py-12 text-center text-white">
      <h1 className="text-4xl sm:text-5xl">Cuenta inhabilitada</h1>
      <p className="max-w-md text-sm font-light text-white/70">
        Tu cuenta está temporalmente inhabilitada hasta el {formattedDate}. Mientras tanto no
        puedes usar la aplicación.
      </p>
      <LogoutButton />
    </main>
  );
}
