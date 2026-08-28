import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente de Supabase para usar en Server Components, Route Handlers y
// Server Actions. Lee/escribe la sesión a través de las cookies de Next.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se puede ignorar: pasa cuando setAll() se llama desde un
            // Server Component (no puede escribir cookies). El middleware
            // ya se encarga de refrescar la sesión en cada request.
          }
        },
      },
    },
  );
}
