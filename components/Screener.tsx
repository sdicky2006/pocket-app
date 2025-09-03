"use client";

import { useEffect, useMemo, useState } from "react";

type ScreenerItem = {
  symbol: string;
  category: string;
  price: number;
  lastUpdate: number;
  best: { expiry: "30s"|"1m"|"2m"|"3m"|"5m"|"10m"|"15m"|"30m"|"1h"; side: 'CALL'|'PUT'|'NEUTRAL'; confidence: number; timeframeUsed: string };
};

export default function Screener() {
  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [intervalSec, setIntervalSec] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/screener', { cache: 'no-store' });
      const j = await r.json();
      if (Array.isArray(j?.items)) setItems(j.items);
    } catch (e: any) {
      setError('Failed to load screener');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(load, Math.max(1, intervalSec) * 1000);
    return () => clearInterval(id);
  }, [auto, intervalSec]);

  const top = useMemo(() => items.slice(0, 20), [items]);

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h3 className="h6 mb-0">Auto Signal Screener</h3>
          <div className="d-flex align-items-center gap-2">
            <div className="form-check form-switch">
              <input className="form-check-input" type="checkbox" checked={auto} onChange={(e)=>setAuto(e.target.checked)} id="screenerAuto" />
              <label className="form-check-label small" htmlFor="screenerAuto">Auto</label>
            </div>
            <input type="number" min={1} max={120} value={intervalSec} onChange={(e)=>setIntervalSec(Math.max(1, Math.min(120, parseInt(e.target.value||'1', 10))))} className="form-control form-control-sm" style={{ width: 80 }} />
            <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          </div>
        </div>
        {error && <div className="alert alert-danger py-1 my-2 small">{error}</div>}
        {items.length === 0 && !loading ? (
          <div className="text-muted small">No items yet. Ensure bridge is connected and quotes are flowing.</div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: 420 }}>
            <table className="table table-sm align-middle">
              <thead className="table-light position-sticky" style={{ top: 0 }}>
                <tr>
                  <th>Symbol</th>
                  <th>Category</th>
                  <th className="text-end">Price</th>
                  <th>Best Expiry</th>
                  <th>Side</th>
                  <th className="text-end">Confidence</th>
                  <th className="text-muted">TF Used</th>
                  <th className="text-muted">Updated</th>
                </tr>
              </thead>
              <tbody>
                {top.map((it) => (
                  <tr key={`${it.symbol}-${it.best.expiry}`}>
                    <td className="font-monospace">{it.symbol}</td>
                    <td className="text-capitalize">{it.category}</td>
                    <td className="text-end">{Number(it.price).toFixed(5)}</td>
                    <td>{it.best.expiry}</td>
                    <td className={it.best.side === 'CALL' ? 'text-success' : it.best.side === 'PUT' ? 'text-danger' : 'text-muted'}>{it.best.side}</td>
                    <td className="text-end fw-semibold">{it.best.confidence}%</td>
                    <td className="text-muted small">{it.best.timeframeUsed}</td>
                    <td className="text-muted small">{new Date(it.lastUpdate).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


