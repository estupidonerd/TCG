"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SaveContactButton } from "@/components/trades/save-contact-button";
import { BlockUserButton } from "@/components/trades/block-user-button";
import { TradeAcceptAnimation } from "@/components/trades/trade-accept-animation";
import { profileLabel } from "@/lib/utils/profile-label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { CardArtOverlay } from "@/components/cards/card-art-overlay";
import type { CardTemplate, TradeStatus } from "@/lib/supabase/types";
import type { TradeItemWithCard, TradeWithDetails } from "./page";

type Tab = "recibidas" | "enviadas" | "historial";

const STATUS_STYLE: Record<TradeStatus, string> = {
  pendiente: "border-marca-amarillo bg-marca-amarillo/20 text-marca-noche",
  aceptado: "border-green-400 bg-green-100 text-green-700",
  rechazado: "border-marca-rojo/40 bg-marca-rojo/10 text-marca-rojo",
  cancelado: "border-gray-300 bg-gray-100 text-gray-500",
  expirado: "border-gray-300 bg-gray-100 text-gray-500",
};

const STATUS_LABEL: Record<TradeStatus, string> = {
  pendiente: "Pendiente",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  expirado: "Vencido",
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

export function TradeInbox({
  trades: initialTrades,
  cardTemplate,
}: {
  trades: TradeWithDetails[];
  cardTemplate: CardTemplate | null;
}) {
  const router = useRouter();
  const [trades, setTrades] = useState(initialTrades);
  const [tab, setTab] = useState<Tab>("recibidas");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorByTrade, setErrorByTrade] = useState<Record<string, string>>({});
  const [animatingTrade, setAnimatingTrade] = useState<TradeWithDetails | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const pendingReceived = useMemo(
    () => trades.filter((t) => t.myRole === "receiver" && t.status === "pendiente"),
    [trades],
  );
  const pendingSent = useMemo(
    () => trades.filter((t) => t.myRole === "sender" && t.status === "pendiente"),
    [trades],
  );
  const history = useMemo(() => trades.filter((t) => t.status !== "pendiente"), [trades]);

  const shown = tab === "recibidas" ? pendingReceived : tab === "enviadas" ? pendingSent : history;

  const setTradeStatus = (tradeId: string, status: TradeStatus) => {
    setTrades((prev) =>
      prev.map((t) => (t.id === tradeId ? { ...t, status, resolved_at: new Date().toISOString() } : t)),
    );
  };

  const handleAccept = async (trade: TradeWithDetails) => {
    setPendingAction(trade.id);
    setErrorByTrade((prev) => ({ ...prev, [trade.id]: "" }));
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_trade", { p_trade_id: trade.id });
    setPendingAction(null);

    if (error) {
      setErrorByTrade((prev) => ({ ...prev, [trade.id]: error.message }));
      return;
    }

    setTradeStatus(trade.id, "aceptado");
    setAnimatingTrade(trade);
  };

  const handleReject = async (tradeId: string) => {
    setPendingAction(tradeId);
    const supabase = createClient();
    const { error } = await supabase.rpc("reject_trade", { p_trade_id: tradeId });
    setPendingAction(null);
    if (error) {
      setErrorByTrade((prev) => ({ ...prev, [tradeId]: error.message }));
      return;
    }
    setTradeStatus(tradeId, "rechazado");
  };

  const handleCancel = async (tradeId: string) => {
    setPendingAction(tradeId);
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_trade", { p_trade_id: tradeId });
    setPendingAction(null);
    if (error) {
      setErrorByTrade((prev) => ({ ...prev, [tradeId]: error.message }));
      return;
    }
    setTradeStatus(tradeId, "cancelado");
  };

  const handleClearHistory = async () => {
    setShowClearConfirm(false);
    setClearingHistory(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("clear_trade_history");
    setClearingHistory(false);
    if (!error) {
      setTrades((prev) => prev.filter((t) => t.status === "pendiente"));
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl">Intercambios</h1>
        <Link
          href="/intercambios/nuevo"
          className="touch-manipulation rounded-xl bg-marca-rojo px-4 py-2.5 text-sm font-bold text-marca-claro transition-opacity hover:opacity-90"
        >
          Nuevo intercambio
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        <TabButton active={tab === "recibidas"} onClick={() => setTab("recibidas")}>
          Recibidas {pendingReceived.length > 0 && `(${pendingReceived.length})`}
        </TabButton>
        <TabButton active={tab === "enviadas"} onClick={() => setTab("enviadas")}>
          Enviadas {pendingSent.length > 0 && `(${pendingSent.length})`}
        </TabButton>
        <TabButton active={tab === "historial"} onClick={() => setTab("historial")}>
          Historial
        </TabButton>
      </div>

      {tab === "historial" && history.length > 0 && (
        <button
          type="button"
          onClick={() => setShowClearConfirm(true)}
          disabled={clearingHistory}
          className="touch-manipulation self-start text-xs font-semibold text-marca-noche/50 underline decoration-dotted hover:text-marca-rojo disabled:opacity-50"
        >
          {clearingHistory ? "Borrando…" : "Borrar historial"}
        </button>
      )}

      {shown.length === 0 && (
        <EmptyState
          icon="🤝"
          message={
            tab === "recibidas"
              ? "No tienes ofertas pendientes por recibir."
              : tab === "enviadas"
                ? "No tienes ofertas pendientes por enviar."
                : "Todavía no hay intercambios resueltos."
          }
        />
      )}

      <ul className="flex flex-col gap-4">
        {shown.map((trade) => (
          <li key={trade.id} className="rounded-xl border border-marca-noche/10 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-marca-noche">{profileLabel(trade.otherParty)}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[trade.status]}`}
                >
                  {STATUS_LABEL[trade.status]}
                </span>
              </div>
              {trade.otherParty && (
                <div className="flex items-center gap-2">
                  <SaveContactButton profile={trade.otherParty} alreadySaved={trade.otherPartyIsContact} />
                  <BlockUserButton
                    profile={trade.otherParty}
                    onBlocked={() => router.refresh()}
                  />
                </div>
              )}
            </div>

            {trade.message && (
              <p className="mt-2 rounded-lg bg-marca-claro px-3 py-2 text-sm italic text-marca-noche/80">
                &quot;{trade.message}&quot;
              </p>
            )}

            <div className="mt-3 grid grid-cols-2 gap-4">
              <ItemsColumn
                title={trade.myRole === "sender" ? "Tú ofreces" : `${profileLabel(trade.otherParty)} ofrece`}
                items={trade.senderItems}
                cardTemplate={cardTemplate}
              />
              <ItemsColumn
                title={trade.myRole === "sender" ? `Le pides a ${profileLabel(trade.otherParty)}` : "Te piden"}
                items={trade.receiverItems}
                cardTemplate={cardTemplate}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-marca-noche/40">
                {trade.status === "pendiente"
                  ? `Vence el ${formatDate(trade.expires_at)}`
                  : `Resuelto el ${formatDate(trade.resolved_at)}`}
              </p>

              {trade.status === "pendiente" && (
                <div className="flex gap-2">
                  {trade.myRole === "receiver" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleReject(trade.id)}
                        disabled={pendingAction === trade.id}
                        className="touch-manipulation rounded-full border border-marca-rojo/40 px-3 py-2 text-xs font-bold text-marca-rojo disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAccept(trade)}
                        disabled={pendingAction === trade.id}
                        className="touch-manipulation rounded-full bg-marca-rojo px-3 py-2 text-xs font-bold text-marca-claro disabled:opacity-50"
                      >
                        Aceptar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCancel(trade.id)}
                      disabled={pendingAction === trade.id}
                      className="touch-manipulation rounded-full border border-marca-noche/20 px-3 py-2 text-xs font-semibold text-marca-noche/60 disabled:opacity-50"
                    >
                      Cancelar oferta
                    </button>
                  )}
                </div>
              )}
            </div>

            {errorByTrade[trade.id] && (
              <p className="mt-2 text-xs font-semibold text-marca-rojo">{errorByTrade[trade.id]}</p>
            )}
          </li>
        ))}
      </ul>

      {animatingTrade && (
        <TradeAcceptAnimation
          offered={animatingTrade.senderItems.map(crossingCardFromItem)}
          requested={animatingTrade.receiverItems.map(crossingCardFromItem)}
          cardTemplate={cardTemplate}
          onComplete={() => {
            setAnimatingTrade(null);
            router.refresh();
          }}
        />
      )}

      {showClearConfirm && (
        <ConfirmDialog
          message="Esto borra tu historial de intercambios resueltos (no afecta las ofertas pendientes ni lo que ve la otra parte). ¿Confirmas?"
          confirmLabel="Borrar historial"
          destructive
          onConfirm={handleClearHistory}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-manipulation whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-marca-violeta text-white" : "bg-marca-noche/5 text-marca-noche/60"
      }`}
    >
      {children}
    </button>
  );
}

function crossingCardFromItem(item: TradeItemWithCard) {
  return {
    id: item.id,
    name: item.card?.name ?? "Carta",
    image_front_url: item.card?.image_front_url ?? null,
    power: item.card?.power ?? null,
    score: item.card?.score ?? null,
    use_card_name_as_display: item.card?.use_card_name_as_display ?? true,
    display_line_1: item.card?.display_line_1 ?? null,
    display_line_2: item.card?.display_line_2 ?? null,
    display_line_3: item.card?.display_line_3 ?? null,
    apply_art_template: item.card?.apply_art_template ?? true,
    name_shadow_intensity: item.card?.name_shadow_intensity ?? 50,
    name_font_size: item.card?.name_font_size ?? 10,
    name_line_height: item.card?.name_line_height ?? 110,
    genre: item.card?.genre ?? null,
    trait: item.card?.trait ?? null,
  };
}

function ItemsColumn({
  title,
  items,
  cardTemplate,
}: {
  title: string;
  items: TradeItemWithCard[];
  cardTemplate: CardTemplate | null;
}) {
  return (
    <div>
      <p className="mb-1.5 truncate text-xs font-bold uppercase tracking-wide text-marca-noche/50">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-marca-noche/30">Nada</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-1.5">
              <div className="relative h-9 w-7 shrink-0 overflow-hidden rounded border border-marca-noche/10 bg-gray-200">
                {item.card?.image_front_url && (
                  <>
                    <Image
                      src={item.card.image_front_url}
                      alt=""
                      fill
                      sizes="30px"
                      className="object-cover"
                      draggable={false}
                      onContextMenu={(event) => event.preventDefault()}
                    />
                    <CardArtOverlay
                      variant="coleccion"
                      template={cardTemplate}
                      applyArtTemplate={item.card.apply_art_template}
                      name={item.card.name}
                      useCardNameAsDisplay={item.card.use_card_name_as_display}
                      displayLine1={item.card.display_line_1}
                      displayLine2={item.card.display_line_2}
                      displayLine3={item.card.display_line_3}
                      nameShadowIntensity={item.card.name_shadow_intensity}
                      nameFontSize={item.card.name_font_size}
                      nameLineHeight={item.card.name_line_height}
                      power={item.card.power}
                      score={item.card.score}
                      genre={item.card.genre}
                      trait={item.card.trait}
                    />
                  </>
                )}
              </div>
              <span className="truncate text-xs text-marca-noche">
                {item.card?.name ?? "Carta"}
                {item.quantity > 1 && ` x${item.quantity}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
