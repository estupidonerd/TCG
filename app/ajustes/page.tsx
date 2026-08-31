import { createClient } from "@/lib/supabase/server";
import { BlockedUsersSection } from "./blocked-users-section";
import type { PublicProfile } from "@/lib/supabase/types";

export default async function AjustesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: blocks } = await supabase
    .from("blocked_users")
    .select("blocked_id, created_at")
    .eq("blocker_id", user!.id)
    .order("created_at", { ascending: false });

  const blockedIds = ((blocks as { blocked_id: string }[] | null) ?? []).map((b) => b.blocked_id);

  let profilesById = new Map<string, PublicProfile>();
  if (blockedIds.length > 0) {
    const { data: profiles } = await supabase.rpc("get_public_profiles", {
      p_user_ids: blockedIds,
    });
    profilesById = new Map(((profiles as PublicProfile[] | null) ?? []).map((p) => [p.id, p]));
  }

  const blockedUsers = ((blocks as { blocked_id: string }[] | null) ?? []).map((b) => ({
    blockedId: b.blocked_id,
    profile: profilesById.get(b.blocked_id) ?? null,
  }));

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-3xl sm:text-4xl">Ajustes</h1>
      <BlockedUsersSection initialBlockedUsers={blockedUsers} />
    </main>
  );
}
