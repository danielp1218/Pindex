export interface PolymarketMarket {
  id: string;
  condition_id?: string;
  market_slug?: string;
  event_slug?: string;
  question: string;
  description: string;
  outcomes?: string[];
  tokens?: Array<{ outcome: string; price: number }>;
  volume: string;
  liquidity: string;
}

export type BetRelationship =
  | 'IMPLIES'          // Related outcome implies source outcome
  | 'CONTRADICTS'      // Outcomes cannot both be true
  | 'PARTITION_OF'     // Part of the same larger question
  | 'SUBEVENT'         // A component event that affects the outcome
  | 'CONDITIONED_ON'   // Depends on this outcome
  | 'WEAK_SIGNAL';     // Indirectly related, weak correlation

export interface RelatedBet {
  marketId: string;
  market: PolymarketMarket;
  relationship: BetRelationship;
  reasoning: string;
  yesPercentage: number; 
  noPercentage: number;
}
