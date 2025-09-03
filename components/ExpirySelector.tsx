"use client";

import { useMemo } from "react";
import { Zap, Timer, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExpiryValue =
  | "30s"
  | "1m"
  | "2m"
  | "3m"
  | "5m"
  | "10m"
  | "15m"
  | "30m"
  | "1h";

interface ExpiryOption {
  id: ExpiryValue;
  label: string;
  group: "Turbo" | "Classic";
  recommendedAnalysisTF: string; // informational only
}

interface ExpirySelectorProps {
  selectedExpiry: ExpiryValue;
  onExpirySelect: (val: ExpiryValue) => void;
  className?: string;
}

const EXPIRIES: ExpiryOption[] = [
  // Turbo (Pocket Option)
  { id: "30s", label: "30 sec", group: "Turbo", recommendedAnalysisTF: "15s–30s/1m" },
  { id: "1m", label: "1 min", group: "Turbo", recommendedAnalysisTF: "1m/3m" },
  { id: "2m", label: "2 min", group: "Turbo", recommendedAnalysisTF: "1m/3m" },
  { id: "3m", label: "3 min", group: "Turbo", recommendedAnalysisTF: "1m/5m" },
  { id: "5m", label: "5 min", group: "Turbo", recommendedAnalysisTF: "1m/5m/15m" },
  // Classic (Pocket Option)
  { id: "10m", label: "10 min", group: "Classic", recommendedAnalysisTF: "5m/15m" },
  { id: "15m", label: "15 min", group: "Classic", recommendedAnalysisTF: "5m/15m" },
  { id: "30m", label: "30 min", group: "Classic", recommendedAnalysisTF: "15m/30m/1h" },
  { id: "1h", label: "1 hour", group: "Classic", recommendedAnalysisTF: "30m/1h/4h" },
];

export default function ExpirySelector({ selectedExpiry, onExpirySelect, className }: ExpirySelectorProps) {
  const turbo = useMemo(() => EXPIRIES.filter((e) => e.group === "Turbo"), []);
  const classic = useMemo(() => EXPIRIES.filter((e) => e.group === "Classic"), []);

  const renderGroup = (
    title: string,
    Icon: typeof Zap,
    items: ExpiryOption[],
    colorClass: string
  ) => (
    <div className="trading-card p-4">
      <div className="flex items-center mb-3">
        <Icon className={cn("w-5 h-5 mr-2", colorClass)} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onExpirySelect(opt.id)}
            className={cn(
              "px-3 py-2 rounded-lg border text-sm transition-all",
              selectedExpiry === opt.id
                ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                : "border-border-primary hover:border-accent-primary/50 hover:bg-surface-elevated text-text-secondary"
            )}
            title={`Recommended analysis TF: ${opt.recommendedAnalysisTF}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={cn("trading-card p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center">
          <Timer className="w-5 h-5 mr-2 text-accent-secondary" />
          Pocket Option Expiry
        </h2>
        <span className="text-xs text-text-muted">Turbo & Classic</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {renderGroup("Turbo (30s–5m)", Zap, turbo, "text-accent-danger")}
        {renderGroup("Classic (10m–1h)", Clock, classic, "text-accent-secondary")}
      </div>

      <div className="mt-4 text-xs text-text-muted">
        Selected expiry is used for signal timing specific to Pocket Option. Chart timeframes for analysis are handled internally by the strategy engine.
      </div>
    </div>
  );
}
