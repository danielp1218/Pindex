// polymarket layer

import type { PolymarketMarket } from '../types';

const POLYMARKET_API = 'https://clob.polymarket.com';

export async function fetchMarkets(): Promise<PolymarketMarket[]> {
  const response = await fetch(`${POLYMARKET_API}/markets`);
  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.statusText}`);
  }
  const data = await response.json();
  return data as PolymarketMarket[];
}

export async function fetchMarket(id: string): Promise<PolymarketMarket> {
  const response = await fetch(`${POLYMARKET_API}/markets/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch market: ${response.statusText}`);
  }
  const data = await response.json();
  return data as PolymarketMarket;
}

export async function searchMarkets(query: string): Promise<PolymarketMarket[]> {
  const markets = await fetchMarkets();
  return markets.filter(m =>
    m.question?.toLowerCase().includes(query.toLowerCase())
  );
}
