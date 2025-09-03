"use client";

import { useEffect, useState } from 'react';

type Cfg = {
  enabled: boolean;
  account: 'demo'|'live';
  threshold: number;
  amount: number;
  expiry: '30s'|'1m'|'2m'|'3m'|'5m'|'10m'|'15m'|'30m'|'1h';
  activeChartOnly: boolean;
  cooldownSec: number;
  masaniello?: {
    enabled: boolean;
    bankroll: number;
    targetWins: number;
    winProbability: number;
    currentStep: number;
    minStake: number;
    maxStakePercent: number;
  };
};

export default function AutoTradeControls() {
  const [cfg, setCfg] = useState<Cfg>({ enabled: false, account: 'demo', threshold: 75, amount: 1, expiry: '1m', activeChartOnly: true, cooldownSec: 60, masaniello: { enabled: false, bankroll: 100, targetWins: 10, winProbability: 0.55, currentStep: 1, minStake: 1, maxStakePercent: 0.02 } });
  const [saving, setSaving] = useState(false);
  const [preferred, setPreferred] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/auto-trade/config', { cache: 'no-store' });
      const j = await r.json();
      if (j?.config) setCfg(j.config);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const save = async (next?: Partial<Cfg>) => {
    setSaving(true);
    try {
      const r = await fetch('/api/auto-trade/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next ? { ...cfg, ...next } : cfg) });
      const j = await r.json();
      if (j?.config) setCfg(j.config);
    } catch {} finally { setSaving(false); }
  };

  const savePreferred = async () => {
    try {
      await fetch('/api/auto-trade/symbol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: preferred }) });
    } catch {}
  };

  return (
    <div className="card shadow-sm">
      <div className="card-body d-flex flex-wrap align-items-center gap-3">
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" checked={cfg.enabled} onChange={(e)=>save({ enabled: e.target.checked })} id="autoTradeEnabled" />
          <label className="form-check-label" htmlFor="autoTradeEnabled">Auto trade</label>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Account</label>
          <select className="form-select form-select-sm" value={cfg.account} onChange={(e)=>save({ account: e.target.value as any })}>
            <option value="demo">Demo</option>
            <option value="live">Live</option>
          </select>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Confidence ≥</label>
          <input type="number" min={50} max={100} className="form-control form-control-sm" style={{ width: 80 }} value={cfg.threshold} onChange={(e)=>setCfg({ ...cfg, threshold: Math.max(50, Math.min(100, parseInt(e.target.value||'75', 10))) })} onBlur={()=>save()} />
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Amount</label>
          <input type="number" min={1} step={1} className="form-control form-control-sm" style={{ width: 90 }} value={cfg.amount} onChange={(e)=>setCfg({ ...cfg, amount: Math.max(1, parseFloat(e.target.value||'1')) })} onBlur={()=>save()} />
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Expiry</label>
          <select className="form-select form-select-sm" value={cfg.expiry} onChange={(e)=>save({ expiry: e.target.value as any })}>
            {['30s','1m','2m','3m','5m','10m','15m','30m','1h'].map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" checked={cfg.activeChartOnly} onChange={(e)=>save({ activeChartOnly: e.target.checked })} id="activeChartOnly" />
          <label className="form-check-label" htmlFor="activeChartOnly">Active chart only</label>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Cooldown</label>
          <input type="number" min={10} max={600} className="form-control form-control-sm" style={{ width: 90 }} value={cfg.cooldownSec} onChange={(e)=>setCfg({ ...cfg, cooldownSec: Math.max(10, Math.min(600, parseInt(e.target.value||'60', 10))) })} onBlur={()=>save()} />
          <span className="text-muted small">sec</span>
        </div>
        <div className="text-muted small ms-auto">{saving ? 'Saving…' : ''}</div>
      </div>
    <div className="card-body border-top">
      <div className="d-flex align-items-center gap-3 flex-wrap">
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Preferred symbol</label>
          <input type="text" placeholder="e.g. EUR/USD_otc" className="form-control form-control-sm" style={{ width: 180 }} value={preferred} onChange={(e)=>setPreferred(e.target.value)} onBlur={savePreferred} />
        </div>
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" checked={!!cfg.masaniello?.enabled} onChange={(e)=>save({ masaniello: { ...(cfg.masaniello || {}), enabled: e.target.checked } as any })} id="mEnabled" />
          <label className="form-check-label" htmlFor="mEnabled">Masaniello sizing</label>
        </div>
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" id="allowNav" onChange={(e)=>save({ allowNavigateToTrading: e.target.checked } as any)} />
          <label className="form-check-label" htmlFor="allowNav">Allow navigation to trading page</label>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Bankroll</label>
          <input type="number" min={10} step={1} className="form-control form-control-sm" style={{ width: 110 }} value={cfg.masaniello?.bankroll ?? 100} onChange={(e)=>setCfg({ ...cfg, masaniello: { ...(cfg.masaniello || {}), bankroll: Math.max(10, parseFloat(e.target.value||'100')) } as any })} onBlur={()=>save()} />
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Target wins</label>
          <input type="number" min={1} max={50} className="form-control form-control-sm" style={{ width: 100 }} value={cfg.masaniello?.targetWins ?? 10} onChange={(e)=>setCfg({ ...cfg, masaniello: { ...(cfg.masaniello || {}), targetWins: Math.max(1, Math.min(50, parseInt(e.target.value||'10', 10))) } as any })} onBlur={()=>save()} />
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Win prob</label>
          <input type="number" min={0.1} max={0.9} step={0.01} className="form-control form-control-sm" style={{ width: 100 }} value={cfg.masaniello?.winProbability ?? 0.55} onChange={(e)=>setCfg({ ...cfg, masaniello: { ...(cfg.masaniello || {}), winProbability: Math.max(0.1, Math.min(0.9, parseFloat(e.target.value||'0.55'))) } as any })} onBlur={()=>save()} />
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Step</label>
          <input type="number" min={1} max={100} className="form-control form-control-sm" style={{ width: 90 }} value={cfg.masaniello?.currentStep ?? 1} onChange={(e)=>setCfg({ ...cfg, masaniello: { ...(cfg.masaniello || {}), currentStep: Math.max(1, Math.min(100, parseInt(e.target.value||'1', 10))) } as any })} onBlur={()=>save()} />
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Min stake</label>
          <input type="number" min={1} step={1} className="form-control form-control-sm" style={{ width: 100 }} value={cfg.masaniello?.minStake ?? 1} onChange={(e)=>setCfg({ ...cfg, masaniello: { ...(cfg.masaniello || {}), minStake: Math.max(1, parseFloat(e.target.value||'1')) } as any })} onBlur={()=>save()} />
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Max stake %</label>
          <input type="number" min={0.005} max={0.2} step={0.005} className="form-control form-control-sm" style={{ width: 110 }} value={cfg.masaniello?.maxStakePercent ?? 0.02} onChange={(e)=>setCfg({ ...cfg, masaniello: { ...(cfg.masaniello || {}), maxStakePercent: Math.max(0.005, Math.min(0.2, parseFloat(e.target.value||'0.02'))) } as any })} onBlur={()=>save()} />
        </div>
      </div>
    </div>
      <div className="card-footer text-muted small">
        Warning: Live trading involves risk. Use demo to validate first.
      </div>
    </div>
  );
}


