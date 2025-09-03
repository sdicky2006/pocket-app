"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Toast = { id: string; message: string };

type ToastCtx = {
  toasts: Toast[];
  show: (message: string, ttlMs?: number) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, ttlMs = 3000) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttlMs);
  }, []);

  const value = useMemo(() => ({ toasts, show }), [toasts, show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div key={t.id} className="px-4 py-2 rounded bg-surface-elevated border border-border-secondary text-sm shadow-trading">
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToasts(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToasts must be used within ToastProvider');
  return ctx;
}
