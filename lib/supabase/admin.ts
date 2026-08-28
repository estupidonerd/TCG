import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con la service_role key: bypassea RLS por completo. SOLO se debe
// importar desde código que corre en el servidor (Server Actions, Route
// Handlers, Server Components) y que YA verificó is_admin con
// requireAdmin()/getAdminContext() de lib/admin/require-admin.ts.
//
// "server-only" hace que el build falle si este archivo termina importado,
// directa o indirectamente, desde un Client Component -- es la red de
// seguridad para que SUPABASE_SERVICE_ROLE_KEY nunca llegue al bundle del
// navegador.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
