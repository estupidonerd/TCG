"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/providers/user-provider";

const POLL_MS = 30000;

// Notificación visual de ofertas pendientes en el nav. Sin Realtime
// habilitado en el proyecto, se resuelve con un fetch al montar + poll
// cada 30s -- razonable para este volumen de uso, sin necesitar
// infraestructura extra.
export function TradeBadge() {
  const { user } = useUser();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function loadCount() {
      const { count: pendingCount } = await supabase
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user!.id)
        .eq("status", "pendiente")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      if (!cancelled) setCount(pendingCount ?? 0);
    }

    loadCount();
    const interval = setInterval(loadCount, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  if (count === 0) return null;

  return (
    <span
      className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-marca-rojo px-1.5 text-[10px] font-bold text-white"
      aria-label={`${count} ${count === 1 ? "oferta pendiente" : "ofertas pendientes"}`}
    >
      {count}
    </span>
  );
}
