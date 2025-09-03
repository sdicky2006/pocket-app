'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Star, TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketStore } from '@/lib/marketStore';

interface CurrencyPair {
  id: string;
  symbol: string;
  name: string;
  category: 'major' | 'minor' | 'exotic' | 'crypto';
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  isActive: boolean;
  lastUpdate: number;
  payout?: number; // percentage (e.g., 92)
}

interface CurrencyPairSelectorProps {
  selectedPair: string;
  onPairSelect: (pair: string) => void;
  className?: string;
}

export default function CurrencyPairSelector({ selectedPair, onPairSelect, className }: CurrencyPairSelectorProps) {
  const [pairs, setPairs] = useState<CurrencyPair[]>([]);
  const liveBySymbol = useMarketStore((s) => s.bySymbol);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'symbol' | 'change' | 'volume'>('symbol');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(false);
  const [onlyHighPayout, setOnlyHighPayout] = useState(false);

  const triesRef = useRef(0);

  const loadPairs = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/pairs', { cache: 'no-store' });
      const d = await r.json();
      setPairs(Array.isArray(d?.pairs) ? d.pairs : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    // initial load
    loadPairs();
    // quick retry loop for late-arriving quotes
    triesRef.current = 0;
    const id = setInterval(() => {
      if (cancelled) return;
      if (pairs.length > 0 || triesRef.current >= 10) { clearInterval(id); return; }
      triesRef.current += 1;
      loadPairs();
    }, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Merge live prices from store
  const pairsWithLive = useMemo(() => (
    pairs.map((p) => {
      const key = p.symbol.toUpperCase();
      const live = liveBySymbol[key];
      if (!live) return p;
      return {
        ...p,
        price: typeof live.price === 'number' ? live.price : p.price,
        lastUpdate: live.lastUpdate || p.lastUpdate,
      };
    })
  ), [pairs, liveBySymbol]);

  const categories = useMemo(() => ([
    { id: 'all', name: 'All', count: pairsWithLive.length },
    { id: 'Currency', name: 'Currency', count: pairsWithLive.filter(p => p.category === 'major' || p.category === 'minor').length },
    { id: 'Cryptocurrencies', name: 'Cryptocurrencies', count: pairsWithLive.filter(p => p.category === 'crypto').length },
    { id: 'Commodities', name: 'Commodities', count: pairsWithLive.filter(p => /XAU|XAG|OIL|NG|COPPER|GOLD|SILVER/.test(p.symbol)).length },
    { id: 'Stocks', name: 'Stocks', count: pairsWithLive.filter(p => !(p.symbol.includes('/') || /BTC|ETH|XAU|XAG|OIL|NG/.test(p.symbol))).length },
    { id: 'Indices', name: 'Indices', count: pairsWithLive.filter(p => /(US30|SPX|NAS|GER|UK100|FR40|JP225|HK50|AU200)/.test(p.symbol)).length },
  ]), [pairsWithLive]);

  const filteredPairs = useMemo(() => (
    pairsWithLive
      .filter(pair => {
        const matchesSearch = pair.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             pair.name.toLowerCase().includes(searchQuery.toLowerCase());
        const isFav = favorites[pair.id] === true;
        const matchesFavorites = !showFavoritesOnly || isFav;
        let matchesCategory = selectedCategory === 'all';
        if (!matchesCategory) {
          if (selectedCategory === 'Currency') matchesCategory = pair.category === 'major' || pair.category === 'minor';
          else if (selectedCategory === 'Cryptocurrencies') matchesCategory = pair.category === 'crypto';
          else if (selectedCategory === 'Commodities') matchesCategory = /(XAU|XAG|OIL|NG|COPPER|GOLD|SILVER)/.test(pair.symbol);
          else if (selectedCategory === 'Indices') matchesCategory = /(US30|SPX|NAS|GER|UK100|FR40|JP225|HK50|AU200)/.test(pair.symbol);
          else if (selectedCategory === 'Stocks') matchesCategory = !(pair.symbol.includes('/') || /BTC|ETH|XAU|XAG|OIL|NG/.test(pair.symbol));
        }
        const payoutOk = !onlyHighPayout || (typeof pair.payout === 'number' && pair.payout >= 92);
        return matchesSearch && matchesCategory && matchesFavorites && pair.isActive && payoutOk;
      })
      .sort((a, b) => {
        let aValue: any, bValue: any;
        switch (sortBy) {
          case 'change':
            aValue = a.changePercent; bValue = b.changePercent; break;
          case 'volume':
            aValue = a.volume; bValue = b.volume; break;
          default:
            aValue = a.symbol; bValue = b.symbol;
        }
        if (sortOrder === 'asc') return aValue > bValue ? 1 : -1;
        return aValue < bValue ? 1 : -1;
      })
  ), [pairsWithLive, searchQuery, selectedCategory, showFavoritesOnly, favorites, sortBy, sortOrder]);

  const formatPrice = (price: number, isChange: boolean = false) => {
    if (isChange) return price >= 0 ? `+${price.toFixed(4)}` : price.toFixed(4);
    return price.toFixed(price > 100 ? 2 : 4);
  };

  const formatVolume = (volume: number) => volume >= 1_000_000 ? `${(volume / 1_000_000).toFixed(1)}M` : `${(volume / 1_000).toFixed(0)}K`;

  const getLastUpdateText = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div className={cn("trading-card p-3", className)}>
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h5 d-flex align-items-center m-0">
          <Activity className="w-5 h-5 mr-2 text-accent-primary" />
          Currency Pairs
        </h2>
        <div className="d-flex align-items-center gap-2">
          <div className="text-muted small">{loading ? 'Loading…' : `${filteredPairs.length} pairs available`}</div>
          <button onClick={loadPairs} className="btn btn-outline-secondary btn-sm">Reload</button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4 mb-6">
        {/* Search */}
        <div className="position-relative">
          <Search className="position-absolute" style={{ left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#6c757d' }} />
          <input type="text" placeholder="Search currency pairs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="form-control ps-5" />
        </div>

        {/* Category Filters */}
        <div className="d-flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn("btn btn-sm",
                selectedCategory === category.id ? "btn-primary" : "btn-outline-secondary"
              )}
            >
              {category.name} ({category.count})
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="d-flex align-items-center justify-content-between">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={cn("btn btn-sm d-flex align-items-center gap-2",
              showFavoritesOnly ? "btn-warning" : "btn-outline-secondary"
            )}
          >
            <Star className={cn("w-4 h-4", showFavoritesOnly && "fill-current") } />
            <span>Favorites Only</span>
          </button>

          <div className="d-flex align-items-center gap-2">
            <div className="form-check form-switch me-3">
              <input className="form-check-input" type="checkbox" id="highPayoutOnly" checked={onlyHighPayout} onChange={(e)=>setOnlyHighPayout(e.target.checked)} />
              <label className="form-check-label small" htmlFor="highPayoutOnly">92% payout only</label>
            </div>
            <span className="text-muted small">Sort by:</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'symbol' | 'change' | 'volume')} className="form-select form-select-sm" style={{ width: 160 }}>
              <option value="symbol">Symbol</option>
              <option value="change">Change</option>
              <option value="volume">Volume</option>
            </select>
            <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="btn btn-outline-secondary btn-sm">
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Currency Pairs List */}
      <div className="d-flex flex-column gap-2" style={{ maxHeight: 384, overflowY: 'auto' }}>
        {filteredPairs.map((pair) => (
          <div
            key={pair.id}
            onClick={() => onPairSelect(pair.symbol)}
            className={cn("p-2 border rounded cursor-pointer",
              selectedPair === pair.symbol ? "border-primary bg-primary bg-opacity-10" : "border-secondary"
            )}
          >
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-3">
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="font-monospace fw-semibold">
                      {pair.symbol}
                    </span>
                    {favorites[pair.id] && (
                      <Star className="text-warning" style={{ width: 12, height: 12 }} />
                    )}
                    <span className={cn("badge",
                      pair.category === 'major' ? "bg-success" :
                      pair.category === 'crypto' ? "bg-info" : "bg-secondary"
                    )}>{pair.category.toUpperCase()}</span>
                    {typeof pair.payout === 'number' && (
                      <span className={cn('badge', pair.payout >= 92 ? 'bg-primary' : 'bg-secondary')} title="Payout">
                        {pair.payout}%
                      </span>
                    )}
                  </div>
                  <div className="small text-muted mt-1">{pair.name}</div>
                </div>
              </div>

              <div className="text-end">
                <div className="font-monospace fw-medium">
                  {formatPrice(pair.price)}
                </div>
                <div className={cn("small d-flex align-items-center justify-content-end gap-1",
                  pair.changePercent >= 0 ? "text-success" : "text-danger"
                )}>
                  {pair.changePercent >= 0 ? (
                    <TrendingUp style={{ width: 12, height: 12 }} />
                  ) : (
                    <TrendingDown style={{ width: 12, height: 12 }} />
                  )}
                  <span>{formatPrice(pair.change, true)}</span>
                  <span>({pair.changePercent >= 0 ? '+' : ''}{pair.changePercent.toFixed(2)}%)</span>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between mt-2 text-muted small">
              <div className="d-flex align-items-center gap-1">
                <Activity style={{ width: 12, height: 12 }} />
                <span>Vol: {formatVolume(pair.volume)}</span>
              </div>
              <div className="d-flex align-items-center gap-1">
                <Clock style={{ width: 12, height: 12 }} />
                <span>{getLastUpdateText(pair.lastUpdate)}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFavorites((f) => ({ ...f, [pair.id]: !f[pair.id] })); }}
                className="btn btn-outline-warning btn-sm"
              >
                {favorites[pair.id] ? 'Unfavorite' : 'Favorite'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {!loading && filteredPairs.length === 0 && (
        <div className="text-center py-8">
          <Activity className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-50" />
          <h3 className="text-text-secondary font-medium mb-1">No pairs found</h3>
          <p className="text-sm text-text-muted">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
}
