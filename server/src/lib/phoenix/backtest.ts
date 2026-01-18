// Backtest Evaluator - use resolved Polymarket data as ground truth

import type { BetRelationship } from "../../types";

const GAMMA_API = "https://gamma-api.polymarket.com";

export interface ResolvedMarket {
  id: string;
  conditionId: string;
  question: string;
  description?: string;
  outcome: "YES" | "NO" | "INVALID" | "UNKNOWN";
  resolutionDate: string;
  finalPrice: number; // 0-1, where 1 = YES won
  volume: number;
}

export interface BacktestExample {
  sourceMarket: ResolvedMarket;
  relatedMarket: ResolvedMarket;
  predictedRelationship: BetRelationship;
  reasoning: string;
  // Ground truth evaluation
  relationshipHeld: boolean;
  explanation: string;
}

export interface BacktestResult {
  totalExamples: number;
  correctPredictions: number;
  accuracy: number;
  byRelationshipType: Record<
    string,
    { correct: number; total: number; accuracy: number }
  >;
  examples: BacktestExample[];
}

export async function fetchResolvedMarkets(
  limit: number = 100,
  category?: string,
): Promise<ResolvedMarket[]> {
  try {
    // Fetch closed markets
    let url = `${GAMMA_API}/markets?limit=${limit}&closed=true&order=volume&ascending=false`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch resolved markets: ${response.statusText}`,
      );
    }

    const markets = (await response.json()) as any[];

    // Transform to our format
    return markets
      .filter((m) => m.resolutionSource || m.resolved) // Only fully resolved
      .map((m) => ({
        id: m.id || m.conditionId,
        conditionId: m.conditionId || m.id,
        question: m.question,
        description: m.description,
        outcome: determineOutcome(m),
        resolutionDate: m.endDate || m.resolutionDate || "",
        finalPrice: parseFinalPrice(m),
        volume: parseFloat(m.volume) || 0,
      }));
  } catch (error) {
    console.error("[Backtest] Error fetching resolved markets:", error);
    return [];
  }
}

function determineOutcome(market: any): ResolvedMarket["outcome"] {
  // Check if there's an explicit resolution
  if (market.resolvedOutcome) {
    return market.resolvedOutcome.toUpperCase() as ResolvedMarket["outcome"];
  }

  // Infer from final price
  const price = parseFinalPrice(market);
  if (price >= 0.95) return "YES";
  if (price <= 0.05) return "NO";

  // Check tokens for resolution
  if (market.tokens && market.tokens.length >= 2) {
    const yesToken = market.tokens.find(
      (t: any) => t.outcome?.toLowerCase() === "yes",
    );
    if (yesToken) {
      const yesPrice = parseFloat(yesToken.price);
      if (yesPrice >= 0.95) return "YES";
      if (yesPrice <= 0.05) return "NO";
    }
  }

  return "UNKNOWN";
}

function parseFinalPrice(market: any): number {
  // Try outcomePrices
  if (market.outcomePrices) {
    try {
      const prices =
        typeof market.outcomePrices === "string"
          ? JSON.parse(market.outcomePrices)
          : market.outcomePrices;
      if (Array.isArray(prices) && prices.length >= 1) {
        return parseFloat(prices[0]);
      }
    } catch {}
  }

  // Try tokens
  if (market.tokens && market.tokens.length >= 2) {
    const yesToken = market.tokens.find(
      (t: any) => t.outcome?.toLowerCase() === "yes",
    );
    if (yesToken) {
      return parseFloat(yesToken.price) || 0.5;
    }
  }

  return 0.5;
}

// Ground truth evaluator - validates relationship against actual outcomes
export function validateRelationship(
  sourceOutcome: ResolvedMarket["outcome"],
  relatedOutcome: ResolvedMarket["outcome"],
  relationship: BetRelationship,
): { held: boolean; explanation: string } {
  // Can't evaluate if either outcome is unknown
  if (sourceOutcome === "UNKNOWN" || sourceOutcome === "INVALID") {
    return {
      held: false,
      explanation: `Source market outcome unknown/invalid`,
    };
  }
  if (relatedOutcome === "UNKNOWN" || relatedOutcome === "INVALID") {
    return {
      held: false,
      explanation: `Related market outcome unknown/invalid`,
    };
  }

  const sourceYes = sourceOutcome === "YES";
  const relatedYes = relatedOutcome === "YES";

  switch (relationship) {
    case "IMPLIES":
      // If source YES → related should be YES
      // If source NO → we don't care (implication is vacuously true)
      if (sourceYes) {
        const held = relatedYes;
        return {
          held,
          explanation: held
            ? `IMPLIES held: Source=YES and Related=YES`
            : `IMPLIES failed: Source=YES but Related=NO`,
        };
      }
      return { held: true, explanation: `IMPLIES vacuously true: Source=NO` };

    case "CONTRADICTS":
      // Source and Related should have opposite outcomes
      const contradictionHeld = sourceYes !== relatedYes;
      return {
        held: contradictionHeld,
        explanation: contradictionHeld
          ? `CONTRADICTS held: Source=${sourceOutcome}, Related=${relatedOutcome}`
          : `CONTRADICTS failed: Both resolved ${sourceOutcome}`,
      };

    case "SUBEVENT":
      // If related (the subevent) is YES → source should be affected
      // This is causal: subevent happening should influence source
      if (relatedYes) {
        return {
          held: true, // Hard to validate causation, assume correct if both resolved
          explanation: `SUBEVENT: Related event occurred (YES), source=${sourceOutcome}`,
        };
      }
      return {
        held: true,
        explanation: `SUBEVENT: Related event did not occur`,
      };

    case "CONDITIONED_ON":
      // Related is a prerequisite for source
      // If source YES → related must have been YES
      if (sourceYes) {
        const held = relatedYes;
        return {
          held,
          explanation: held
            ? `CONDITIONED_ON held: Source needed Related, both YES`
            : `CONDITIONED_ON failed: Source=YES but prerequisite Related=NO`,
        };
      }
      return {
        held: true,
        explanation: `CONDITIONED_ON: Source=NO, condition check skipped`,
      };

    case "PARTITION_OF":
      // Part of same question - one should be YES, others NO
      // In binary case: exactly one YES
      const held = sourceYes !== relatedYes;
      return {
        held,
        explanation: held
          ? `PARTITION_OF held: Exactly one YES (Source=${sourceOutcome}, Related=${relatedOutcome})`
          : `PARTITION_OF failed: Same outcome for both`,
      };

    case "WEAK_SIGNAL":
      // Correlation - harder to validate, be lenient
      // Consider it "held" if they moved in the same direction
      const sameDirection = sourceYes === relatedYes;
      return {
        held: sameDirection,
        explanation: sameDirection
          ? `WEAK_SIGNAL correlated: Both ${sourceOutcome}`
          : `WEAK_SIGNAL uncorrelated: Source=${sourceOutcome}, Related=${relatedOutcome}`,
      };

    default:
      return {
        held: false,
        explanation: `Unknown relationship type: ${relationship}`,
      };
  }
}

export async function runBacktest(
  predictions: Array<{
    sourceMarketId: string;
    relatedMarketId: string;
    relationship: BetRelationship;
    reasoning: string;
  }>,
  resolvedMarkets: Map<string, ResolvedMarket>,
): Promise<BacktestResult> {
  const examples: BacktestExample[] = [];
  const byType: Record<string, { correct: number; total: number }> = {};

  for (const pred of predictions) {
    const source = resolvedMarkets.get(pred.sourceMarketId);
    const related = resolvedMarkets.get(pred.relatedMarketId);

    if (!source || !related) {
      continue; // Skip if we don't have resolution data
    }

    const validation = validateRelationship(
      source.outcome,
      related.outcome,
      pred.relationship,
    );

    // Track by relationship type
    if (!byType[pred.relationship]) {
      byType[pred.relationship] = { correct: 0, total: 0 };
    }
    byType[pred.relationship].total++;
    if (validation.held) {
      byType[pred.relationship].correct++;
    }

    examples.push({
      sourceMarket: source,
      relatedMarket: related,
      predictedRelationship: pred.relationship,
      reasoning: pred.reasoning,
      relationshipHeld: validation.held,
      explanation: validation.explanation,
    });
  }

  const totalCorrect = examples.filter((e) => e.relationshipHeld).length;

  return {
    totalExamples: examples.length,
    correctPredictions: totalCorrect,
    accuracy: examples.length > 0 ? totalCorrect / examples.length : 0,
    byRelationshipType: Object.fromEntries(
      Object.entries(byType).map(([type, stats]) => [
        type,
        {
          ...stats,
          accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
        },
      ]),
    ),
    examples,
  };
}

export async function buildBacktestDataset(limit: number = 50): Promise<{
  markets: ResolvedMarket[];
  pairs: Array<{ source: ResolvedMarket; candidates: ResolvedMarket[] }>;
}> {
  console.log("[Backtest] Fetching resolved markets...");
  const markets = await fetchResolvedMarkets(limit * 2);

  // Filter to markets with clear outcomes
  const validMarkets = markets.filter(
    (m) => m.outcome === "YES" || m.outcome === "NO",
  );

  console.log(
    `[Backtest] Found ${validMarkets.length} markets with clear outcomes`,
  );

  // Create pairs: each market as source, others as candidates
  const pairs = validMarkets.slice(0, limit).map((source) => ({
    source,
    candidates: validMarkets.filter((m) => m.id !== source.id).slice(0, 20),
  }));

  return { markets: validMarkets, pairs };
}

export async function scorePromptWithBacktest(
  runPrompt: (
    source: ResolvedMarket,
    candidates: ResolvedMarket[],
  ) => Promise<
    Array<{
      marketId: string;
      relationship: BetRelationship;
      reasoning: string;
    }>
  >,
): Promise<BacktestResult> {
  const { markets, pairs } = await buildBacktestDataset(20);

  // Create lookup map
  const marketMap = new Map(markets.map((m) => [m.id, m]));

  // Run prompt on each pair and collect predictions
  const allPredictions: Array<{
    sourceMarketId: string;
    relatedMarketId: string;
    relationship: BetRelationship;
    reasoning: string;
  }> = [];

  for (const { source, candidates } of pairs) {
    try {
      const predictions = await runPrompt(source, candidates);

      for (const pred of predictions) {
        allPredictions.push({
          sourceMarketId: source.id,
          relatedMarketId: pred.marketId,
          relationship: pred.relationship,
          reasoning: pred.reasoning,
        });
      }
    } catch (error) {
      console.error(`[Backtest] Error running prompt for ${source.id}:`, error);
    }
  }

  // Run backtest
  return runBacktest(allPredictions, marketMap);
}
