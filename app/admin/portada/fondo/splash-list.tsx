"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ErrorMessage } from "@/components/admin/submit-button";
import type { SplashStatus } from "@/lib/splash/pick";
import type { SplashTheme } from "@/lib/splash/types";
import { formatColombiaDay } from "@/lib/utils/colombia-time";
import { deleteSplash, duplicateSplash, setSplashActive } from "./actions";

export type SplashListItem = { theme: SplashTheme; status: SplashStatus };

const STATUS_LABELS: Record<SplashStatus, { label: string; className: string }> = {
  showing: { label: "Se muestra ahora", className: "bg-marca-violeta text-white" },
  waiting: { label: "Activa, pero gana otra", className: "bg-marca-amarillo/30 text-marca-noche" },
  scheduled: { label: "Programada", className: "bg-marca-amarillo/30 text-marca-noche" },
  expired: { label: "Vencida", className: "bg-marca-noche/10 text-marca-noche" },
  inactive: { label: "Inactiva", className: "bg-marca-noche/10 text-marca-noche" },
};

const smallButton =
  "touch-manipulation rounded border border-marca-noche/30 bg-white px-3 py-1.5 text-sm font-semibold text-marca-noche transition-colors hover:bg-marca-noche/5 disabled:cursor-not-allowed disabled:opacity-60";

function SplashRow({ item, onError }: { item: SplashListItem; onError: (message: string | null) => void }) {
  const { theme, status } = item;
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (action: () => Promise<unknown>) => {
    onError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        onError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  const badge = STATUS_LABELS[status];
  const dates =
    theme.starts_at || theme.ends_at
      ? `${theme.starts_at ? `Desde ${formatColombiaDay(theme.starts_at)}` : "Sin inicio"} · ${
          theme.ends_at ? `hasta ${formatColombiaDay(theme.ends_at)}` : "sin fin"
        } (hora de Colombia)`
      : "Sin fechas";

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-marca-noche/10 bg-white p-4 sm:flex-row sm:items-center">
      <div className="h-24 w-full shrink-0 overflow-hidden rounded-lg bg-marca-noche sm:w-40">
        {theme.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura de una imagen ya optimizada
          <img
            src={theme.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            style={{ objectPosition: `${theme.focus_x}% ${theme.focus_y}%` }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-white/60">Sin imagen</div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold text-marca-noche">{theme.name}</p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badge.className}`}>{badge.label}</span>
        </div>
        <p className="text-xs text-marca-noche/60">{dates}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={theme.is_active}
            aria-label={`Activa: ${theme.name}`}
            disabled={pending}
            onClick={() => run(() => setSplashActive(theme.id, !theme.is_active))}
            className={`relative h-7 w-12 shrink-0 touch-manipulation rounded-full transition-colors disabled:opacity-60 ${
              theme.is_active ? "bg-marca-violeta" : "bg-marca-noche/25"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                theme.is_active ? "left-[1.375rem]" : "left-0.5"
              }`}
            />
          </button>
          <span className="mr-2 text-sm text-marca-noche">{theme.is_active ? "Activa" : "Inactiva"}</span>

          <Link href={`/admin/portada/fondo/${theme.id}`} className={smallButton}>
            Editar
          </Link>
          <button type="button" disabled={pending} onClick={() => run(() => duplicateSplash(theme.id))} className={smallButton}>
            Duplicar
          </button>
          {!confirming && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(true)}
              className={`${smallButton} border-marca-rojo text-marca-rojo hover:bg-marca-rojo/10`}
            >
              Eliminar
            </button>
          )}
        </div>

        {confirming && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-marca-rojo/40 bg-marca-rojo/5 p-3">
            <p className="text-sm font-semibold text-marca-noche">
              ¿Eliminar «{theme.name}»? También se borra su imagen y no se puede deshacer.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteSplash(theme.id))}
                className="touch-manipulation rounded bg-marca-rojo px-3 py-1.5 text-sm font-semibold text-marca-claro transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Eliminando…" : "Sí, eliminar"}
              </button>
              <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={smallButton}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export function SplashList({ items }: { items: SplashListItem[] }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <ErrorMessage message={error} />
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-marca-noche/20 bg-white p-6 text-center text-sm text-marca-noche/70">
          Todavía no hay portadas. Sin ninguna activa, la pantalla de entrada se ve como siempre.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <SplashRow key={item.theme.id} item={item} onError={setError} />
          ))}
        </ul>
      )}
    </div>
  );
}
