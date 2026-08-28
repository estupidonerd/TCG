import type { PublicProfile } from "@/lib/supabase/types";

// display_name suele venir vacío (no todos los perfiles lo cargan), así
// que se cae a player_code -- siempre existe y es único -- antes que al
// genérico "Jugador". Usado en cualquier lugar que muestre el perfil
// público de otro jugador (intercambios, contactos).
export function profileLabel(profile: PublicProfile | null | undefined): string {
  return profile?.display_name || profile?.player_code || "Jugador";
}
