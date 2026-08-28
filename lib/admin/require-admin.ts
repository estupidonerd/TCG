import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type AdminContext = {
  user: User;
};

// Para usar en app/admin/layout.tsx: si no hay sesión, manda a /login; si
// hay sesión pero no es admin, manda al home. No lanza error porque en un
// Server Component el flujo esperado es redirigir, no romper el render.
export async function requireAdminOrRedirect(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  return { user };
}

// Para usar al principio de TODO Server Action del panel /admin. Un Server
// Action es un endpoint propio: que la página que lo llama esté detrás de
// app/admin/layout.tsx NO alcanza para protegerlo, porque se puede invocar
// directo. Por eso cada acción tiene que repetir esta verificación.
export async function requireAdmin(): Promise<AdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autorizado: sesión requerida.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error("No autorizado: se requiere acceso de administrador.");
  }

  return { user };
}
