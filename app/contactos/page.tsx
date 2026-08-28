import { createClient } from "@/lib/supabase/server";
import { ContactsView } from "./contacts-view";
import type { Contact, PublicProfile } from "@/lib/supabase/types";

export type ContactWithProfile = Contact & { profile: PublicProfile | null };

export default async function ContactosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, user_id, contact_user_id, nickname, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const typedContacts = (contacts as Contact[] | null) ?? [];
  const contactUserIds = typedContacts.map((c) => c.contact_user_id);

  let profilesById = new Map<string, PublicProfile>();
  if (contactUserIds.length > 0) {
    const { data: profiles } = await supabase.rpc("get_public_profiles", {
      p_user_ids: contactUserIds,
    });
    profilesById = new Map(
      ((profiles as PublicProfile[] | null) ?? []).map((p) => [p.id, p]),
    );
  }

  const contactsWithProfile: ContactWithProfile[] = typedContacts.map((contact) => ({
    ...contact,
    profile: profilesById.get(contact.contact_user_id) ?? null,
  }));

  return (
    <main className="min-h-svh px-4 py-8 sm:px-6">
      <ContactsView contacts={contactsWithProfile} />
    </main>
  );
}
