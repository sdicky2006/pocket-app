"use client";

import { useEffect } from "react";
import { useMarketStore } from "@/lib/marketStore";

export default function LiveWSStream() {
  const applyUpdate = useMarketStore((s) => s.applyUpdate);

  useEffect(() => {
    const es = new EventSource("/api/bridge/ws-stream");
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as { direction: 'in'|'out'; url: string; payload: string; ts: number };
        if (msg.direction !== 'in') return; // only incoming frames likely contain prices
      } catch {}
    };
    es.addEventListener('quote', (e) => {
      try {
        const q = JSON.parse((e as MessageEvent).data) as { symbol: string; price: number; ts: number };
        if (q && q.symbol && Number.isFinite(q.price)) {
          applyUpdate({ symbol: q.symbol, price: q.price, ts: q.ts });
        }
      } catch {}
    });
    es.onerror = () => {
      // Let EventSource auto-retry based on 'retry:' value
    };
    return () => es.close();
  }, [applyUpdate]);

  return null;
}


