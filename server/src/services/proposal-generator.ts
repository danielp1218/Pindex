import { generateMarketProposal } from '../lib/openai';
import type { MarketProposal } from '../types';

export async function createMarketProposal(question: string): Promise<MarketProposal> {
  return await generateMarketProposal(question);
}
