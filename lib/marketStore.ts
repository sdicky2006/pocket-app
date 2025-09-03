"use client";

import { create } from "zustand";

export type MarketSnapshot = {
  symbol: string; // e.g., EUR/USD
  price: number;
  prevPrice?: number;
  volume?: number;
  lastUpdate: number;
};

type MarketState = {
  bySymbol: Record<string, MarketSnapshot>;
  applyUpdate: (update: { symbol: string; price?: number; volume?: number; ts?: number }) => void;
};

export const useMarketStore = create<MarketState>((set) => ({
  bySymbol: {},
  applyUpdate: ({ symbol, price, volume, ts }) =>
    set((state) => {
      const key = symbol.toUpperCase();
      const prev = state.bySymbol[key];
      const next: MarketSnapshot = {
        symbol: key,
        price: price ?? prev?.price ?? 0,
        prevPrice: price !== undefined ? prev?.price : prev?.prevPrice,
        volume: volume ?? prev?.volume,
        lastUpdate: ts ?? Date.now(),
      };
      return { bySymbol: { ...state.bySymbol, [key]: next } };
    }),
}));


