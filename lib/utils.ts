import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Trading utility functions
export function formatPrice(price: number, decimals: number = 4): string {
  return price.toFixed(decimals)
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function getSignalColor(signal: 'BUY' | 'SELL' | 'NEUTRAL'): string {
  switch (signal) {
    case 'BUY':
      return 'text-trading-buy'
    case 'SELL':
      return 'text-trading-sell'
    default:
      return 'text-trading-neutral'
  }
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-accent-success'
  if (confidence >= 60) return 'text-accent-warning'
  return 'text-accent-danger'
}
