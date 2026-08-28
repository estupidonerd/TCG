"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { CodeInput } from "@/components/canjear/code-input";
import { PackOpening } from "@/components/canjear/pack-opening";
import type { RedeemResult } from "@/lib/supabase/types";

export function RedeemForm({ cardBackUrl }: { cardBackUrl: string | null }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (code.replace(/-/g, "").length !== 12) {
      setError("Ingresá los 12 caracteres del código.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("redeem_code", {
      p_code: code,
    });
    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setResult(data as RedeemResult);
  };

  if (result) {
    return (
      <PackOpening
        cards={result.cards}
        cardBackUrl={cardBackUrl}
        packImageUrl={result.pack_image_url}
        tradeDefault={result.trade_default}
        onReset={() => {
          setResult(null);
          setCode("");
          setError(null);
        }}
      />
    );
  }

  const isComplete = code.replace(/-/g, "").length === 12;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col items-center gap-4"
    >
      {error && (
        <p className="w-full rounded border border-marca-rojo/40 bg-marca-rojo/10 px-3 py-2 text-center text-sm text-marca-rojo">
          {error}
        </p>
      )}

      <CodeInput value={code} onChange={setCode} disabled={loading} />

      <button
        type="submit"
        disabled={loading || !isComplete}
        className="w-full touch-manipulation rounded-xl bg-marca-violeta px-6 py-4 text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Canjeando…" : "Canjear código"}
      </button>
    </form>
  );
}
