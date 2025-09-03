"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";

export type AnalysisConfigUI = {
  emaFastPeriod?: number;
  emaSlowPeriod?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  weights?: {
    trend?: number;
    momentumStrong?: number;
    momentumMild?: number;
    sr?: number;
    fib?: number;
    pattern?: number;
    shortExpiryMeanRev?: number;
  };
};

type Props = {
  value: AnalysisConfigUI;
  onChange: (next: AnalysisConfigUI) => void;
  className?: string;
  onReset?: () => void;
};

export default function AnalysisSettings({ value, onChange, className, onReset }: Props) {
  const set = useCallback((key: keyof AnalysisConfigUI, num: number) => {
    onChange({ ...value, [key]: num });
  }, [onChange, value]);

  const setW = useCallback((key: keyof NonNullable<AnalysisConfigUI["weights"]>, num: number) => {
    onChange({ ...value, weights: { ...(value.weights ?? {}), [key]: num } });
  }, [onChange, value]);

  return (
    <div className={cn("trading-card p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Advanced Analysis Settings</h3>
        <button onClick={onReset} className="text-xs px-3 py-1 rounded border border-border-secondary hover:border-accent-warning/50">Reset</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset className="border border-border-secondary rounded p-4">
          <legend className="px-1 text-sm text-text-secondary">Indicators</legend>
          <LabelNumber label="EMA Fast" value={value.emaFastPeriod ?? 9} onChange={(n) => set("emaFastPeriod", n)} min={2} max={100} />
          <LabelNumber label="EMA Slow" value={value.emaSlowPeriod ?? 21} onChange={(n) => set("emaSlowPeriod", n)} min={3} max={200} />
          <LabelNumber label="RSI Period" value={value.rsiPeriod ?? 14} onChange={(n) => set("rsiPeriod", n)} min={5} max={50} />
          <LabelNumber label="RSI Oversold" value={value.rsiOversold ?? 35} onChange={(n) => set("rsiOversold", n)} min={5} max={60} />
          <LabelNumber label="RSI Overbought" value={value.rsiOverbought ?? 65} onChange={(n) => set("rsiOverbought", n)} min={40} max={95} />
        </fieldset>

        <fieldset className="border border-border-secondary rounded p-4">
          <legend className="px-1 text-sm text-text-secondary">Weights</legend>
          <LabelNumber label="Trend" value={value.weights?.trend ?? 12} onChange={(n) => setW("trend", n)} min={0} max={30} />
          <LabelNumber label="Momentum (Strong)" value={value.weights?.momentumStrong ?? 10} onChange={(n) => setW("momentumStrong", n)} min={0} max={30} />
          <LabelNumber label="Momentum (Mild)" value={value.weights?.momentumMild ?? 3} onChange={(n) => setW("momentumMild", n)} min={0} max={15} />
          <LabelNumber label="Support/Resistance" value={value.weights?.sr ?? 8} onChange={(n) => setW("sr", n)} min={0} max={20} />
          <LabelNumber label="Fibonacci" value={value.weights?.fib ?? 4} onChange={(n) => setW("fib", n)} min={0} max={15} />
          <LabelNumber label="Patterns" value={value.weights?.pattern ?? 6} onChange={(n) => setW("pattern", n)} min={0} max={15} />
          <LabelNumber label="Short Expiry Mean-Reversion" value={value.weights?.shortExpiryMeanRev ?? 5} onChange={(n) => setW("shortExpiryMeanRev", n)} min={0} max={15} />
        </fieldset>
      </div>
    </div>
  );
}

function LabelNumber({ label, value, onChange, min = 0, max = 999 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm py-1.5">
      <span className="text-text-secondary">{label}</span>
      <input
        type="number"
        className="w-24 bg-surface-elevated border border-border-primary rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
