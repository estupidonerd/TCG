"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/providers/user-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { TradeDefault } from "@/lib/supabase/types";

const MASS_ACTION_MESSAGE: Record<"public" | "private", string> = {
  public:
    "Esto va a marcar TODAS tus cartas repetidas como disponibles para intercambio (siempre te queda al menos 1 copia privada de cada una). ¿Confirmas?",
  private:
    "Esto va a marcar TODAS tus cartas como privadas: nadie va a poder pedírtelas hasta que las vuelvas a habilitar a mano. ¿Confirmas?",
};

// Popup simple (sin llevar a otra página) con la preferencia de intercambio
// por defecto y las acciones masivas sobre toda la colección. Vivía en
// /ajustes; se movió acá para reservar esa ruta a futuros ajustes
// generales del juego.
export function TradeSettingsModal({
  initialTradeDefault,
  onClose,
}: {
  initialTradeDefault: TradeDefault;
  onClose: () => void;
}) {
  const { user } = useUser();
  const [tradeDefault, setTradeDefault] = useState(initialTradeDefault);
  const [savingDefault, setSavingDefault] = useState(false);
  const [massAction, setMassAction] = useState<"public" | "private" | null>(null);
  const [massMessage, setMassMessage] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<"public" | "private" | null>(null);

  const handleDefaultChange = async (value: TradeDefault) => {
    if (!user) return;
    const previous = tradeDefault;
    setTradeDefault(value);
    setSavingDefault(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ trade_default: value })
      .eq("id", user.id);
    setSavingDefault(false);
    if (error) setTradeDefault(previous);
  };

  const runMassAction = async () => {
    const kind = confirmKind;
    setConfirmKind(null);
    if (!kind) return;

    setMassAction(kind);
    setMassMessage(null);
    const supabase = createClient();
    const { error } = await supabase.rpc(
      kind === "public" ? "set_all_cards_public" : "set_all_cards_private",
    );
    setMassAction(null);
    setMassMessage(
      error
        ? "No se pudo aplicar el cambio."
        : kind === "public"
          ? "Listo: todas tus cartas repetidas quedaron disponibles para intercambio."
          : "Listo: todas tus cartas quedaron privadas.",
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 33, 0.5)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Preferencia de intercambio"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-6 overflow-y-auto rounded-2xl bg-marca-claro p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl">Preferencia de intercambio</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-marca-noche/20 text-sm font-semibold text-marca-noche/60 hover:text-marca-noche"
          >
            ✕
          </button>
        </div>

        <section className="flex flex-col gap-3 rounded-xl border border-marca-noche/10 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-marca-noche/60">
            Cartas repetidas nuevas
          </h3>
          <p className="text-sm text-marca-noche/60">
            Qué pasa por defecto con tus cartas repetidas nuevas (de un sobre o de un intercambio):
            si quedan disponibles para que otros te las pidan, o privadas hasta que las habilites tú
            a mano.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label
              className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                tradeDefault === "publicas"
                  ? "border-marca-violeta bg-marca-violeta/5 text-marca-violeta"
                  : "border-marca-noche/20 text-marca-noche"
              }`}
            >
              <input
                type="radio"
                name="trade_default"
                value="publicas"
                checked={tradeDefault === "publicas"}
                onChange={() => handleDefaultChange("publicas")}
                disabled={savingDefault}
                className="accent-marca-violeta"
              />
              Públicas por defecto
            </label>
            <label
              className={`flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                tradeDefault === "privadas"
                  ? "border-marca-violeta bg-marca-violeta/5 text-marca-violeta"
                  : "border-marca-noche/20 text-marca-noche"
              }`}
            >
              <input
                type="radio"
                name="trade_default"
                value="privadas"
                checked={tradeDefault === "privadas"}
                onChange={() => handleDefaultChange("privadas")}
                disabled={savingDefault}
                className="accent-marca-violeta"
              />
              Privadas por defecto
            </label>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-marca-noche/10 bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-marca-noche/60">
            Acción sobre toda tu colección
          </h3>
          <p className="text-sm text-marca-noche/60">
            Esto cambia de una sola vez todas las cartas que ya tienes (no afecta la preferencia por
            defecto de arriba, que solo aplica a cartas nuevas).
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setConfirmKind("public")}
              disabled={massAction !== null}
              className="flex-1 touch-manipulation rounded-lg bg-marca-violeta px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {massAction === "public" ? "Aplicando…" : "Marcar todo público"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmKind("private")}
              disabled={massAction !== null}
              className="flex-1 touch-manipulation rounded-lg border border-marca-noche/20 px-4 py-2.5 text-sm font-semibold text-marca-noche disabled:cursor-not-allowed disabled:opacity-50"
            >
              {massAction === "private" ? "Aplicando…" : "Marcar todo privado"}
            </button>
          </div>

          {massMessage && <p className="text-sm text-marca-noche/70">{massMessage}</p>}
        </section>
      </div>

      {confirmKind && (
        <ConfirmDialog
          message={MASS_ACTION_MESSAGE[confirmKind]}
          confirmLabel="Confirmar"
          onConfirm={runMassAction}
          onCancel={() => setConfirmKind(null)}
        />
      )}
    </div>
  );
}
