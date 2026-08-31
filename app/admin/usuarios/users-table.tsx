"use client";

import { useMemo, useState } from "react";
import { banPlayer, unbanPlayer } from "./actions";
import { EmptyState } from "@/components/ui/empty-state";

export type AdminPlayer = {
  id: string;
  display_name: string | null;
  player_code: string;
  avatar_url: string | null;
  is_admin: boolean;
  banned_until: string | null;
  created_at: string;
};

function isCurrentlyBanned(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false;
  const todayStr = new Date().toISOString().slice(0, 10);
  return todayStr < bannedUntil;
}

function formatBannedUntil(bannedUntil: string): string {
  return new Date(`${bannedUntil}T00:00:00Z`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function UsersTable({ players: initialPlayers }: { players: AdminPlayer[] }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [query, setQuery] = useState("");
  const [banningId, setBanningId] = useState<string | null>(null);
  const [daysInput, setDaysInput] = useState("7");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => {
      const name = (p.display_name ?? "").toLowerCase();
      const code = p.player_code.toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [players, query]);

  const handleBan = async (playerId: string) => {
    const days = Number(daysInput);
    if (!Number.isInteger(days) || days < 1) {
      setErrorById((prev) => ({ ...prev, [playerId]: "Ingresa un número de días válido." }));
      return;
    }
    setPendingId(playerId);
    setErrorById((prev) => ({ ...prev, [playerId]: "" }));
    try {
      const bannedUntil = await banPlayer(playerId, days);
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, banned_until: bannedUntil } : p)),
      );
      setBanningId(null);
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [playerId]: err instanceof Error ? err.message : "No se pudo banear.",
      }));
    } finally {
      setPendingId(null);
    }
  };

  const handleUnban = async (playerId: string) => {
    setPendingId(playerId);
    setErrorById((prev) => ({ ...prev, [playerId]: "" }));
    try {
      await unbanPlayer(playerId);
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, banned_until: null } : p)),
      );
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [playerId]: err instanceof Error ? err.message : "No se pudo quitar el baneo.",
      }));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nombre o código de jugador…"
        className="w-full rounded border border-marca-noche/20 bg-white px-4 py-2.5 text-sm focus:border-marca-violeta focus:outline-none"
      />

      <div className="flex flex-col gap-2">
        {filtered.map((player) => {
          const banned = isCurrentlyBanned(player.banned_until);
          const label = player.display_name || player.player_code;

          return (
            <div
              key={player.id}
              className="flex flex-col gap-2 rounded-lg border border-marca-noche/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-marca-violeta text-sm font-bold text-white">
                  {player.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar remoto (Google), sin necesidad de next/image
                    <img
                      src={player.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span aria-hidden="true">{label.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-marca-noche">
                    <span className="truncate">{label}</span>
                    {player.is_admin && (
                      <span className="shrink-0 rounded-full bg-marca-violeta/10 px-2 py-0.5 text-[10px] font-bold uppercase text-marca-violeta">
                        Admin
                      </span>
                    )}
                  </p>
                  <p className="truncate font-mono text-xs text-marca-noche/50">
                    {player.player_code}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {banned && (
                  <span className="rounded-full border border-marca-rojo/40 bg-marca-rojo/10 px-2 py-1 text-xs font-bold text-marca-rojo">
                    Baneado hasta {formatBannedUntil(player.banned_until!)}
                  </span>
                )}

                {banned ? (
                  <button
                    type="button"
                    onClick={() => handleUnban(player.id)}
                    disabled={pendingId === player.id}
                    className="touch-manipulation rounded-full border border-marca-noche/20 px-3 py-1.5 text-xs font-semibold text-marca-noche hover:border-marca-violeta hover:text-marca-violeta disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingId === player.id ? "Quitando…" : "Quitar baneo"}
                  </button>
                ) : banningId === player.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={daysInput}
                      onChange={(event) => setDaysInput(event.target.value)}
                      className="w-16 rounded border border-marca-noche/20 px-2 py-1.5 text-xs focus:border-marca-violeta focus:outline-none"
                    />
                    <span className="text-xs text-marca-noche/50">días</span>
                    <button
                      type="button"
                      onClick={() => handleBan(player.id)}
                      disabled={pendingId === player.id}
                      className="touch-manipulation rounded-full bg-marca-rojo px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pendingId === player.id ? "…" : "Confirmar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBanningId(null)}
                      className="touch-manipulation text-xs font-semibold text-marca-noche/50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setBanningId(player.id);
                      setDaysInput("7");
                    }}
                    className="touch-manipulation rounded-full border border-marca-rojo/40 px-3 py-1.5 text-xs font-semibold text-marca-rojo transition-colors hover:bg-marca-rojo hover:text-white"
                  >
                    Banear
                  </button>
                )}
              </div>

              {errorById[player.id] && (
                <p className="w-full text-xs font-semibold text-marca-rojo">
                  {errorById[player.id]}
                </p>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <EmptyState icon="🔍" message="No hay jugadores que coincidan con la búsqueda." compact />
        )}
      </div>
    </div>
  );
}
