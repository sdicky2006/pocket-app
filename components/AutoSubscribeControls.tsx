"use client";

import { useEffect, useState } from 'react';

type Cfg = { enabled: boolean; intervalSec: number; targetCount: number };

export default function AutoSubscribeControls() {
  const [cfg, setCfg] = useState<Cfg>({ enabled: true, intervalSec: 10, targetCount: 30 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await fetch('/api/auto-subscribe/config', { cache: 'no-store' });
      const j = await r.json();
      if (j?.config) setCfg(j.config);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const save = async (next?: Partial<Cfg>) => {
    setSaving(true);
    try {
      const r = await fetch('/api/auto-subscribe/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next ? { ...cfg, ...next } : cfg) });
      const j = await r.json();
      if (j?.config) setCfg(j.config);
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="card shadow-sm">
      <div className="card-body d-flex flex-wrap align-items-center gap-3">
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" id="asEnabled" checked={cfg.enabled} onChange={(e)=>save({ enabled: e.target.checked })} />
          <label className="form-check-label" htmlFor="asEnabled">Auto subscribe</label>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Interval</label>
          <input type="number" min={2} max={120} className="form-control form-control-sm" style={{ width: 100 }} value={cfg.intervalSec} onChange={(e)=>setCfg({ ...cfg, intervalSec: Math.max(2, Math.min(120, parseInt(e.target.value||'10', 10))) })} onBlur={()=>save()} />
          <span className="text-muted small">sec</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted small">Max symbols</label>
          <input type="number" min={5} max={200} className="form-control form-control-sm" style={{ width: 110 }} value={cfg.targetCount} onChange={(e)=>setCfg({ ...cfg, targetCount: Math.max(5, Math.min(200, parseInt(e.target.value||'30', 10))) })} onBlur={()=>save()} />
        </div>
        <div className="text-muted small ms-auto">{saving ? 'Saving…' : ''}</div>
      </div>
      <div className="card-footer text-muted small">Uses learned websocket subscribe template; no DOM scraping.</div>
    </div>
  );
}



