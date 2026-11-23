"use client";

import { useState, useTransition } from "react";
import { ErrorMessage } from "@/components/admin/submit-button";
import { moveTestClock, type TestClockStep } from "./test-clock-actions";

// El juego cuenta sus días en hora de Madrid (ver lib/config/vote.ts), así que
// las dos horas se muestran en esa zona, independiente del navegador.
const formatter = new Intl.DateTimeFormat("es-CO", {
  timeZone: "Europe/Madrid",
  dateStyle: "full",
  timeStyle: "medium",
});

function describeOffset(minutes: number): string {
  if (minutes === 0) return "sin desplazamiento";
  const sign = minutes > 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins = abs % 60;
  const parts = [days ? `${days} d` : "", hours ? `${hours} h` : "", mins ? `${mins} min` : ""];
  return `${sign}${parts.filter(Boolean).join(" ")}`;
}

const buttonClass =
  "touch-manipulation rounded bg-marca-rojo px-4 py-2 text-sm font-semibold text-marca-claro transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "touch-manipulation rounded border border-marca-noche/30 bg-white px-4 py-2 text-sm font-semibold text-marca-noche transition-colors hover:bg-marca-noche/5 disabled:cursor-not-allowed disabled:opacity-60";

export function TestClockPanel({
  allowed,
  offsetMinutes,
  realNowIso,
  simulatedNowIso,
}: {
  allowed: boolean;
  offsetMinutes: number;
  realNowIso: string;
  simulatedNowIso: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (step: TestClockStep) => {
    setError(null);
    startTransition(async () => {
      try {
        await moveTestClock(step);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.");
      }
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl">Reloj de pruebas</h2>

      <p className="text-sm text-marca-noche/70">
        Solo existe en el entorno de pruebas. Mueve la hora de las funciones que usan{" "}
        <code>game_now()</code>; las que todavía usan <code>now()</code> no se ven afectadas.
      </p>

      {!allowed && (
        <p className="rounded border border-marca-violeta/40 bg-marca-violeta/10 px-3 py-2 text-sm text-marca-violeta">
          El reloj está desactivado en este proyecto (<code>allow_test_clock</code> es false). Para
          activarlo, corre en el SQL Editor de Pruebas:{" "}
          <code>update public.game_settings set allow_test_clock = true where id = true;</code>
        </p>
      )}

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-marca-noche/10 p-4">
          <dt className="text-xs font-bold uppercase tracking-wide text-marca-noche/70">
            Hora simulada (Madrid)
          </dt>
          <dd className="mt-1 text-sm text-marca-noche">
            {formatter.format(new Date(simulatedNowIso))}
          </dd>
          <dd className="mt-1 text-xs text-marca-noche/60">{describeOffset(offsetMinutes)}</dd>
        </div>
        <div className="rounded-lg border border-marca-noche/10 p-4">
          <dt className="text-xs font-bold uppercase tracking-wide text-marca-noche/70">
            Hora real (Madrid)
          </dt>
          <dd className="mt-1 text-sm text-marca-noche">
            {formatter.format(new Date(realNowIso))}
          </dd>
        </div>
      </dl>

      <ErrorMessage message={error} />

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || !allowed} onClick={() => run("day")} className={buttonClass}>
          Avanzar 1 día
        </button>
        <button type="button" disabled={pending || !allowed} onClick={() => run("week")} className={buttonClass}>
          Avanzar 7 días
        </button>
        <button type="button" disabled={pending || !allowed} onClick={() => run("month")} className={buttonClass}>
          Avanzar 1 mes
        </button>
        <button
          type="button"
          disabled={pending || !allowed}
          onClick={() => run("reset")}
          className={secondaryButtonClass}
        >
          Volver a la hora real
        </button>
      </div>
    </section>
  );
}
