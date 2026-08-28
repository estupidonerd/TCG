"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CardPickerGrid, type PickableCard } from "@/components/trades/card-picker-grid";
import { profileLabel } from "@/lib/utils/profile-label";
import type { PublicProfile } from "@/lib/supabase/types";
import type { ContactWithProfile } from "@/app/contactos/page";

type MyCard = PickableCard & { owned: number; committed: number };

type Step = "recipient" | "offer" | "request" | "review";

function toItemArray(selection: Map<string, number>) {
  return Array.from(selection.entries())
    .filter(([, qty]) => qty > 0)
    .map(([card_id, quantity]) => ({ card_id, quantity }));
}

export function TradeWizard({
  contacts,
  myCards,
  catalog,
  preselectedProfile,
}: {
  contacts: ContactWithProfile[];
  myCards: MyCard[];
  catalog: PickableCard[];
  preselectedProfile: PublicProfile | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(preselectedProfile ? "offer" : "recipient");
  const [recipient, setRecipient] = useState<PublicProfile | null>(preselectedProfile);
  const [offerSelection, setOfferSelection] = useState<Map<string, number>>(new Map());
  const [requestSelection, setRequestSelection] = useState<Map<string, number>>(new Map());
  const [message, setMessage] = useState("");

  // Cuánto de cada carta el OTRO jugador marcó como disponible para
  // intercambio (public_quantity, no su cantidad total) -- lo que no
  // aparece acá no se puede pedir.
  const [theirAvailable, setTheirAvailable] = useState<Map<string, number>>(new Map());
  const [theirCardsLoading, setTheirCardsLoading] = useState(false);

  const [codeQuery, setCodeQuery] = useState("");
  const [codeSearching, setCodeSearching] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeResult, setCodeResult] = useState<PublicProfile | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);
  const myCardsById = useMemo(() => new Map(myCards.map((c) => [c.id, c])), [myCards]);

  useEffect(() => {
    if (!recipient) return;
    let cancelled = false;
    setTheirCardsLoading(true);
    const supabase = createClient();
    supabase
      .from("user_cards")
      .select("card_id, public_quantity")
      .eq("user_id", recipient.id)
      .gt("public_quantity", 0)
      .then(({ data }) => {
        if (cancelled) return;
        setTheirAvailable(
          new Map(
            ((data as { card_id: string; public_quantity: number }[] | null) ?? []).map((r) => [
              r.card_id,
              r.public_quantity,
            ]),
          ),
        );
        setTheirCardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recipient]);

  const myOfferMax = useMemo(() => {
    const map: Record<string, number> = {};
    for (const card of myCards) {
      // -1: siempre te queda al menos 1 copia propia, nunca podés ofrecer
      // la totalidad de lo que tenés.
      map[card.id] = Math.max(0, card.owned - 1 - card.committed);
    }
    return map;
  }, [myCards]);

  // Cartas con las que no hay nada para ofrecer (solo 1 copia, o todas ya
  // comprometidas en otras ofertas pendientes) ni siquiera se muestran acá.
  const offerableCards = useMemo(
    () => myCards.filter((card) => (myOfferMax[card.id] ?? 0) > 0),
    [myCards, myOfferMax],
  );

  const theirRequestCards: PickableCard[] = useMemo(() => {
    return Array.from(theirAvailable.keys())
      .map((id) => catalogById.get(id))
      .filter((c): c is PickableCard => Boolean(c));
  }, [theirAvailable, catalogById]);

  const theirRequestMax = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [cardId, qty] of theirAvailable) map[cardId] = qty;
    return map;
  }, [theirAvailable]);

  const handleSelectContact = (contact: ContactWithProfile) => {
    if (!contact.profile) return;
    setRecipient(contact.profile);
    setStep("offer");
  };

  const handleCodeSearch = async () => {
    const clean = codeQuery.trim().toUpperCase();
    if (clean.length !== 8) {
      setCodeError("El código tiene 8 caracteres.");
      return;
    }
    setCodeSearching(true);
    setCodeError(null);
    setCodeResult(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("find_profile_by_code", { p_code: clean });
    setCodeSearching(false);
    if (error || !data || data.length === 0) {
      setCodeError("No se encontró ningún jugador con ese código.");
      return;
    }
    setCodeResult(data[0]);
  };

  const handleSubmit = async () => {
    if (!recipient) return;
    setSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_trade", {
      p_receiver_id: recipient.id,
      p_message: message.trim() || null,
      p_offer: toItemArray(offerSelection),
      p_request: toItemArray(requestSelection),
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    router.push("/intercambios");
  };

  const offerCount = Array.from(offerSelection.values()).filter((q) => q > 0).length;
  const requestCount = Array.from(requestSelection.values()).filter((q) => q > 0).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-24">
      <h1 className="text-3xl sm:text-4xl">Nuevo intercambio</h1>

      <StepIndicator step={step} />

      {step === "recipient" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">¿Con quién querés intercambiar?</h2>

          {contacts.length > 0 && (
            <ul className="flex flex-col gap-2">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectContact(contact)}
                    disabled={!contact.profile}
                    className="flex w-full touch-manipulation items-center gap-3 rounded-xl border border-marca-noche/10 bg-white p-3 text-left disabled:opacity-40"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca-violeta text-sm font-bold text-white">
                      {(contact.nickname || profileLabel(contact.profile)).charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-marca-noche">
                      {contact.nickname || profileLabel(contact.profile)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-marca-noche/10 bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-marca-noche">
              Buscar por código de jugador
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={codeQuery}
                onChange={(event) => setCodeQuery(event.target.value.toUpperCase())}
                placeholder="Código de 8 caracteres"
                maxLength={8}
                className="flex-1 rounded-lg border border-marca-noche/20 px-3 py-2.5 font-mono text-sm uppercase tracking-wider focus:border-marca-violeta focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCodeSearch}
                disabled={codeSearching || codeQuery.trim().length !== 8}
                className="touch-manipulation rounded-lg bg-marca-violeta px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {codeSearching ? "…" : "Buscar"}
              </button>
            </div>
            {codeError && <p className="mt-2 text-xs font-semibold text-marca-rojo">{codeError}</p>}
            {codeResult && (
              <button
                type="button"
                onClick={() => {
                  setRecipient(codeResult);
                  setStep("offer");
                }}
                className="mt-3 flex w-full touch-manipulation items-center justify-between gap-2 rounded-lg border border-marca-violeta bg-marca-violeta/5 px-3 py-2.5 text-left"
              >
                <span className="font-semibold text-marca-noche">{profileLabel(codeResult)}</span>
                <span className="text-xs font-bold text-marca-violeta">Elegir →</span>
              </button>
            )}
          </div>
        </div>
      )}

      {step === "offer" && recipient && (
        <div className="flex flex-col gap-4">
          <RecipientHeader recipient={recipient} onChange={() => setStep("recipient")} />
          <h2 className="text-lg font-bold">¿Qué le ofreces?</h2>
          <CardPickerGrid
            cards={offerableCards}
            maxByCard={myOfferMax}
            selected={offerSelection}
            onChange={(cardId, qty) =>
              setOfferSelection((prev) => {
                const next = new Map(prev);
                if (qty <= 0) next.delete(cardId);
                else next.set(cardId, qty);
                return next;
              })
            }
            emptyMessage="No tienes cartas disponibles para ofrecer (solo tienes 1 copia de cada una, o ya las comprometiste todas en otras ofertas)."
          />
        </div>
      )}

      {step === "request" && recipient && (
        <div className="flex flex-col gap-4">
          <RecipientHeader recipient={recipient} onChange={() => setStep("recipient")} />
          <h2 className="text-lg font-bold">
            ¿Qué le pides a {profileLabel(recipient)}?
          </h2>
          {theirCardsLoading ? (
            <p className="py-8 text-center text-sm text-marca-noche/50">Cargando su colección…</p>
          ) : (
            <CardPickerGrid
              cards={theirRequestCards}
              maxByCard={theirRequestMax}
              selected={requestSelection}
              onChange={(cardId, qty) =>
                setRequestSelection((prev) => {
                  const next = new Map(prev);
                  if (qty <= 0) next.delete(cardId);
                  else next.set(cardId, qty);
                  return next;
                })
              }
              emptyMessage="Este jugador todavía no tiene ninguna carta."
            />
          )}
        </div>
      )}

      {step === "review" && recipient && (
        <div className="flex flex-col gap-4">
          <RecipientHeader recipient={recipient} onChange={() => setStep("recipient")} />

          <div>
            <label className="mb-1 block text-sm font-semibold text-marca-noche">
              Mensaje (opcional)
            </label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Escribí algo corto…"
              className="w-full rounded-lg border border-marca-noche/20 px-3 py-2.5 text-sm focus:border-marca-violeta focus:outline-none"
            />
          </div>

          <ReviewList title="Tú ofreces" selection={offerSelection} cardsById={myCardsById} />
          <ReviewList
            title="Pedís"
            selection={requestSelection}
            cardsById={new Map(theirRequestCards.map((c) => [c.id, c]))}
          />

          {submitError && (
            <p className="rounded border border-marca-rojo/40 bg-marca-rojo/10 px-3 py-2 text-sm text-marca-rojo">
              {submitError}
            </p>
          )}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center border-t border-marca-noche/10 bg-marca-claro/95 p-3 backdrop-blur-sm">
        <div className="flex w-full max-w-3xl items-center justify-between gap-3">
          {step !== "recipient" ? (
            <button
              type="button"
              onClick={() => {
                if (step === "offer") setStep("recipient");
                else if (step === "request") setStep("offer");
                else if (step === "review") setStep("request");
              }}
              className="touch-manipulation rounded-xl border border-marca-noche/20 px-5 py-3 text-sm font-semibold text-marca-noche"
            >
              ← Atrás
            </button>
          ) : (
            <span />
          )}

          {step === "offer" && (
            <button
              type="button"
              onClick={() => setStep("request")}
              disabled={offerCount === 0}
              className="touch-manipulation rounded-xl bg-marca-violeta px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
            </button>
          )}

          {step === "request" && (
            <button
              type="button"
              onClick={() => setStep("review")}
              className="touch-manipulation rounded-xl bg-marca-violeta px-6 py-3 text-sm font-bold text-white"
            >
              {requestCount === 0 ? "Continuar sin pedir nada" : "Continuar"}
            </button>
          )}

          {step === "review" && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="touch-manipulation rounded-xl bg-marca-violeta px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Enviando…" : "Enviar oferta"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "recipient", label: "Jugador" },
    { key: "offer", label: "Ofrecés" },
    { key: "request", label: "Pedís" },
    { key: "review", label: "Revisar" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex flex-col gap-1.5">
      {/* En mobile solo los círculos numerados (compacto, entra sin
          scroll); las etiquetas de texto completas se muestran recién en
          sm+, donde hay ancho de sobra. El paso actual igual se lee abajo
          en texto en cualquier tamaño. */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i <= currentIndex ? "bg-marca-violeta text-white" : "bg-marca-noche/10 text-marca-noche/40"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`hidden text-xs font-semibold sm:inline ${i <= currentIndex ? "text-marca-noche" : "text-marca-noche/40"}`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="h-px w-3 shrink-0 bg-marca-noche/15 sm:w-4" />}
          </div>
        ))}
      </div>
      <p className="text-xs font-semibold text-marca-noche sm:hidden">
        Paso {currentIndex + 1} de {steps.length}: {steps[currentIndex].label}
      </p>
    </div>
  );
}

function RecipientHeader({ recipient, onChange }: { recipient: PublicProfile; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-marca-noche/10 bg-white p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca-violeta text-sm font-bold text-white">
          {profileLabel(recipient).charAt(0).toUpperCase()}
        </div>
        <span className="font-semibold text-marca-noche">{profileLabel(recipient)}</span>
      </div>
      <button type="button" onClick={onChange} className="text-xs font-semibold text-marca-violeta">
        Cambiar
      </button>
    </div>
  );
}

function ReviewList({
  title,
  selection,
  cardsById,
}: {
  title: string;
  selection: Map<string, number>;
  cardsById: Map<string, PickableCard>;
}) {
  const entries = Array.from(selection.entries()).filter(([, qty]) => qty > 0);
  return (
    <div className="rounded-xl border border-marca-noche/10 bg-white p-3">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-marca-noche/50">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-marca-noche/40">Nada</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entries.map(([cardId, qty]) => (
            <li key={cardId} className="text-sm text-marca-noche">
              {cardsById.get(cardId)?.name ?? "Carta"} x{qty}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
