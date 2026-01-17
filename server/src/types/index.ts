export interface Question {
  id: string;
  question: string;
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  proposal?: MarketProposal;
  error?: string;
}

export interface MarketProposal {
  question: string;
  description: string;
  outcomes: string[];
  resolutionCriteria: string;
  endDate: string;
}

export interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  outcomes: string[];
  volume: string;
  liquidity: string;
}
