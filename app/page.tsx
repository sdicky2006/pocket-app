'use client';

import { useEffect, useState } from 'react';
import { Activity, Shield, TrendingUp } from 'lucide-react';
import CurrencyPairSelector from '@/components/CurrencyPairSelector';
import ExpirySelector, { type ExpiryValue } from '@/components/ExpirySelector';
import { useToasts } from '@/lib/useToasts';
import AnalysisSettings, { type AnalysisConfigUI } from '@/components/AnalysisSettings';
import SignalCard from '@/components/SignalCard';
import Screener from '@/components/Screener';
import AutoTradeControls from '@/components/AutoTradeControls';
import AutoSubscribeControls from '@/components/AutoSubscribeControls';
import ThemeToggle from '@/components/ThemeToggle';
import BridgeSetup from '@/components/BridgeSetup';

type SignalResult = {
  side: 'CALL' | 'PUT' | 'NEUTRAL';
  confidence: number;
  entryHint: string;
  rationale: string[];
  indicators: { emaFast: number; emaSlow: number; rsi: number; lastPrice: number; srWindowMin?: number; srWindowMax?: number };
  timeframeUsed: string;
};

type SignalItem = {
  id: string;
  at: number;
  pair: string;
  expiry: ExpiryValue;
  result: SignalResult;
};

// helper for risk guidelines
function riskText(conf: number) {
  if (conf >= 80) return 'High confidence: consider full size (1R). Avoid stacking multiple simultaneous trades.';
  if (conf >= 60) return 'Medium confidence: standard size (0.5–0.75R). Wait for clean entry; avoid chasing.';
  return 'Low confidence: consider skipping or quarter size (0.25R). Prefer more confluence.';
}

export default function Home() {
  const [selectedPair, setSelectedPair] = useState('EUR/USD');
  const [selectedExpiry, setSelectedExpiry] = useState<ExpiryValue>('3m');
  const [loading, setLoading] = useState(false);
  const [signal, setSignal] = useState<SignalResult | null>(null);
  const [history, setHistory] = useState<SignalItem[]>([]);
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(false);
  const [config, setConfig] = useState<AnalysisConfigUI>({});
  const { show } = useToasts();
  const [bridgeStatus, setBridgeStatus] = useState<'idle'|'connecting'|'connected'|'stopped'|'error'>('idle');
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [quotesCount, setQuotesCount] = useState(0);
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(false);
  const [autoIntervalSec, setAutoIntervalSec] = useState<number>(15);

  const pollBridge = async () => {
    try {
      const r = await fetch('/api/bridge/status', { cache: 'no-store' });
      const j = await r.json();
      if (j && j.status) setBridgeStatus(j.status);
      if (Array.isArray(j?.quotes)) setQuotesCount(j.quotes.length);
    } catch {}
  };

  useEffect(() => {
    pollBridge();
    const id = setInterval(pollBridge, 3000);
    return () => clearInterval(id);
  }, []);

  const startManualBridge = async () => {
    setBridgeBusy(true);
    try {
      await fetch('/api/bridge/start-manual', { method: 'POST' });
      show('Bridge launched. Complete login in the opened window.');
      await pollBridge();
    } catch {
      show('Failed to start bridge');
    } finally {
      setBridgeBusy(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pocket-app:history');
      if (raw) setHistory(JSON.parse(raw));
      const n = localStorage.getItem('pocket-app:notify-enabled');
      if (n === 'true') setNotifyEnabled(true);
      const c = localStorage.getItem('pocket-app:analysis-config');
      if (c) setConfig(JSON.parse(c));
      const a = localStorage.getItem('pocket-app:auto-analyze');
      if (a === 'true') setAutoAnalyze(true);
      const ai = localStorage.getItem('pocket-app:auto-interval');
      if (ai) {
        const v = parseInt(ai, 10);
        if (Number.isFinite(v) && v >= 5 && v <= 120) setAutoIntervalSec(v);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('pocket-app:history', JSON.stringify(history)); } catch {}
  }, [history]);

  useEffect(() => {
    try { localStorage.setItem('pocket-app:notify-enabled', notifyEnabled ? 'true' : 'false'); } catch {}
  }, [notifyEnabled]);

  useEffect(() => {
    try { localStorage.setItem('pocket-app:analysis-config', JSON.stringify(config)); } catch {}
  }, [config]);

  useEffect(() => {
    try { localStorage.setItem('pocket-app:auto-analyze', autoAnalyze ? 'true' : 'false'); } catch {}
  }, [autoAnalyze]);

  useEffect(() => {
    try { localStorage.setItem('pocket-app:auto-interval', String(autoIntervalSec)); } catch {}
  }, [autoIntervalSec]);

  const requestNotifications = async () => {
    try {
      if (!('Notification' in window)) {
        show('Notifications not supported by this browser');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setNotifyEnabled(true);
        show('Desktop alerts enabled');
      } else {
        setNotifyEnabled(false);
        show('Desktop alerts denied');
      }
    } catch {
      show('Failed to request notifications');
    }
  };

  const disableNotifications = () => {
    setNotifyEnabled(false);
    show('Desktop alerts disabled');
  };

  const maybeNotify = (title: string, body: string) => {
    if (!notifyEnabled) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body });
    } catch {}
  };

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair: selectedPair, expiry: selectedExpiry, options: config }),
      });
      const data = await res.json();
      setSignal(data);
      if (data && data.side) {
        setHistory((h) => [
          { id: crypto.randomUUID(), at: Date.now(), pair: selectedPair, expiry: selectedExpiry, result: data },
          ...h,
        ].slice(0, 50));
        const msg = `${selectedPair} ${selectedExpiry}: ${data.side} (${data.confidence}%)`;
        show(msg);
        maybeNotify('Pocket-APP Signal', msg);
      }
    } catch (e) {
      console.error(e);
      show('Failed to analyze signal');
    } finally {
      setLoading(false);
    }
  };

  // Auto analyze/watch mode
  useEffect(() => {
    if (!autoAnalyze) return;
    if (autoIntervalSec < 5) return;
    let busy = false;
    const run = async () => {
      if (busy || loading) return;
      if (bridgeStatus !== 'connected') return;
      busy = true;
      try { await analyze(); } catch {}
      busy = false;
    };
    const id = setInterval(run, autoIntervalSec * 1000);
    // Kick off immediately on enable
    run();
    return () => clearInterval(id);
  }, [autoAnalyze, autoIntervalSec, selectedPair, selectedExpiry, JSON.stringify(config), bridgeStatus, loading]);

  const clearHistory = () => setHistory([]);

  return (
    <div className="container-fluid min-vh-100 bg-light">
      {/* Header */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom">
        <div className="container-fluid">
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center justify-content-center rounded" style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#6f42c1,#0d6efd)' }}>
              <Activity className="text-white" style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h1 className="h5 mb-0">Pocket-APP</h1>
              <small className="text-muted">Trading Signal Analyzer</small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <ThemeToggle />
            {!notifyEnabled ? (
              <button onClick={requestNotifications} className="btn btn-outline-secondary btn-sm">Enable Desktop Alerts</button>
            ) : (
              <button onClick={disableNotifications} className="btn btn-outline-danger btn-sm">Disable Alerts</button>
            )}
            <button onClick={startManualBridge} disabled={bridgeBusy} className="btn btn-primary btn-sm">
              {bridgeBusy ? 'Starting…' : bridgeStatus === 'connected' ? 'Connected to Pocket Option' : 'Connect Pocket Option'}
            </button>
            <span className={"rounded-circle d-inline-block"} style={{ width: 10, height: 10, background: bridgeStatus === 'connected' ? '#28a745' : '#adb5bd' }} aria-label={`bridge-${bridgeStatus}`}></span>
            <span className="text-muted small">{bridgeStatus}{quotesCount ? ` • quotes:${quotesCount}` : ''}</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-4">
        {/* Bridge Setup Instructions for Deployed Environment */}
        <BridgeSetup />
        
        <div className="row g-4">
          {/* Trading Panel */}
          <div className="col-lg-8">
            {/* Currency Pair Selection */}
            <div className="mb-3">
              <CurrencyPairSelector selectedPair={selectedPair} onPairSelect={setSelectedPair} />
            </div>
            {/* Expiry Selection */}
            <div className="mb-3">
              <ExpirySelector selectedExpiry={selectedExpiry} onExpirySelect={setSelectedExpiry} />
            </div>
            <div className="mb-3">
              <AnalysisSettings value={config} onChange={setConfig} onReset={() => setConfig({})} />
            </div>
            <div className="card shadow-sm">
              <div className="card-body d-flex flex-column flex-sm-row align-items-center gap-2">
                <p className="mb-0 text-muted">Selected: {selectedPair} • {selectedExpiry}</p>
                <div className="ms-auto d-flex gap-2">
                  <button onClick={clearHistory} className="btn btn-outline-warning btn-sm">Clear History</button>
                  <button onClick={analyze} disabled={loading} className="btn btn-success btn-sm">
                    {loading ? 'Analyzing…' : 'Analyze & Get Signal'}
                  </button>
                </div>
              </div>
            </div>

            {/* Auto-analyze controls */}
            <div className="card shadow-sm mt-2">
              <div className="card-body d-flex flex-wrap align-items-center gap-3">
                <div className="form-check form-switch">
                  <input className="form-check-input" type="checkbox" role="switch" id="autoAnalyzeSwitch" checked={autoAnalyze} onChange={(e) => setAutoAnalyze(e.target.checked)} />
                  <label className="form-check-label" htmlFor="autoAnalyzeSwitch">Auto analyze</label>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <label htmlFor="autoInterval" className="text-muted small">Every</label>
                  <input id="autoInterval" type="number" min={5} max={120} className="form-control form-control-sm" style={{ width: 80 }} value={autoIntervalSec} onChange={(e) => setAutoIntervalSec(Math.max(5, Math.min(120, parseInt(e.target.value || '15', 10))))} />
                  <span className="text-muted small">sec</span>
                </div>
                <div className="text-muted small ms-auto">Bridge: {bridgeStatus}</div>
              </div>
            </div>

            {/* Compact components bar */}
            {signal?.components && signal.components.length > 0 && (
              <div className="card shadow-sm mt-2">
                <div className="card-body py-2">
                  <div className="d-flex flex-wrap gap-1">
                    {signal.components.map((c, idx) => (
                      <span key={idx} className={`badge ${c.score >= 0 ? 'bg-success' : 'bg-danger'}`} title={c.notes}>
                        {c.key} {c.score >= 0 ? '+' : ''}{c.score}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Screener */}
            <div className="mt-3">
              <Screener />
            </div>

            {/* Auto trade controls */}
            <div className="mt-3">
              <AutoTradeControls />
            </div>

            {/* Auto subscribe controls */}
            <div className="mt-3">
              <AutoSubscribeControls />
            </div>
          </div>

          {/* Signal Display */}
          <div className="col-lg-4">
            <div className="mb-3">
              <SignalCard signal={signal} pair={selectedPair} expiry={selectedExpiry} />
            </div>
            <div className="card shadow-sm mb-3">
              <div className="card-body">
                <h3 className="h6">Signal History</h3>
                {history.length === 0 ? (
                  <div className="text-muted small">No history yet.</div>
                ) : (
                  <div className="d-flex flex-column gap-2" style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {history.map((item) => (
                      <div key={item.id} className="d-flex justify-content-between align-items-center border rounded px-2 py-1 bg-light">
                        <div className="d-flex align-items-center gap-2 small">
                          <span className="font-monospace">{item.pair}</span>
                          <span className="text-muted">{item.expiry}</span>
                          <span className="fw-semibold">{item.result.side}</span>
                          <span className="text-muted">{item.result.confidence}%</span>
                        </div>
                        <div className="text-muted small">{new Date(item.at).toLocaleTimeString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="card shadow-sm">
              <div className="card-body">
                <h3 className="h6">Features</h3>
                <ul className="list-unstyled mb-0 small">
                  <li className="d-flex align-items-center gap-2"><Shield style={{ width: 16, height: 16 }} className="text-success" /> Stealth Authentication</li>
                  <li className="d-flex align-items-center gap-2"><Activity style={{ width: 16, height: 16 }} className="text-primary" /> Real-time Analysis</li>
                  <li className="d-flex align-items-center gap-2"><TrendingUp style={{ width: 16, height: 16 }} className="text-success" /> Institutional Strategies</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}