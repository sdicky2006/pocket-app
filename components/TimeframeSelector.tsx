'use client';

import { useState } from 'react';
import { Clock, Zap, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Timeframe {
  id: string;
  label: string;
  value: string;
  description: string;
  category: 'scalping' | 'day' | 'swing' | 'position';
  minExpiry: string;
  maxExpiry: string;
  volatility: 'low' | 'medium' | 'high';
  recommended: boolean;
}

interface TimeframeSelectorProps {
  selectedTimeframe: string;
  onTimeframeSelect: (timeframe: string) => void;
  className?: string;
}

const timeframes: Timeframe[] = [
  {
    id: '1m',
    label: '1 Minute',
    value: '1m',
    description: 'Ultra-short scalping',
    category: 'scalping',
    minExpiry: '1m',
    maxExpiry: '5m',
    volatility: 'high',
    recommended: false,
  },
  {
    id: '5m',
    label: '5 Minutes',
    value: '5m',
    description: 'Short-term scalping',
    category: 'scalping',
    minExpiry: '5m',
    maxExpiry: '15m',
    volatility: 'high',
    recommended: true,
  },
  {
    id: '15m',
    label: '15 Minutes',
    value: '15m',
    description: 'Intraday trading',
    category: 'day',
    minExpiry: '15m',
    maxExpiry: '1h',
    volatility: 'medium',
    recommended: true,
  },
  {
    id: '30m',
    label: '30 Minutes',
    value: '30m',
    description: 'Medium-term analysis',
    category: 'day',
    minExpiry: '30m',
    maxExpiry: '2h',
    volatility: 'medium',
    recommended: false,
  },
  {
    id: '1h',
    label: '1 Hour',
    value: '1h',
    description: 'Hourly trend analysis',
    category: 'day',
    minExpiry: '1h',
    maxExpiry: '4h',
    volatility: 'medium',
    recommended: true,
  },
  {
    id: '4h',
    label: '4 Hours',
    value: '4h',
    description: 'Swing trading',
    category: 'swing',
    minExpiry: '4h',
    maxExpiry: '1d',
    volatility: 'low',
    recommended: false,
  },
  {
    id: '1d',
    label: '1 Day',
    value: '1d',
    description: 'Daily analysis',
    category: 'position',
    minExpiry: '1d',
    maxExpiry: '1w',
    volatility: 'low',
    recommended: false,
  },
];

const categoryInfo = {
  scalping: {
    name: 'Scalping',
    icon: Zap,
    color: 'text-accent-danger',
    bgColor: 'bg-accent-danger/10',
    borderColor: 'border-accent-danger/20',
    description: 'Quick, high-frequency trades'
  },
  day: {
    name: 'Day Trading',
    icon: TrendingUp,
    color: 'text-accent-primary',
    bgColor: 'bg-accent-primary/10',
    borderColor: 'border-accent-primary/20',
    description: 'Intraday position management'
  },
  swing: {
    name: 'Swing Trading',
    icon: BarChart3,
    color: 'text-accent-secondary',
    bgColor: 'bg-accent-secondary/10',
    borderColor: 'border-accent-secondary/20',
    description: 'Multi-day trend following'
  },
  position: {
    name: 'Position Trading',
    icon: Clock,
    color: 'text-accent-warning',
    bgColor: 'bg-accent-warning/10',
    borderColor: 'border-accent-warning/20',
    description: 'Long-term trend analysis'
  },
};

export default function TimeframeSelector({ selectedTimeframe, onTimeframeSelect, className }: TimeframeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', name: 'All Timeframes', count: timeframes.length },
    { id: 'scalping', name: 'Scalping', count: timeframes.filter(t => t.category === 'scalping').length },
    { id: 'day', name: 'Day Trading', count: timeframes.filter(t => t.category === 'day').length },
    { id: 'swing', name: 'Swing', count: timeframes.filter(t => t.category === 'swing').length },
    { id: 'position', name: 'Position', count: timeframes.filter(t => t.category === 'position').length },
  ];

  const filteredTimeframes = timeframes.filter(timeframe => 
    selectedCategory === 'all' || timeframe.category === selectedCategory
  );

  const getVolatilityColor = (volatility: string) => {
    switch (volatility) {
      case 'high': return 'text-accent-danger';
      case 'medium': return 'text-accent-warning';
      case 'low': return 'text-accent-success';
      default: return 'text-text-muted';
    }
  };

  const getVolatilityBg = (volatility: string) => {
    switch (volatility) {
      case 'high': return 'bg-accent-danger/10';
      case 'medium': return 'bg-accent-warning/10';
      case 'low': return 'bg-accent-success/10';
      default: return 'bg-surface-secondary';
    }
  };

  return (
    <div className={cn("trading-card p-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center">
          <Clock className="w-5 h-5 mr-2 text-accent-secondary" />
          Timeframe Selection
        </h2>
        <div className="text-sm text-text-muted">
          {filteredTimeframes.length} timeframes
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
              selectedCategory === category.id
                ? "bg-accent-secondary text-white"
                : "bg-surface-elevated text-text-secondary hover:bg-surface-secondary border border-border-primary"
            )}
          >
            {category.name} ({category.count})
          </button>
        ))}
      </div>

      {/* Timeframe Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {filteredTimeframes.map((timeframe) => {
          const categoryData = categoryInfo[timeframe.category];
          const IconComponent = categoryData.icon;
          
          return (
            <div
              key={timeframe.id}
              onClick={() => onTimeframeSelect(timeframe.value)}
              className={cn(
                "p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:transform hover:scale-[1.02]",
                selectedTimeframe === timeframe.value
                  ? "border-accent-secondary bg-accent-secondary/10 shadow-lg"
                  : "border-border-primary hover:border-accent-secondary/50 hover:bg-surface-elevated"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    "p-1.5 rounded-lg",
                    categoryData.bgColor,
                    categoryData.borderColor,
                    "border"
                  )}>
                    <IconComponent className={cn("w-4 h-4", categoryData.color)} />
                  </div>
                  {timeframe.recommended && (
                    <span className="px-2 py-0.5 bg-accent-success/20 text-accent-success text-xs font-medium rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <div className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium",
                  getVolatilityBg(timeframe.volatility),
                  getVolatilityColor(timeframe.volatility)
                )}>
                  {timeframe.volatility.toUpperCase()}
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-text-primary text-lg">
                  {timeframe.label}
                </div>
                <div className="text-sm text-text-secondary">
                  {timeframe.description}
                </div>
                <div className="text-xs text-text-muted">
                  Expiry: {timeframe.minExpiry} - {timeframe.maxExpiry}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-secondary">
                <span className={cn(
                  "text-xs font-medium",
                  categoryData.color
                )}>
                  {categoryData.name}
                </span>
                <span className="text-xs text-text-muted font-mono">
                  {timeframe.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Timeframe Info */}
      {selectedTimeframe && (
        <div className="bg-surface-elevated rounded-lg p-4 border border-border-secondary">
          <h3 className="font-medium text-text-primary mb-2">Selected Timeframe Analysis</h3>
          {(() => {
            const selected = timeframes.find(t => t.value === selectedTimeframe);
            if (!selected) return null;
            
            const categoryData = categoryInfo[selected.category];
            const IconComponent = categoryData.icon;
            
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <IconComponent className={cn("w-4 h-4", categoryData.color)} />
                  <span className="text-text-secondary">Strategy:</span>
                  <span className="text-text-primary font-medium">{categoryData.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-accent-primary" />
                  <span className="text-text-secondary">Optimal Expiry:</span>
                  <span className="text-text-primary font-medium">{selected.minExpiry} - {selected.maxExpiry}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-accent-warning" />
                  <span className="text-text-secondary">Volatility:</span>
                  <span className={cn("font-medium", getVolatilityColor(selected.volatility))}>
                    {selected.volatility.charAt(0).toUpperCase() + selected.volatility.slice(1)}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
