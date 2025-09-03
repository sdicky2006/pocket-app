export interface MarketProvider {
  getRecentCloses(pair: string, limit: number): Promise<number[]>;
}
