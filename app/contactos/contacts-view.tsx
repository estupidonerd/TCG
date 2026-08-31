"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/providers/user-provider";
import { BlockUserButton } from "@/components/trades/block-user-button";
import { EmptyState } from "@/components/ui/empty-state";
import { profileLabel } from "@/lib/utils/profile-label";
import type { ContactWithProfile } from "./page";

export function ContactsView({ contacts: initialContacts }: { contacts: ContactWithProfile[] }) {
  const { user } = useUser();
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [query, setQuery] = useState("");
  const [showAddByCode, setShowAddByCode] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const label = (c.nickname || profileLabel(c.profile)).toLowerCase();
      return label.includes(q);
    });
  }, [contacts, query]);

  const handleRemove = async (contactId: string) => {
    setRemovingId(contactId);
    const supabase = createClient();
    const { error } = await supabase.from("contacts").delete().eq("id", contactId);
    setRemovingId(null);
    if (!error) {
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    }
  };

  const handleRename = async (contactId: string, nickname: string) => {
    const supabase = createClient();
    const clean = nickname.trim() || null;
    const { error } = await supabase.from("contacts").update({ nickname: clean }).eq("id", contactId);
    if (!error) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, nickname: clean } : c)),
      );
      setEditingId(null);
    }
    return !error;
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl">Amigos</h1>
        <button
          type="button"
          onClick={() => setShowAddByCode((v) => !v)}
          className="touch-manipulation rounded-xl bg-marca-rojo px-4 py-2.5 text-sm font-bold text-marca-claro transition-opacity hover:opacity-90"
        >
          Agregar por código
        </button>
      </div>

      {showAddByCode && (
        <AddByCodeForm
          onAdded={(contact) => {
            setContacts((prev) => [contact, ...prev]);
            setShowAddByCode(false);
          }}
          onClose={() => setShowAddByCode(false)}
        />
      )}

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por apodo…"
        className="w-full rounded-xl border border-marca-noche/20 bg-white px-4 py-3 text-sm focus:border-marca-violeta focus:outline-none"
      />

      {filtered.length === 0 && (
        <EmptyState
          icon="👥"
          message={
            contacts.length === 0
              ? "Todavía no agregaste ningún amigo."
              : "No hay amigos que coincidan con la búsqueda."
          }
        />
      )}

      <ul className="flex flex-col gap-3">
        {filtered.map((contact) => {
          const label = contact.nickname || profileLabel(contact.profile);
          const initial = label.charAt(0).toUpperCase();
          const isEditing = editingId === contact.id;

          return (
            <li
              key={contact.id}
              className="flex flex-col gap-3 rounded-xl border border-marca-noche/10 bg-white p-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-marca-violeta text-sm font-bold text-white">
                  {contact.profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar remoto (Google), sin necesidad de next/image
                    <img
                      src={contact.profile.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span aria-hidden="true">{initial}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <NicknameEditor
                      initialValue={contact.nickname ?? ""}
                      placeholder={profileLabel(contact.profile)}
                      onCancel={() => setEditingId(null)}
                      onSave={(value) => handleRename(contact.id, value)}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-marca-noche">{label}</p>
                      <button
                        type="button"
                        onClick={() => setEditingId(contact.id)}
                        aria-label={`Editar apodo de ${label}`}
                        className="shrink-0 touch-manipulation text-xs font-semibold text-marca-violeta"
                      >
                        Editar
                      </button>
                    </div>
                  )}
                  {contact.profile?.player_code && !isEditing && (
                    <p className="truncate font-mono text-xs text-marca-noche/50">
                      {contact.profile.player_code}
                    </p>
                  )}
                </div>
              </div>

              {!isEditing && (
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => router.push(`/intercambios/nuevo?con=${contact.contact_user_id}`)}
                    className="flex-1 touch-manipulation rounded-full bg-marca-rojo px-3 py-2.5 text-xs font-bold text-marca-claro transition-opacity hover:opacity-90 sm:flex-none"
                  >
                    Ofrecer intercambio
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemove(contact.id)}
                    disabled={removingId === contact.id}
                    aria-label={`Quitar a ${label} de tus amigos`}
                    className="shrink-0 touch-manipulation rounded-full border border-marca-noche/20 px-3 py-2.5 text-xs font-semibold text-marca-noche/60 hover:border-marca-rojo hover:text-marca-rojo disabled:opacity-50"
                  >
                    Quitar
                  </button>

                  {contact.profile && (
                    <BlockUserButton
                      profile={contact.profile}
                      onBlocked={() =>
                        setContacts((prev) => prev.filter((c) => c.id !== contact.id))
                      }
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {user && (
        <p className="text-center text-xs text-marca-noche/40">
          También puedes agregar amigos directo desde tus intercambios.
        </p>
      )}
    </div>
  );
}

function NicknameEditor({
  initialValue,
  placeholder,
  onCancel,
  onSave,
}: {
  initialValue: string;
  placeholder: string;
  onCancel: () => void;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(value);
    setSaving(false);
    if (!ok) {
      // El caller no cierra el modo edición en caso de error, así que se
      // puede reintentar sin perder lo escrito.
      return;
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        autoFocus
        className="min-w-0 flex-1 rounded border border-marca-violeta px-2 py-1 text-sm focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="shrink-0 touch-manipulation text-xs font-bold text-marca-violeta disabled:opacity-50"
      >
        Guardar
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 touch-manipulation text-xs font-semibold text-marca-noche/50"
      >
        Cancelar
      </button>
    </div>
  );
}

function AddByCodeForm({
  onAdded,
  onClose,
}: {
  onAdded: (contact: ContactWithProfile) => void;
  onClose: () => void;
}) {
  const { user } = useUser();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!user) return;
    const clean = code.trim().toUpperCase();
    if (clean.length !== 8) {
      setError("El código tiene 8 caracteres.");
      return;
    }

    setPending(true);
    setError(null);
    const supabase = createClient();

    const { data: profiles, error: lookupError } = await supabase.rpc("find_profile_by_code", {
      p_code: clean,
    });

    if (lookupError || !profiles || profiles.length === 0) {
      setPending(false);
      setError("No se encontró ningún jugador con ese código.");
      return;
    }

    const profile = profiles[0];

    if (profile.id === user.id) {
      setPending(false);
      setError("Ese es tu propio código.");
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("contacts")
      .insert({ user_id: user.id, contact_user_id: profile.id, nickname: nickname.trim() || null })
      .select("id, user_id, contact_user_id, nickname, created_at")
      .single();

    setPending(false);

    if (insertError || !inserted) {
      setError(
        insertError?.code === "23505"
          ? "Ya tienes a ese jugador en tus amigos."
          : "No se pudo agregar el amigo.",
      );
      return;
    }

    onAdded({ ...inserted, profile });
    setCode("");
    setNickname("");
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-marca-noche/10 bg-white p-4">
      {error && (
        <p className="rounded border border-marca-rojo/40 bg-marca-rojo/10 px-3 py-2 text-sm text-marca-rojo">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Código de 8 caracteres"
          maxLength={8}
          className="flex-1 rounded-lg border border-marca-noche/20 px-3 py-2.5 font-mono text-sm uppercase tracking-wider focus:border-marca-violeta focus:outline-none"
        />
        <input
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Apodo (opcional)"
          className="flex-1 rounded-lg border border-marca-noche/20 px-3 py-2.5 text-sm focus:border-marca-violeta focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || code.trim().length !== 8}
          className="flex-1 touch-manipulation rounded-lg bg-marca-rojo px-4 py-2.5 text-sm font-bold text-marca-claro transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Buscando…" : "Agregar"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="touch-manipulation rounded-lg border border-marca-noche/20 px-4 py-2.5 text-sm font-semibold text-marca-noche"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
