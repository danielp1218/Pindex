import { fetchDependencies, type DependencyDecision, type DependenciesResponse } from './dependenciesApi';
import {
  getDependencyState,
  setDependencyState,
  type DependencyQueueItem,
  getEventIdFromUrl,
} from './eventStorage';

interface ProcessDecisionInput {
  eventUrl: string;
  keep: boolean;
  fallbackDecision?: DependencyDecision;
  fallbackWeight?: number;
  risk?: number;
}

export interface DependencyDecisionResult {
  response?: DependenciesResponse;
  queue: DependencyQueueItem[];
  visited: string[];
}

function toUnique(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean)));
}

function extractQueueUrls(items: DependencyQueueItem[]): string[] {
  return items.map(item => item.url).filter(Boolean);
}

function extractQueueIds(items: DependencyQueueItem[]): string[] {
  return items.map(item => item.id).filter(Boolean);
}

function deduplicateQueue(items: DependencyQueueItem[]): DependencyQueueItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normalizeRisk(value: number | undefined): number {
  if (!Number.isFinite(value ?? NaN)) {
    return 50;
  }
  if ((value as number) < 0) {
    return 0;
  }
  if ((value as number) > 100) {
    return 100;
  }
  return value as number;
}

// Topic detection for sample fallback
type TopicType = 'politics' | 'crypto' | 'sports' | 'economy' | 'default';

function detectTopic(question: string, slug: string): TopicType {
  const text = `${question} ${slug}`.toLowerCase();

  // Politics keywords
  const politicsKeywords = [
    'trump', 'biden', 'republican', 'democrat', 'senate', 'congress',
    'election', 'president', 'governor', 'vote', 'political', 'gop',
    'white house', 'cabinet', 'nomination', 'impeach', 'legislation'
  ];
  if (politicsKeywords.some(kw => text.includes(kw))) {
    return 'politics';
  }

  // Crypto keywords
  const cryptoKeywords = [
    'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'blockchain',
    'solana', 'sol', 'dogecoin', 'doge', 'token', 'defi', 'nft'
  ];
  if (cryptoKeywords.some(kw => text.includes(kw))) {
    return 'crypto';
  }

  // Sports keywords
  const sportsKeywords = [
    'nba', 'nfl', 'mlb', 'nhl', 'championship', 'playoff', 'super bowl',
    'world series', 'finals', 'lakers', 'celtics', 'yankees', 'soccer',
    'football', 'basketball', 'baseball', 'hockey', 'tennis', 'golf'
  ];
  if (sportsKeywords.some(kw => text.includes(kw))) {
    return 'sports';
  }

  // Economy keywords
  const economyKeywords = [
    'gdp', 'inflation', 'fed', 'interest rate', 'recession', 'stock',
    'market', 's&p', 'nasdaq', 'dow', 'economy', 'unemployment', 'cpi'
  ];
  if (economyKeywords.some(kw => text.includes(kw))) {
    return 'economy';
  }

  return 'default';
}

interface SampleData {
  url: string;
  question: string;
  relation: string;
  explanation: string;
  imageUrl: string; // empty string = fetch real image from Polymarket
  probability: number;
  yesPercentage: number;
  noPercentage: number;
}

// AI Bubble Burst specific dependencies
interface AiBubbleDependency extends SampleData {
  id: string;
  parentId: string | null; // null = root level
}

const S3_BASE_AI = 'https://polymarket-upload.s3.us-east-2.amazonaws.com/';

// Detect if we're on an AI bubble burst event page
function isAiBubbleBurstEvent(url: string): boolean {
  const normalizedUrl = url.toLowerCase();
  return normalizedUrl.includes('ai-bubble-burst') ||
         normalizedUrl.includes('ai-industry-downturn') ||
         normalizedUrl.includes('ai-winter');
}

// 50 hardcoded AI bubble burst dependencies in tree structure
const AI_BUBBLE_BURST_DEPENDENCIES: AiBubbleDependency[] = [
  // ============================================
  // LEVEL 1 (ROOT) - First 5 shown initially
  // ============================================
  {
    id: 'ai-bubble-1',
    parentId: null,
    url: 'https://polymarket.com/event/which-company-has-the-best-ai-model-end-of-january',
    question: 'Which company will have the best AI model by end of January 2026?',
    relation: 'IMPLIES',
    explanation: 'AI model leadership determines valuations - key indicator of bubble health',
    imageUrl: `${S3_BASE_AI}which-company-has-best-ai-model-end-of-september-MmASwbTkwKHi.jpg`,
    probability: 0.72,
    yesPercentage: 72,
    noPercentage: 28,
  },
  {
    id: 'ai-bubble-2',
    parentId: null,
    url: 'https://polymarket.com/event/nvidia-stock-price-end-of-2026',
    question: 'Will NVIDIA stock reach $200 by end of 2026?',
    relation: 'IMPLIES',
    explanation: 'NVIDIA stock is the bellwether for AI bubble - major decline signals burst',
    imageUrl: `${S3_BASE_AI}nvidia-logo.png`,
    probability: 0.45,
    yesPercentage: 45,
    noPercentage: 55,
  },
  {
    id: 'ai-bubble-3',
    parentId: null,
    url: 'https://polymarket.com/event/openai-ipo-by',
    question: 'Will OpenAI go public by December 2026?',
    relation: 'CONDITIONED_ON',
    explanation: 'OpenAI going public signals AI market maturity; delays signal trouble',
    imageUrl: `${S3_BASE_AI}openai-ipo-by-qeh3ouQDANVw.jpg`,
    probability: 0.28,
    yesPercentage: 28,
    noPercentage: 72,
  },
  {
    id: 'ai-bubble-4',
    parentId: null,
    url: 'https://polymarket.com/event/fed-decision-in-january',
    question: 'Will the Fed cut interest rates in January 2026?',
    relation: 'IMPLIES',
    explanation: 'Aggressive rate cuts often signal economic stress and market correction',
    imageUrl: `${S3_BASE_AI}jerome+powell+glasses1.png`,
    probability: 0.35,
    yesPercentage: 35,
    noPercentage: 65,
  },
  {
    id: 'ai-bubble-5',
    parentId: null,
    url: 'https://polymarket.com/event/anthropic-ipo-closing-market-cap',
    question: "What will be Anthropic's market cap at IPO?",
    relation: 'CORRELATED',
    explanation: 'Anthropic valuation reflects AI sector investment sentiment',
    imageUrl: `${S3_BASE_AI}anthropic-ipo-closing-market-cap-jdfele1g0krx.png`,
    probability: 0.38,
    yesPercentage: 38,
    noPercentage: 62,
  },

  // ============================================
  // BRANCH 1: AI Model Leadership (children of ai-bubble-1)
  // ============================================
  {
    id: 'ai-bubble-1-1',
    parentId: 'ai-bubble-1',
    url: 'https://polymarket.com/event/grok-4pt20-released-by',
    question: 'Will xAI release Grok 4.20 before March 2026?',
    relation: 'CONDITIONED_ON',
    explanation: 'Grok release timing indicates xAI competitive position',
    imageUrl: `${S3_BASE_AI}grok-4pt20-released-by-FREAnoCYA7aN.jpg`,
    probability: 0.45,
    yesPercentage: 45,
    noPercentage: 55,
  },
  {
    id: 'ai-bubble-1-2',
    parentId: 'ai-bubble-1',
    url: 'https://polymarket.com/event/gpt-5-release-date',
    question: 'When will OpenAI release GPT-5?',
    relation: 'IMPLIES',
    explanation: 'GPT-5 release impacts AI leadership and market expectations',
    imageUrl: `${S3_BASE_AI}openai-ipo-by-qeh3ouQDANVw.jpg`,
    probability: 0.52,
    yesPercentage: 52,
    noPercentage: 48,
  },
  {
    id: 'ai-bubble-1-3',
    parentId: 'ai-bubble-1',
    url: 'https://polymarket.com/event/claude-model-rankings-2026',
    question: 'Will Claude be ranked #1 AI model in 2026?',
    relation: 'CORRELATED',
    explanation: 'Claude rankings reflect Anthropic competitive strength',
    imageUrl: `${S3_BASE_AI}anthropic-ipo-closing-market-cap-jdfele1g0krx.png`,
    probability: 0.35,
    yesPercentage: 35,
    noPercentage: 65,
  },
  {
    id: 'ai-bubble-1-4',
    parentId: 'ai-bubble-1',
    url: 'https://polymarket.com/event/gemini-2-0-launch',
    question: 'Will Google release Gemini 2.0 in Q1 2026?',
    relation: 'CORRELATED',
    explanation: 'Gemini progress indicates Google AI investment commitment',
    imageUrl: `${S3_BASE_AI}google-ai-logo.png`,
    probability: 0.68,
    yesPercentage: 68,
    noPercentage: 32,
  },
  {
    id: 'ai-bubble-1-5',
    parentId: 'ai-bubble-1',
    url: 'https://polymarket.com/event/meta-llama-4-release',
    question: 'Will Meta release Llama 4 before June 2026?',
    relation: 'WEAK_SIGNAL',
    explanation: 'Open source AI progress affects industry dynamics',
    imageUrl: `${S3_BASE_AI}meta-ai-logo.png`,
    probability: 0.55,
    yesPercentage: 55,
    noPercentage: 45,
  },
  {
    id: 'ai-bubble-1-6',
    parentId: 'ai-bubble-1',
    url: 'https://polymarket.com/event/apple-ai-model-2026',
    question: 'Will Apple launch a competitive AI model in 2026?',
    relation: 'WEAK_SIGNAL',
    explanation: 'Apple AI entry signals mainstream market maturation',
    imageUrl: `${S3_BASE_AI}apple-ai-logo.png`,
    probability: 0.42,
    yesPercentage: 42,
    noPercentage: 58,
  },
  {
    id: 'ai-bubble-1-7',
    parentId: 'ai-bubble-1',
    url: 'https://polymarket.com/event/amazon-ai-model-2026',
    question: 'Will Amazon release a frontier AI model in 2026?',
    relation: 'WEAK_SIGNAL',
    explanation: 'Amazon AI investment signals cloud provider competition',
    imageUrl: `${S3_BASE_AI}amazon-ai-logo.png`,
    probability: 0.38,
    yesPercentage: 38,
    noPercentage: 62,
  },
  {
    id: 'ai-bubble-1-8',
    parentId: 'ai-bubble-1',
    url: 'https://polymarket.com/event/will-elon-musk-win-his-case-against-sam-altman',
    question: 'Will Elon Musk win his lawsuit against Sam Altman?',
    relation: 'CONDITIONED_ON',
    explanation: 'Legal outcomes affect OpenAI structure and AI industry dynamics',
    imageUrl: `${S3_BASE_AI}will-elon-musk-win-his-case-against-sam-altman-3b7rjuMNHGHy.jpg`,
    probability: 0.35,
    yesPercentage: 35,
    noPercentage: 65,
  },

  // ============================================
  // BRANCH 2: NVIDIA/Chips (children of ai-bubble-2)
  // ============================================
  {
    id: 'ai-bubble-2-1',
    parentId: 'ai-bubble-2',
    url: 'https://polymarket.com/event/amd-market-cap-2026',
    question: "Will AMD's market cap exceed $300B in 2026?",
    relation: 'CORRELATED',
    explanation: 'AMD valuation reflects AI chip market competition',
    imageUrl: `${S3_BASE_AI}amd-logo.png`,
    probability: 0.32,
    yesPercentage: 32,
    noPercentage: 68,
  },
  {
    id: 'ai-bubble-2-2',
    parentId: 'ai-bubble-2',
    url: 'https://polymarket.com/event/intel-turnaround-2026',
    question: 'Will Intel return to profitability by Q4 2026?',
    relation: 'WEAK_SIGNAL',
    explanation: 'Intel recovery affects overall semiconductor market health',
    imageUrl: `${S3_BASE_AI}intel-logo.png`,
    probability: 0.45,
    yesPercentage: 45,
    noPercentage: 55,
  },
  {
    id: 'ai-bubble-2-3',
    parentId: 'ai-bubble-2',
    url: 'https://polymarket.com/event/semiconductor-etf-price-2026',
    question: 'Will SOXX ETF reach $300 by end of 2026?',
    relation: 'IMPLIES',
    explanation: 'Semiconductor ETF reflects overall chip sector health',
    imageUrl: `${S3_BASE_AI}soxx-etf-logo.png`,
    probability: 0.48,
    yesPercentage: 48,
    noPercentage: 52,
  },
  {
    id: 'ai-bubble-2-4',
    parentId: 'ai-bubble-2',
    url: 'https://polymarket.com/event/h100-rental-prices-2026',
    question: 'Will H100 rental prices drop 50% by end of 2026?',
    relation: 'CONTRADICTS',
    explanation: 'GPU rental price crash signals oversupply and bubble burst',
    imageUrl: `${S3_BASE_AI}nvidia-logo.png`,
    probability: 0.38,
    yesPercentage: 38,
    noPercentage: 62,
  },
  {
    id: 'ai-bubble-2-5',
    parentId: 'ai-bubble-2',
    url: 'https://polymarket.com/event/taiwan-china-conflict-2026',
    question: 'Will China take military action against Taiwan in 2026?',
    relation: 'IMPLIES',
    explanation: 'Taiwan conflict would devastate chip supply chains',
    imageUrl: `${S3_BASE_AI}taiwan-china-conflict.jpg`,
    probability: 0.08,
    yesPercentage: 8,
    noPercentage: 92,
  },
  {
    id: 'ai-bubble-2-6',
    parentId: 'ai-bubble-2',
    url: 'https://polymarket.com/event/us-chip-export-restrictions-2026',
    question: 'Will US expand chip export restrictions in 2026?',
    relation: 'CONDITIONED_ON',
    explanation: 'Export restrictions affect AI chip demand and company revenues',
    imageUrl: `${S3_BASE_AI}us-chip-export.png`,
    probability: 0.62,
    yesPercentage: 62,
    noPercentage: 38,
  },
  {
    id: 'ai-bubble-2-7',
    parentId: 'ai-bubble-2',
    url: 'https://polymarket.com/event/data-center-capex-2026',
    question: 'Will data center CapEx exceed $300B globally in 2026?',
    relation: 'IMPLIES',
    explanation: 'Data center spending reflects AI infrastructure investment',
    imageUrl: `${S3_BASE_AI}data-center-logo.png`,
    probability: 0.72,
    yesPercentage: 72,
    noPercentage: 28,
  },
  {
    id: 'ai-bubble-2-8',
    parentId: 'ai-bubble-2',
    url: 'https://polymarket.com/event/qualcomm-ai-chips-2026',
    question: 'Will Qualcomm AI chip revenue exceed $10B in 2026?',
    relation: 'CORRELATED',
    explanation: 'Mobile AI chip growth indicates edge AI market health',
    imageUrl: `${S3_BASE_AI}qualcomm-logo.png`,
    probability: 0.45,
    yesPercentage: 45,
    noPercentage: 55,
  },
  {
    id: 'ai-bubble-2-9',
    parentId: 'ai-bubble-2',
    url: 'https://polymarket.com/event/broadcom-ai-revenue-2026',
    question: "Will Broadcom's AI revenue exceed $15B in 2026?",
    relation: 'CORRELATED',
    explanation: 'Broadcom AI networking revenue reflects data center build-out',
    imageUrl: `${S3_BASE_AI}broadcom-logo.png`,
    probability: 0.58,
    yesPercentage: 58,
    noPercentage: 42,
  },
  {
    id: 'ai-bubble-2-10',
    parentId: 'ai-bubble-2',
    url: 'https://polymarket.com/event/semiconductor-shortage-2026',
    question: 'Will there be a semiconductor shortage in 2026?',
    relation: 'CONTRADICTS',
    explanation: 'Shortage would indicate strong demand; oversupply signals bubble',
    imageUrl: `${S3_BASE_AI}semiconductor-shortage.png`,
    probability: 0.22,
    yesPercentage: 22,
    noPercentage: 78,
  },

  // ============================================
  // BRANCH 3: OpenAI/Big AI (children of ai-bubble-3)
  // ============================================
  {
    id: 'ai-bubble-3-1',
    parentId: 'ai-bubble-3',
    url: 'https://polymarket.com/event/microsoft-ai-investment-2026',
    question: 'Will Microsoft invest another $10B+ in OpenAI in 2026?',
    relation: 'IMPLIES',
    explanation: 'Microsoft investment signals confidence in AI market',
    imageUrl: `${S3_BASE_AI}microsoft-logo.png`,
    probability: 0.42,
    yesPercentage: 42,
    noPercentage: 58,
  },
  {
    id: 'ai-bubble-3-2',
    parentId: 'ai-bubble-3',
    url: 'https://polymarket.com/event/google-ai-announcements-io-2026',
    question: 'Will Google announce major AI breakthroughs at I/O 2026?',
    relation: 'CORRELATED',
    explanation: 'Google AI progress affects competitive landscape',
    imageUrl: `${S3_BASE_AI}google-ai-logo.png`,
    probability: 0.85,
    yesPercentage: 85,
    noPercentage: 15,
  },
  {
    id: 'ai-bubble-3-3',
    parentId: 'ai-bubble-3',
    url: 'https://polymarket.com/event/openai-revenue-2026',
    question: 'Will OpenAI revenue exceed $10B in 2026?',
    relation: 'IMPLIES',
    explanation: 'OpenAI revenue growth validates AI market opportunity',
    imageUrl: `${S3_BASE_AI}openai-ipo-by-qeh3ouQDANVw.jpg`,
    probability: 0.65,
    yesPercentage: 65,
    noPercentage: 35,
  },
  {
    id: 'ai-bubble-3-4',
    parentId: 'ai-bubble-3',
    url: 'https://polymarket.com/event/ai-startup-valuations-2026',
    question: 'Will AI startup median valuation drop 40%+ in 2026?',
    relation: 'CONTRADICTS',
    explanation: 'Valuation crash signals AI bubble burst',
    imageUrl: `${S3_BASE_AI}ai-startup-valuations.png`,
    probability: 0.28,
    yesPercentage: 28,
    noPercentage: 72,
  },
  {
    id: 'ai-bubble-3-5',
    parentId: 'ai-bubble-3',
    url: 'https://polymarket.com/event/tech-layoffs-2026',
    question: 'Will big tech layoffs exceed 100K employees in 2026?',
    relation: 'IMPLIES',
    explanation: 'Mass layoffs signal AI investment pullback',
    imageUrl: `${S3_BASE_AI}tech-layoffs.png`,
    probability: 0.32,
    yesPercentage: 32,
    noPercentage: 68,
  },
  {
    id: 'ai-bubble-3-6',
    parentId: 'ai-bubble-3',
    url: 'https://polymarket.com/event/ai-regulation-eu-2026',
    question: 'Will EU AI Act enforcement begin in 2026?',
    relation: 'CONDITIONED_ON',
    explanation: 'AI regulation affects market growth trajectory',
    imageUrl: `${S3_BASE_AI}eu-ai-act.png`,
    probability: 0.88,
    yesPercentage: 88,
    noPercentage: 12,
  },
  {
    id: 'ai-bubble-3-7',
    parentId: 'ai-bubble-3',
    url: 'https://polymarket.com/event/openai-enterprise-customers-2026',
    question: 'Will OpenAI reach 1M enterprise customers by end of 2026?',
    relation: 'IMPLIES',
    explanation: 'Enterprise adoption validates AI B2B market',
    imageUrl: `${S3_BASE_AI}openai-ipo-by-qeh3ouQDANVw.jpg`,
    probability: 0.48,
    yesPercentage: 48,
    noPercentage: 52,
  },
  {
    id: 'ai-bubble-3-8',
    parentId: 'ai-bubble-3',
    url: 'https://polymarket.com/event/chatgpt-mau-2026',
    question: 'Will ChatGPT MAU exceed 500M by end of 2026?',
    relation: 'CORRELATED',
    explanation: 'ChatGPT usage indicates consumer AI demand',
    imageUrl: `${S3_BASE_AI}openai-ipo-by-qeh3ouQDANVw.jpg`,
    probability: 0.72,
    yesPercentage: 72,
    noPercentage: 28,
  },

  // ============================================
  // BRANCH 4: Fed/Economy (children of ai-bubble-4)
  // ============================================
  {
    id: 'ai-bubble-4-1',
    parentId: 'ai-bubble-4',
    url: 'https://polymarket.com/event/sp500-end-of-2026',
    question: 'Will S&P 500 reach 6500 by end of 2026?',
    relation: 'CORRELATED',
    explanation: 'Broad market health affects AI sector funding',
    imageUrl: `${S3_BASE_AI}sp500-logo.png`,
    probability: 0.55,
    yesPercentage: 55,
    noPercentage: 45,
  },
  {
    id: 'ai-bubble-4-2',
    parentId: 'ai-bubble-4',
    url: 'https://polymarket.com/event/nasdaq-end-of-2026',
    question: 'Will NASDAQ reach 22000 by end of 2026?',
    relation: 'IMPLIES',
    explanation: 'Tech-heavy NASDAQ directly reflects AI sector performance',
    imageUrl: `${S3_BASE_AI}nasdaq-logo.png`,
    probability: 0.48,
    yesPercentage: 48,
    noPercentage: 52,
  },
  {
    id: 'ai-bubble-4-3',
    parentId: 'ai-bubble-4',
    url: 'https://polymarket.com/event/us-recession-2026',
    question: 'Will the US enter a recession in 2026?',
    relation: 'IMPLIES',
    explanation: 'Recession would trigger AI investment pullback',
    imageUrl: `${S3_BASE_AI}recession-chart.png`,
    probability: 0.25,
    yesPercentage: 25,
    noPercentage: 75,
  },
  {
    id: 'ai-bubble-4-4',
    parentId: 'ai-bubble-4',
    url: 'https://polymarket.com/event/us-inflation-2026',
    question: 'Will US inflation drop below 2.5% in 2026?',
    relation: 'CONDITIONED_ON',
    explanation: 'Inflation affects Fed policy and market liquidity',
    imageUrl: `${S3_BASE_AI}inflation-chart.png`,
    probability: 0.42,
    yesPercentage: 42,
    noPercentage: 58,
  },
  {
    id: 'ai-bubble-4-5',
    parentId: 'ai-bubble-4',
    url: 'https://polymarket.com/event/us-unemployment-2026',
    question: 'Will US unemployment exceed 5% in 2026?',
    relation: 'IMPLIES',
    explanation: 'Rising unemployment signals economic weakness',
    imageUrl: `${S3_BASE_AI}unemployment-chart.png`,
    probability: 0.18,
    yesPercentage: 18,
    noPercentage: 82,
  },
  {
    id: 'ai-bubble-4-6',
    parentId: 'ai-bubble-4',
    url: 'https://polymarket.com/event/us-china-trade-war-2026',
    question: 'Will US-China trade tensions escalate significantly in 2026?',
    relation: 'CONDITIONED_ON',
    explanation: 'Trade war affects AI supply chains and market access',
    imageUrl: `${S3_BASE_AI}us-china-trade.png`,
    probability: 0.45,
    yesPercentage: 45,
    noPercentage: 55,
  },
  {
    id: 'ai-bubble-4-7',
    parentId: 'ai-bubble-4',
    url: 'https://polymarket.com/event/treasury-yields-2026',
    question: 'Will 10-year Treasury yields exceed 5% in 2026?',
    relation: 'IMPLIES',
    explanation: 'High yields compete with growth stocks for investment',
    imageUrl: `${S3_BASE_AI}treasury-yields.png`,
    probability: 0.35,
    yesPercentage: 35,
    noPercentage: 65,
  },
  {
    id: 'ai-bubble-4-8',
    parentId: 'ai-bubble-4',
    url: 'https://polymarket.com/event/dollar-strength-2026',
    question: 'Will DXY dollar index exceed 110 in 2026?',
    relation: 'WEAK_SIGNAL',
    explanation: 'Strong dollar affects global AI company earnings',
    imageUrl: `${S3_BASE_AI}dollar-index.png`,
    probability: 0.38,
    yesPercentage: 38,
    noPercentage: 62,
  },
  {
    id: 'ai-bubble-4-9',
    parentId: 'ai-bubble-4',
    url: 'https://polymarket.com/event/us-gdp-growth-2026',
    question: 'Will US GDP growth exceed 3% in 2026?',
    relation: 'CORRELATED',
    explanation: 'Strong GDP supports tech investment',
    imageUrl: `${S3_BASE_AI}gdp-growth.png`,
    probability: 0.42,
    yesPercentage: 42,
    noPercentage: 58,
  },
  {
    id: 'ai-bubble-4-10',
    parentId: 'ai-bubble-4',
    url: 'https://polymarket.com/event/consumer-spending-2026',
    question: 'Will US consumer spending growth exceed 4% in 2026?',
    relation: 'WEAK_SIGNAL',
    explanation: 'Consumer health affects tech product demand',
    imageUrl: `${S3_BASE_AI}consumer-spending.png`,
    probability: 0.35,
    yesPercentage: 35,
    noPercentage: 65,
  },

  // ============================================
  // BRANCH 5: Anthropic/VC (children of ai-bubble-5)
  // ============================================
  {
    id: 'ai-bubble-5-1',
    parentId: 'ai-bubble-5',
    url: 'https://polymarket.com/event/vc-ai-funding-2026',
    question: 'Will VC funding in AI exceed $100B globally in 2026?',
    relation: 'IMPLIES',
    explanation: 'VC funding levels indicate AI investment appetite',
    imageUrl: `${S3_BASE_AI}vc-funding.png`,
    probability: 0.55,
    yesPercentage: 55,
    noPercentage: 45,
  },
  {
    id: 'ai-bubble-5-2',
    parentId: 'ai-bubble-5',
    url: 'https://polymarket.com/event/tech-ipo-pipeline-2026',
    question: 'Will there be 20+ major tech IPOs in 2026?',
    relation: 'CORRELATED',
    explanation: 'IPO activity reflects market confidence',
    imageUrl: `${S3_BASE_AI}tech-ipo.png`,
    probability: 0.42,
    yesPercentage: 42,
    noPercentage: 58,
  },
  {
    id: 'ai-bubble-5-3',
    parentId: 'ai-bubble-5',
    url: 'https://polymarket.com/event/ai-startup-failures-2026',
    question: 'Will 100+ funded AI startups fail in 2026?',
    relation: 'CONTRADICTS',
    explanation: 'Mass AI startup failures signal bubble burst',
    imageUrl: `${S3_BASE_AI}startup-failures.png`,
    probability: 0.35,
    yesPercentage: 35,
    noPercentage: 65,
  },
  {
    id: 'ai-bubble-5-4',
    parentId: 'ai-bubble-5',
    url: 'https://polymarket.com/event/google-anthropic-investment-2026',
    question: 'Will Google invest additional $2B+ in Anthropic in 2026?',
    relation: 'IMPLIES',
    explanation: 'Google investment signals Anthropic valuation strength',
    imageUrl: `${S3_BASE_AI}google-ai-logo.png`,
    probability: 0.48,
    yesPercentage: 48,
    noPercentage: 52,
  },
  {
    id: 'ai-bubble-5-5',
    parentId: 'ai-bubble-5',
    url: 'https://polymarket.com/event/amazon-anthropic-investment-2026',
    question: 'Will Amazon increase Anthropic investment in 2026?',
    relation: 'IMPLIES',
    explanation: 'Amazon AI investment reflects cloud AI demand',
    imageUrl: `${S3_BASE_AI}amazon-ai-logo.png`,
    probability: 0.55,
    yesPercentage: 55,
    noPercentage: 45,
  },
  {
    id: 'ai-bubble-5-6',
    parentId: 'ai-bubble-5',
    url: 'https://polymarket.com/event/salesforce-ai-revenue-2026',
    question: "Will Salesforce AI features generate $5B+ revenue in 2026?",
    relation: 'CORRELATED',
    explanation: 'Enterprise AI adoption validates B2B market',
    imageUrl: `${S3_BASE_AI}salesforce-logo.png`,
    probability: 0.52,
    yesPercentage: 52,
    noPercentage: 48,
  },
  {
    id: 'ai-bubble-5-7',
    parentId: 'ai-bubble-5',
    url: 'https://polymarket.com/event/enterprise-ai-adoption-2026',
    question: 'Will 50%+ of Fortune 500 deploy AI agents by 2026?',
    relation: 'IMPLIES',
    explanation: 'Enterprise adoption validates long-term AI value',
    imageUrl: `${S3_BASE_AI}enterprise-ai.png`,
    probability: 0.48,
    yesPercentage: 48,
    noPercentage: 52,
  },
  {
    id: 'ai-bubble-5-8',
    parentId: 'ai-bubble-5',
    url: 'https://polymarket.com/event/largest-company-end-of-june-712',
    question: 'Which company will have the largest market cap by June 30, 2026?',
    relation: 'CORRELATED',
    explanation: 'Market cap leadership reflects AI sector dominance',
    imageUrl: `${S3_BASE_AI}largest-company-eoy-KS99l6lbxfCc.jpg`,
    probability: 0.58,
    yesPercentage: 58,
    noPercentage: 42,
  },
  {
    id: 'ai-bubble-5-9',
    parentId: 'ai-bubble-5',
    url: 'https://polymarket.com/event/what-price-will-bitcoin-hit-in-january-2026',
    question: 'What price will Bitcoin reach in January 2026?',
    relation: 'WEAK_SIGNAL',
    explanation: 'Bitcoin price reflects overall risk appetite in markets',
    imageUrl: `${S3_BASE_AI}BTC+fullsize.png`,
    probability: 0.42,
    yesPercentage: 42,
    noPercentage: 58,
  },

  // ============================================
  // DEEPER BRANCHES (children of children) - 5 more to hit 50
  // ============================================
  {
    id: 'ai-bubble-1-1-1',
    parentId: 'ai-bubble-1-1',
    url: 'https://polymarket.com/event/tesla-launches-unsupervised-full-self-driving-fsd-by',
    question: 'Will Tesla launch unsupervised Full Self-Driving by June 2026?',
    relation: 'CORRELATED',
    explanation: 'Tesla FSD progress affects xAI perception and Musk empire valuation',
    imageUrl: `${S3_BASE_AI}tesla-launches-unsupervised-full-self-driving-fsd-by-june-30-yvpjn3RX4Q2w.jpg`,
    probability: 0.32,
    yesPercentage: 32,
    noPercentage: 68,
  },
  {
    id: 'ai-bubble-2-4-1',
    parentId: 'ai-bubble-2-4',
    url: 'https://polymarket.com/event/gpu-cloud-pricing-2026',
    question: 'Will major cloud providers cut GPU prices 30%+ in 2026?',
    relation: 'IMPLIES',
    explanation: 'Cloud GPU price cuts indicate supply glut',
    imageUrl: `${S3_BASE_AI}cloud-gpu.png`,
    probability: 0.42,
    yesPercentage: 42,
    noPercentage: 58,
  },
  {
    id: 'ai-bubble-3-4-1',
    parentId: 'ai-bubble-3-4',
    url: 'https://polymarket.com/event/ai-unicorn-down-rounds-2026',
    question: 'Will 10+ AI unicorns have down rounds in 2026?',
    relation: 'IMPLIES',
    explanation: 'Down rounds signal AI valuation correction',
    imageUrl: `${S3_BASE_AI}down-rounds.png`,
    probability: 0.38,
    yesPercentage: 38,
    noPercentage: 62,
  },
  {
    id: 'ai-bubble-4-3-1',
    parentId: 'ai-bubble-4-3',
    url: 'https://polymarket.com/event/tech-stock-crash-2026',
    question: 'Will there be a 20%+ tech stock correction in 2026?',
    relation: 'IMPLIES',
    explanation: 'Major tech correction would trigger AI funding freeze',
    imageUrl: `${S3_BASE_AI}tech-crash.png`,
    probability: 0.28,
    yesPercentage: 28,
    noPercentage: 72,
  },
  {
    id: 'ai-bubble-5-3-1',
    parentId: 'ai-bubble-5-3',
    url: 'https://polymarket.com/event/ai-layoffs-2026',
    question: 'Will AI companies lay off 50K+ employees in 2026?',
    relation: 'IMPLIES',
    explanation: 'AI sector layoffs signal investment pullback',
    imageUrl: `${S3_BASE_AI}ai-layoffs.png`,
    probability: 0.22,
    yesPercentage: 22,
    noPercentage: 78,
  },
];

// Get AI bubble dependencies for a given parent (null = root level)
function getAiBubbleDependencies(
  parentId: string | null,
  existingIds: Set<string>,
  count: number
): DependencyQueueItem[] {
  // Filter dependencies by parentId
  const matchingDeps = AI_BUBBLE_BURST_DEPENDENCIES.filter(
    dep => dep.parentId === parentId && !existingIds.has(dep.id) && !existingIds.has(dep.url)
  );

  // Take up to 'count' items
  const selected = matchingDeps.slice(0, count);

  // Convert to DependencyQueueItem format
  return selected.map(dep => ({
    id: dep.id,
    url: dep.url,
    weight: 0.75,
    decision: 'yes' as const,
    relation: dep.relation,
    imageUrl: dep.imageUrl || undefined,
    parentId: dep.parentId || undefined,
    parentUrl: dep.parentId
      ? AI_BUBBLE_BURST_DEPENDENCIES.find(d => d.id === dep.parentId)?.url
      : undefined,
    sourceId: dep.parentId || 'ai-bubble-root',
    sourceSlug: dep.parentId || 'ai-bubble-burst',
    sourceUrl: dep.parentId
      ? AI_BUBBLE_BURST_DEPENDENCIES.find(d => d.id === dep.parentId)?.url
      : undefined,
    sourceQuestion: dep.parentId
      ? AI_BUBBLE_BURST_DEPENDENCIES.find(d => d.id === dep.parentId)?.question
      : 'AI Bubble Burst',
    explanation: dep.explanation,
    question: dep.question,
    probability: dep.probability,
    yesPercentage: dep.yesPercentage,
    noPercentage: dep.noPercentage,
  }));
}

// Multiple samples per topic for variety
// Using valid BetRelationship types: IMPLIES, CONTRADICTS, PARTITION_OF, SUBEVENT, CONDITIONED_ON, WEAK_SIGNAL
// Real Polymarket event URLs with S3 image URLs for proper display
const S3_BASE = 'https://polymarket-upload.s3.us-east-2.amazonaws.com/';

const TOPIC_SAMPLES: Record<TopicType, SampleData[]> = {
  politics: [
    {
      url: 'https://polymarket.com/event/presidential-election-winner-2028',
      question: 'Who will win the 2028 US Presidential Election?',
      relation: 'IMPLIES',
      explanation: 'Presidential outcomes shape the direction of policy and governance.',
      imageUrl: `${S3_BASE}presidential-election-winner-2024-afdda358-219d-448a-abb5-ba4d14118d71.png`,
      probability: 0.55,
      yesPercentage: 55,
      noPercentage: 45,
    },
    {
      url: 'https://polymarket.com/event/who-will-trump-nominate-as-fed-chair',
      question: 'Who will Trump nominate as the next Federal Reserve Chair?',
      relation: 'CONDITIONED_ON',
      explanation: 'Fed Chair nomination depends on administration priorities and economic outlook.',
      imageUrl: `${S3_BASE}who-will-trump-nominate-as-fed-chair-9p19ttRwsbKL.png`,
      probability: 0.35,
      yesPercentage: 35,
      noPercentage: 65,
    },
    {
      url: 'https://polymarket.com/event/will-trump-acquire-greenland-before-2027',
      question: 'Will the US acquire Greenland before 2027?',
      relation: 'WEAK_SIGNAL',
      explanation: 'Geopolitical moves reflect broader foreign policy priorities.',
      imageUrl: `${S3_BASE}will-trump-acquire-greenland-in-2025-5ZDkcIGhdBMW.jpg`,
      probability: 0.28,
      yesPercentage: 28,
      noPercentage: 72,
    },
    {
      url: 'https://polymarket.com/event/democratic-presidential-nominee-2028',
      question: 'Who will be the 2028 Democratic Presidential Nominee?',
      relation: 'IMPLIES',
      explanation: 'Primary outcomes determine general election dynamics.',
      imageUrl: `${S3_BASE}democrats+2028+donkey.png`,
      probability: 0.42,
      yesPercentage: 42,
      noPercentage: 58,
    },
    {
      url: 'https://polymarket.com/event/republican-presidential-nominee-2028',
      question: 'Who will be the 2028 Republican Presidential Nominee?',
      relation: 'WEAK_SIGNAL',
      explanation: 'Nomination races signal party direction and voter sentiment.',
      imageUrl: `${S3_BASE}republicans+2028.png`,
      probability: 0.38,
      yesPercentage: 38,
      noPercentage: 62,
    },
    {
      url: 'https://polymarket.com/event/insurrection-act-invoked-by',
      question: 'Will Trump invoke the Insurrection Act before August 2026?',
      relation: 'CONDITIONED_ON',
      explanation: 'Use of emergency powers depends on civil unrest and policy stance.',
      imageUrl: `${S3_BASE}trump-invokes-the-insurrection-act-before-august-jR3s2WWoaIbY.jpg`,
      probability: 0.22,
      yesPercentage: 22,
      noPercentage: 78,
    },
  ],
  crypto: [
    {
      url: 'https://polymarket.com/event/what-price-will-bitcoin-hit-in-january-2026',
      question: 'What price will Bitcoin reach in January 2026?',
      relation: 'IMPLIES',
      explanation: 'Bitcoin price movements often lead broader crypto market trends.',
      imageUrl: `${S3_BASE}BTC+fullsize.png`,
      probability: 0.42,
      yesPercentage: 42,
      noPercentage: 58,
    },
    {
      url: 'https://polymarket.com/event/what-price-will-ethereum-hit-in-january-2026',
      question: 'What price will Ethereum reach in January 2026?',
      relation: 'IMPLIES',
      explanation: 'Ethereum price correlates with overall crypto market sentiment.',
      imageUrl: `${S3_BASE}ETH+fullsize.jpg`,
      probability: 0.38,
      yesPercentage: 38,
      noPercentage: 62,
    },
    {
      url: 'https://polymarket.com/event/what-price-will-solana-hit-in-january-2026',
      question: 'What price will Solana reach in January 2026?',
      relation: 'CONDITIONED_ON',
      explanation: 'Solana performance depends on network activity and ecosystem growth.',
      imageUrl: `${S3_BASE}SOL-logo.png`,
      probability: 0.35,
      yesPercentage: 35,
      noPercentage: 65,
    },
    {
      url: 'https://polymarket.com/event/bitcoin-up-or-down-on-january-18',
      question: 'Will Bitcoin close higher today than yesterday?',
      relation: 'WEAK_SIGNAL',
      explanation: 'Daily price movements reflect short-term market sentiment.',
      imageUrl: `${S3_BASE}BTC+fullsize.png`,
      probability: 0.52,
      yesPercentage: 52,
      noPercentage: 48,
    },
    {
      url: 'https://polymarket.com/event/ethereum-price-on-january-18',
      question: 'Will Ethereum be above $4,000 on January 18?',
      relation: 'WEAK_SIGNAL',
      explanation: 'Short-term ETH movements track with broader market conditions.',
      imageUrl: `${S3_BASE}ETH+fullsize.jpg`,
      probability: 0.48,
      yesPercentage: 48,
      noPercentage: 52,
    },
    {
      url: 'https://polymarket.com/event/solana-price-on-january-18',
      question: 'Will Solana be above $200 on January 18?',
      relation: 'WEAK_SIGNAL',
      explanation: 'Daily SOL price reflects ecosystem momentum.',
      imageUrl: `${S3_BASE}SOL-logo.png`,
      probability: 0.45,
      yesPercentage: 45,
      noPercentage: 55,
    },
  ],
  sports: [
    {
      url: 'https://polymarket.com/event/super-bowl-champion-2026-731',
      question: 'Who will win Super Bowl LX in 2026?',
      relation: 'WEAK_SIGNAL',
      explanation: 'Championship predictions reflect team performance throughout the season.',
      imageUrl: `${S3_BASE}football-logo.png`,
      probability: 0.68,
      yesPercentage: 68,
      noPercentage: 32,
    },
    {
      url: 'https://polymarket.com/event/2026-nba-champion',
      question: 'Who will win the 2026 NBA Championship?',
      relation: 'WEAK_SIGNAL',
      explanation: 'NBA championship odds shift with playoff performance.',
      imageUrl: `${S3_BASE}super+cool+basketball+in+red+and+blue+wow.png`,
      probability: 0.15,
      yesPercentage: 15,
      noPercentage: 85,
    },
    {
      url: 'https://polymarket.com/event/nfl-hou-ne-2025-01-18',
      question: 'Will the Houston Texans beat the New England Patriots?',
      relation: 'WEAK_SIGNAL',
      explanation: 'Game outcomes affect playoff positioning.',
      imageUrl: `${S3_BASE}nfl.png`,
      probability: 0.55,
      yesPercentage: 55,
      noPercentage: 45,
    },
    {
      url: 'https://polymarket.com/event/nba-orl-mem-2026-01-18',
      question: 'Will the Orlando Magic beat the Memphis Grizzlies?',
      relation: 'IMPLIES',
      explanation: 'Regular season results influence championship odds.',
      imageUrl: `${S3_BASE}super+cool+basketball+in+red+and+blue+wow.png`,
      probability: 0.48,
      yesPercentage: 48,
      noPercentage: 52,
    },
    {
      url: 'https://polymarket.com/event/nfl-la-chi-2026-01-18',
      question: 'Will the LA Rams beat the Chicago Bears?',
      relation: 'CONDITIONED_ON',
      explanation: 'Division matchups affect conference standings.',
      imageUrl: `${S3_BASE}nfl.png`,
      probability: 0.62,
      yesPercentage: 62,
      noPercentage: 38,
    },
  ],
  economy: [
    {
      url: 'https://polymarket.com/event/fed-decision-in-january',
      question: 'Will the Fed cut interest rates in January 2026?',
      relation: 'CONDITIONED_ON',
      explanation: 'Fed policy decisions have cascading effects on financial markets.',
      imageUrl: `${S3_BASE}jerome+powell+glasses1.png`,
      probability: 0.35,
      yesPercentage: 35,
      noPercentage: 65,
    },
    {
      url: 'https://polymarket.com/event/us-strikes-iran-by',
      question: 'Will the US conduct military strikes on Iran by October 2026?',
      relation: 'WEAK_SIGNAL',
      explanation: 'Geopolitical tensions affect oil prices and market stability.',
      imageUrl: `${S3_BASE}us-strikes-iran-by-october-3-2sVnIHq3sjqF.jpg`,
      probability: 0.22,
      yesPercentage: 22,
      noPercentage: 78,
    },
    {
      url: 'https://polymarket.com/event/russia-x-ukraine-ceasefire-before-2027',
      question: 'Will there be a Russia-Ukraine ceasefire before 2027?',
      relation: 'IMPLIES',
      explanation: 'Conflict resolution would significantly impact global markets.',
      imageUrl: `${S3_BASE}russia-x-ukraine-ceasefire-in-2025-w2voYOygx80B.jpg`,
      probability: 0.28,
      yesPercentage: 28,
      noPercentage: 72,
    },
    {
      url: 'https://polymarket.com/event/portugal-presidential-election',
      question: 'Who will win the 2026 Portugal Presidential Election?',
      relation: 'WEAK_SIGNAL',
      explanation: 'European elections affect EU policy direction.',
      imageUrl: `${S3_BASE}portugal-presidential-election-_h_A97vllNOX.png`,
      probability: 0.45,
      yesPercentage: 45,
      noPercentage: 55,
    },
    {
      url: 'https://polymarket.com/event/largest-company-end-of-june-712',
      question: 'Which company will have the largest market cap by June 30, 2026?',
      relation: 'IMPLIES',
      explanation: 'Market cap rankings reflect tech and AI sector momentum.',
      imageUrl: `${S3_BASE}largest-company-eoy-KS99l6lbxfCc.jpg`,
      probability: 0.58,
      yesPercentage: 58,
      noPercentage: 42,
    },
  ],
  default: [
    {
      url: 'https://polymarket.com/event/which-company-has-the-best-ai-model-end-of-january',
      question: 'Which company will have the best AI model by end of January 2026?',
      relation: 'IMPLIES',
      explanation: 'AI leadership affects company valuations and market dynamics.',
      imageUrl: `${S3_BASE}which-company-has-best-ai-model-end-of-september-MmASwbTkwKHi.jpg`,
      probability: 0.72,
      yesPercentage: 72,
      noPercentage: 28,
    },
    {
      url: 'https://polymarket.com/event/grok-4pt20-released-by',
      question: 'Will xAI release Grok 4.20 before March 2026?',
      relation: 'CONDITIONED_ON',
      explanation: 'AI release timelines depend on development progress and competition.',
      imageUrl: `${S3_BASE}grok-4pt20-released-by-FREAnoCYA7aN.jpg`,
      probability: 0.45,
      yesPercentage: 45,
      noPercentage: 55,
    },
    {
      url: 'https://polymarket.com/event/tesla-launches-unsupervised-full-self-driving-fsd-by',
      question: 'Will Tesla launch unsupervised Full Self-Driving by June 2026?',
      relation: 'WEAK_SIGNAL',
      explanation: 'Autonomous vehicle progress affects Tesla valuation.',
      imageUrl: `${S3_BASE}tesla-launches-unsupervised-full-self-driving-fsd-by-june-30-yvpjn3RX4Q2w.jpg`,
      probability: 0.32,
      yesPercentage: 32,
      noPercentage: 68,
    },
    {
      url: 'https://polymarket.com/event/anthropic-ipo-closing-market-cap',
      question: "What will be Anthropic's market cap at IPO?",
      relation: 'IMPLIES',
      explanation: 'AI company valuations reflect sector growth expectations.',
      imageUrl: `${S3_BASE}anthropic-ipo-closing-market-cap-jdfele1g0krx.png`,
      probability: 0.38,
      yesPercentage: 38,
      noPercentage: 62,
    },
    {
      url: 'https://polymarket.com/event/openai-ipo-by',
      question: 'Will OpenAI go public by December 2026?',
      relation: 'WEAK_SIGNAL',
      explanation: 'Major AI IPOs signal market appetite for tech investments.',
      imageUrl: `${S3_BASE}openai-ipo-by-qeh3ouQDANVw.jpg`,
      probability: 0.28,
      yesPercentage: 28,
      noPercentage: 72,
    },
    {
      url: 'https://polymarket.com/event/will-elon-musk-win-his-case-against-sam-altman',
      question: 'Will Elon Musk win his lawsuit against Sam Altman?',
      relation: 'CONDITIONED_ON',
      explanation: 'Legal outcomes affect OpenAI structure and AI industry dynamics.',
      imageUrl: `${S3_BASE}will-elon-musk-win-his-case-against-sam-altman-3b7rjuMNHGHy.jpg`,
      probability: 0.35,
      yesPercentage: 35,
      noPercentage: 65,
    },
  ],
};

function getSampleForTopic(topic: TopicType, sourceQuestion: string, index = 0): SampleData {
  const samples = TOPIC_SAMPLES[topic] || TOPIC_SAMPLES.default;
  return samples[index % samples.length];
}

// Sample fallback dependency when API returns empty
function createSampleDependency(
  sourceMarket: any,
  options: { parentId?: string; parentUrl?: string; index?: number; previousQuestion?: string }
): DependencyQueueItem {
  const sourceSlug = typeof sourceMarket?.slug === 'string' ? sourceMarket.slug : undefined;
  const sourceUrl = sourceSlug ? `https://polymarket.com/event/${sourceSlug}` : options.parentUrl;
  const sourceQuestion =
    typeof sourceMarket?.question === 'string'
      ? sourceMarket.question
      : options.previousQuestion
        ? options.previousQuestion
        : sourceSlug
          ? sourceSlug.replace(/-/g, ' ')
          : 'Current Market Position';

  // Detect topic and get relevant sample
  const topic = detectTopic(sourceQuestion, sourceSlug || '');
  const sample = getSampleForTopic(topic, sourceQuestion, options.index ?? 0);

  return {
    id: `sample-${Date.now()}-${options.index ?? 0}`,
    url: sample.url,
    weight: 0.75 - (options.index ?? 0) * 0.1, // Slightly decrease weight for each sample
    decision: 'yes',
    relation: sample.relation,
    imageUrl: sample.imageUrl || undefined, // undefined so app fetches real image
    parentId: options.parentId,
    parentUrl: options.parentUrl,
    sourceId: sourceMarket?.id,
    sourceSlug,
    sourceUrl,
    sourceQuestion,
    explanation: sample.explanation,
    question: sample.question,
    probability: sample.probability,
    yesPercentage: sample.yesPercentage,
    noPercentage: sample.noPercentage,
  };
}

// Create multiple sample dependencies to fill queue
function createSampleDependencies(
  sourceMarket: any,
  options: { parentId?: string; parentUrl?: string; eventUrl?: string },
  count: number,
  existingIds: Set<string>
): DependencyQueueItem[] {
  // Check if this is an AI bubble burst event - use hardcoded dependencies
  const eventUrl = options.eventUrl || options.parentUrl || '';
  if (isAiBubbleBurstEvent(eventUrl)) {
    // For AI bubble burst, determine which parentId to use for children
    // If parentId starts with 'ai-bubble', use it directly
    // Otherwise, use null to get root-level dependencies
    const aiBubbleParentId = options.parentId?.startsWith('ai-bubble') ? options.parentId : null;
    return getAiBubbleDependencies(aiBubbleParentId, existingIds, count);
  }

  const samples: DependencyQueueItem[] = [];
  let previousQuestion: string | undefined;

  for (let i = 0; i < count; i++) {
    const sample = createSampleDependency(sourceMarket, { ...options, index: i, previousQuestion });
    if (!existingIds.has(sample.id) && !existingIds.has(sample.url)) {
      samples.push(sample);
      existingIds.add(sample.id);
      existingIds.add(sample.url);
      // Next sample's source will be this sample's question
      previousQuestion = sample.question;
    }
  }
  return samples;
}

function mapDependantsToQueue(
  dependants: any[],
  sourceMarket: any,
  visited: string[],
  options: { parentId?: string; parentUrl?: string }
): DependencyQueueItem[] {
  if (!Array.isArray(dependants)) {
    return [];
  }

  const sourceSlug = typeof sourceMarket?.slug === 'string' ? sourceMarket.slug : undefined;
  const sourceUrl = sourceSlug ? `https://polymarket.com/event/${sourceSlug}` : undefined;
  const sourceQuestion =
    typeof sourceMarket?.question === 'string'
      ? sourceMarket.question
      : sourceSlug
        ? sourceSlug.replace(/-/g, ' ')
        : undefined;
  const sourceId = typeof sourceMarket?.id === 'string' ? sourceMarket.id : undefined;

  // Convert visited URLs to event IDs for more robust comparison
  const visitedIds = new Set(
    visited.map(url => getEventIdFromUrl(url)).filter(Boolean)
  );
  // Also track visited URLs directly for fallback comparison
  const visitedUrlSet = new Set(visited);

  return dependants
    .filter(dep => typeof dep?.url === 'string' && dep.url.length > 0)
    .filter(dep => {
      // Skip if URL is already in visited set
      if (visitedUrlSet.has(dep.url)) return false;
      // Skip if event ID is already in visited IDs
      const depId = getEventIdFromUrl(dep.url);
      if (depId && visitedIds.has(depId)) return false;
      return true;
    })
    .map(dep => {
      const imageUrl =
        typeof dep.imageUrl === 'string'
          ? dep.imageUrl
          : typeof dep.image === 'string'
            ? dep.image
            : undefined;

      return {
        id: String(dep.id ?? dep.url),
        url: dep.url,
        weight: typeof dep.weight === 'number' ? dep.weight : 0,
        decision: dep.decision === 'no' ? 'no' : 'yes',
        relation: String(dep.relation ?? ''),
        imageUrl,
        parentId: options.parentId,
        parentUrl: options.parentUrl,
        sourceId,
        sourceSlug,
        sourceUrl,
        sourceQuestion,
        explanation: dep.explanation,
        question: dep.question,
        probability: typeof dep.probability === 'number' ? dep.probability : undefined,
        yesPercentage: typeof dep.yesPercentage === 'number' ? dep.yesPercentage : undefined,
        noPercentage: typeof dep.noPercentage === 'number' ? dep.noPercentage : undefined,
      };
    });
}

export async function processDependencyDecision({
  eventUrl,
  keep,
  fallbackDecision = 'yes',
  fallbackWeight = 1,
  risk,
}: ProcessDecisionInput): Promise<DependencyDecisionResult> {
  const state = await getDependencyState(eventUrl);
  // Deduplicate queue to handle any legacy duplicates in storage
  const queue = deduplicateQueue(state.queue);
  const visited = state.visited;
  let hasInitialFetch = state.hasInitialFetch ?? false;

  const current = queue[0] ?? null;
  const remainingQueue = current ? queue.slice(1) : queue;

  const currentUrl = current?.url || eventUrl;
  const currentDecision = current?.decision ?? fallbackDecision;
  const currentWeight = typeof current?.weight === 'number' ? current.weight : fallbackWeight;
  const rootId = getEventIdFromUrl(eventUrl) ?? 'root';

  let nextQueue = remainingQueue;
  let nextVisited = toUnique([
    ...visited,
    currentUrl,
    ...extractQueueUrls(remainingQueue),
  ]);

  if (!keep) {
    await setDependencyState(eventUrl, nextQueue, nextVisited, hasInitialFetch);
    return { queue: nextQueue, visited: nextVisited };
  }

  let response: DependenciesResponse | undefined;
  const shouldFetchMore = remainingQueue.length === 0;

  if (shouldFetchMore) {
    const volatility = 0.5 + normalizeRisk(risk) / 100;
    const parentId = current?.id ?? rootId;
    const existingIds = new Set(extractQueueIds(nextQueue));
    const existingUrls = new Set(extractQueueUrls(nextQueue));

    // Special handling for AI bubble burst events - skip API, use hardcoded data only
    if (isAiBubbleBurstEvent(eventUrl)) {
      const MIN_QUEUE_SIZE = 5; // Show 5 dependencies at a time for AI bubble
      if (nextQueue.length < MIN_QUEUE_SIZE) {
        const needed = MIN_QUEUE_SIZE - nextQueue.length;
        const allIds = new Set([...existingIds, ...existingUrls]);
        // Use current item's ID as parent for tree traversal (if it's an AI bubble dep)
        const aiBubbleParentId = current?.id?.startsWith('ai-bubble') ? current.id : null;
        const samples = getAiBubbleDependencies(aiBubbleParentId, allIds, needed);
        if (samples.length > 0) {
          nextQueue = [...nextQueue, ...samples];
          nextVisited = toUnique([...nextVisited, ...extractQueueUrls(samples)]);
        }
      }
      hasInitialFetch = true; // Mark as done to prevent API calls
      await setDependencyState(eventUrl, nextQueue, nextVisited, hasInitialFetch);
      return { queue: nextQueue, visited: nextVisited };
    }

    // First call: make real API call; subsequent calls: use hardcoded samples only
    if (!hasInitialFetch) {
      try {
        response = await fetchDependencies({
          url: currentUrl,
          weight: currentWeight,
          decision: currentDecision,
          visited: nextVisited,
          volatility,
        });

        let newItems = mapDependantsToQueue(
          response.dependants || [],
          response.sourceMarket,
          nextVisited,
          { parentId, parentUrl: currentUrl }
        ).filter(item => !existingIds.has(item.id));

        // Pad with sample dependencies if we don't have enough items (target: 3)
        const MIN_QUEUE_SIZE = 3;
        const totalAfterFetch = nextQueue.length + newItems.length;
        if (totalAfterFetch < MIN_QUEUE_SIZE) {
          const needed = MIN_QUEUE_SIZE - totalAfterFetch;
          const allIds = new Set([...existingIds, ...newItems.map(i => i.id)]);
          const allUrls = new Set([...existingUrls, ...newItems.map(i => i.url)]);
          const samples = createSampleDependencies(
            response.sourceMarket,
            { parentId, parentUrl: currentUrl, eventUrl },
            needed,
            new Set([...allIds, ...allUrls])
          );
          newItems = [...newItems, ...samples];
        }

        if (newItems.length > 0) {
          nextQueue = [...nextQueue, ...newItems];
          nextVisited = toUnique([...nextVisited, ...extractQueueUrls(newItems)]);
        }

        // Mark that we've done the initial API fetch
        hasInitialFetch = true;
      } catch (error) {
        // API failed on first call - still use samples as fallback
        console.error('Failed to fetch dependencies', error);
        const MIN_QUEUE_SIZE = 3;
        if (nextQueue.length < MIN_QUEUE_SIZE) {
          const needed = MIN_QUEUE_SIZE - nextQueue.length;
          const allIds = new Set([...existingIds, ...existingUrls]);
          const samples = createSampleDependencies(
            null,
            { parentId, parentUrl: currentUrl, eventUrl },
            needed,
            allIds
          );
          nextQueue = [...nextQueue, ...samples];
          nextVisited = toUnique([...nextVisited, ...extractQueueUrls(samples)]);
        }
        // Mark as initial fetch done even on failure so we don't keep retrying
        hasInitialFetch = true;
      }
    } else {
      // After initial fetch: use hardcoded samples only (no more API calls)
      const MIN_QUEUE_SIZE = 3;
      if (nextQueue.length < MIN_QUEUE_SIZE) {
        const needed = MIN_QUEUE_SIZE - nextQueue.length;
        const allIds = new Set([...existingIds, ...existingUrls]);
        const samples = createSampleDependencies(
          null,
          { parentId, parentUrl: currentUrl, eventUrl },
          needed,
          allIds
        );
        nextQueue = [...nextQueue, ...samples];
        nextVisited = toUnique([...nextVisited, ...extractQueueUrls(samples)]);
      }
    }
  }

  await setDependencyState(eventUrl, nextQueue, nextVisited, hasInitialFetch);
  return { response, queue: nextQueue, visited: nextVisited };
}
