"use client";

import { type ExpiryValue } from "@/components/ExpirySelector";

export type SignalResult = {
  side: "CALL" | "PUT" | "NEUTRAL";
  confidence: number;
  entryHint: string;
  rationale: string[];
  indicators: {
    emaFast: number;
    emaSlow: number;
    rsi: number;
    lastPrice: number;
    srWindowMin?: number;
    srWindowMax?: number;
  };
  timeframeUsed: string;
  components?: Array<{ key: string; score: number; notes: string }>;
  features?: {
    ofi?: { imbalance: number; pressure: number };
    vol?: { rv1m: number; rv5m: number };
    sweep?: { type: 'high' | 'low' | null; strength: number };
    fvg?: { hasBull: boolean; hasBear: boolean };
    profile?: { poc: number; vaLow: number; vaHigh: number };
    session?: { inWindow: boolean };
    dxyBias?: number;
  };
};

function riskText(conf: number) {
  if (conf >= 80) return "High confidence: consider full size (1R). Avoid stacking multiple simultaneous trades.";
  if (conf >= 60) return "Medium confidence: standard size (0.5–0.75R). Wait for clean entry; avoid chasing.";
  return "Low confidence: consider skipping or quarter size (0.25R). Prefer more confluence.";
}

export default function SignalCard({
  signal,
  pair,
  expiry,
}: {
  signal: SignalResult | null;
  pair: string;
  expiry: ExpiryValue;
}) {
  return (
    <div className="trading-card p-6">
      <h3 className="text-lg font-semibold mb-4 text-center">Current Signal</h3>
      {signal ? (
        <div className="space-y-3">
          <div className="text-center">
            <div className="text-2xl font-bold mb-1">{signal.side}</div>
            <div className="text-text-muted text-sm">Confidence: {signal.confidence}%</div>
            <div className="text-text-muted text-xs mt-2">{pair} • {expiry}</div>
            <div className="text-xs text-text-secondary mt-1">TF: {signal.timeframeUsed}</div>
          </div>

          <div className="bg-surface-elevated border border-border-secondary rounded p-3 text-sm">
            <div className="font-medium mb-1">Entry Hint</div>
            <div className="text-text-secondary">{signal.entryHint}</div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-surface-elevated border border-border-secondary rounded p-3 text-sm">
              <div className="font-medium mb-1">Expiry Suggestion</div>
              <div className="text-text-secondary">
                Use {expiry} (PO) aligned with TF {signal.timeframeUsed}. If late to entry, wait for a minor retrace.
              </div>
            </div>
            <div className="bg-surface-elevated border border-border-secondary rounded p-3 text-sm">
              <div className="font-medium mb-1">Risk Management</div>
              <div className="text-text-secondary">{riskText(signal.confidence)}</div>
            </div>
          </div>

          <div className="bg-surface-elevated border border-border-secondary rounded p-3 text-sm">
            <div className="font-medium mb-2">Rationale</div>
            <ul className="list-disc list-inside space-y-1 text-text-secondary">
              {signal.rationale.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-surface-elevated border border-border-secondary rounded p-3">
              <div className="text-text-muted">EMA(9)</div>
              <div className="font-mono">{signal.indicators.emaFast}</div>
            </div>
            <div className="bg-surface-elevated border border-border-secondary rounded p-3">
              <div className="text-text-muted">EMA(21)</div>
              <div className="font-mono">{signal.indicators.emaSlow}</div>
            </div>
            <div className="bg-surface-elevated border border-border-secondary rounded p-3">
              <div className="text-text-muted">RSI(14)</div>
              <div className="font-mono">{signal.indicators.rsi}</div>
            </div>
            <div className="bg-surface-elevated border border-border-secondary rounded p-3">
              <div className="text-text-muted">Last Price</div>
              <div className="font-mono">{signal.indicators.lastPrice}</div>
            </div>
          </div>

          {/* Institutional components breakdown */}
          {signal.components && signal.components.length > 0 && (
            <div className="bg-surface-elevated border border-border-secondary rounded p-3 text-sm">
              <div className="font-medium mb-2">Strategy Components</div>
              <div className="space-y-1">
                {signal.components.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="font-mono">{c.key}</div>
                    <div className={c.score >= 0 ? "text-green-600" : "text-red-600"}>
                      {c.score >= 0 ? '+' : ''}{c.score}
                    </div>
                    <div className="text-text-secondary truncate ml-2" title={c.notes}>{c.notes}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feature snapshot */}
          {signal.features && (
            <div className="bg-surface-elevated border border-border-secondary rounded p-3 text-xs">
              <div className="font-medium mb-2">Feature Snapshot</div>
              <div className="grid grid-cols-2 gap-2">
                {signal.features.ofi && (
                  <div>
                    <div className="text-text-muted">Order Flow</div>
                    <div className="font-mono">imb {signal.features.ofi.imbalance.toFixed(2)} • pr {signal.features.ofi.pressure.toFixed(2)}</div>
                  </div>
                )}
                {signal.features.vol && (
                  <div>
                    <div className="text-text-muted">Vol Regime</div>
                    <div className="font-mono">rv1m {signal.features.vol.rv1m.toExponential(2)} • rv5m {signal.features.vol.rv5m.toExponential(2)}</div>
                  </div>
                )}
                {signal.features.sweep && (
                  <div>
                    <div className="text-text-muted">Liquidity Sweep</div>
                    <div className="font-mono">{signal.features.sweep.type || 'none'} • {Math.round(signal.features.sweep.strength * 100)}%</div>
                  </div>
                )}
                {signal.features.fvg && (
                  <div>
                    <div className="text-text-muted">FVG</div>
                    <div className="font-mono">bull {signal.features.fvg.hasBull ? '✓' : '—'} • bear {signal.features.fvg.hasBear ? '✓' : '—'}</div>
                  </div>
                )}
                {signal.features.profile && (
                  <div>
                    <div className="text-text-muted">Profile (POC/VA)</div>
                    <div className="font-mono">{signal.features.profile.poc.toFixed(5)} / {signal.features.profile.vaLow.toFixed(5)}–{signal.features.profile.vaHigh.toFixed(5)}</div>
                  </div>
                )}
                {typeof signal.features.dxyBias === 'number' && (
                  <div>
                    <div className="text-text-muted">USD Bias</div>
                    <div className="font-mono">{signal.features.dxyBias >= 0 ? '+' : ''}{signal.features.dxyBias.toFixed(5)}</div>
                  </div>
                )}
                {signal.features.session && (
                  <div>
                    <div className="text-text-muted">Session Window</div>
                    <div className="font-mono">{signal.features.session.inWindow ? 'preferred' : 'off-window'}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-text-muted text-sm">
          No signal yet. Select pair & expiry and press Analyze.
        </div>
      )}
    </div>
  );
}
