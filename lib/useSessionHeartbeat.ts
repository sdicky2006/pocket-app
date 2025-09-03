"use client";

import { useEffect, useRef } from "react";

function jitter(ms: number, pct: number) {
  const delta = ms * pct;
  const offset = (Math.random() - 0.5) * 2 * delta; // ±pct
  return Math.max(1000, ms + offset);
}

export function useSessionHeartbeat(enabled: boolean) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"]; 
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    let stopped = false;

    const schedule = () => {
      if (stopped) return;
      const base = 60_000; // 60s base
      const wait = jitter(base, 0.35); // ±35%
      timerRef.current = setTimeout(tick, wait);
    };

    const tick = async () => {
      if (stopped) return;
      // Avoid pinging if tab is hidden or no recent activity for 10 min
      if (document.hidden || Date.now() - lastActivityRef.current > 10 * 60_000) {
        schedule();
        return;
      }
      try {
        // Ping an existing healthy endpoint to keep the app warm without auth noise
        await fetch("/api/bridge/status", { method: "GET", cache: "no-store" });
      } catch {}
      schedule();
    };

    schedule();

    return () => {
      stopped = true;
      events.forEach((e) => window.removeEventListener(e, onActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);
}
