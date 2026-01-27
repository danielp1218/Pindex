import { Context, Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { extractSlugFromUrl, parseMarketInput } from '../lib/url-parser';
import { findRelatedBets, getMarketPercentages, type FoundRelatedBet } from '../lib/related-bets-finder';
import { fetchMarket } from '../lib/polymarket-api';
import type { Logger, LogLevel } from '../lib/logger';
import { logMessage } from '../lib/logger';
import { priceCompactDependants } from '../services/compact-relations';
import type { Decision } from '../services/compact-relations';
import type { RelationType } from '@pindex/relations-engine';

export const dependenciesRouter = new Hono();

interface DependenciesRequest {
  url?: string;
  visited?: string[];
  weight: number;
  decision?: Decision | string;
  volatility?: number;
  options?: {
    epsilon?: number;
  };
}

interface DependantMeta {
  id: string;
  probability: number;
  relation: RelationType;
  explanation: string;
  question?: string;
  url?: string;
  yesPercentage?: number;
  noPercentage?: number;
}

function isWeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isVolatility(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeDecision(value: Decision | string | undefined): Decision {
  if (typeof value === 'string' && value.toLowerCase() === 'no') {
    return 'no';
  }
  return 'yes';
}

function clampProbability(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function extractVisitedSlugs(visited: unknown, warnings: string[]): string[] {
  if (!Array.isArray(visited)) {
    return [];
  }

  const slugs: string[] = [];

  for (const entry of visited) {
    if (typeof entry !== 'string') {
      warnings.push('invalid_visited:non_string_entry');
      continue;
    }

    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const slug = extractSlugFromUrl(trimmed);
    if (!slug) {
      warnings.push(`invalid_visited_url:${trimmed}`);
      continue;
    }

    slugs.push(slug);
  }

  return Array.from(new Set(slugs));
}

function formatLogPayload(level: LogLevel, message: string, meta?: unknown): string {
  const payload = meta === undefined ? { level, message } : { level, message, meta };
  return `log - ${JSON.stringify(payload)}`;
}

function formatFinalPayload(payload: unknown): string {
  return `final - ${JSON.stringify(payload)}`;
}

async function resolveBetSlug(
  bet: FoundRelatedBet,
  cache: Map<string, string | null>,
  logger: Logger
): Promise<string | undefined> {
  const directSlug = bet.eventSlug || bet.market.market_slug || bet.market.event_slug;
  if (directSlug) {
    return directSlug;
  }

  if (cache.has(bet.marketId)) {
    const cached = cache.get(bet.marketId);
    return cached || undefined;
  }

  try {
    const market = await fetchMarket(bet.marketId, logger);
    const fetchedSlug = market.market_slug || market.event_slug;
    cache.set(bet.marketId, fetchedSlug || null);
    return fetchedSlug || undefined;
  } catch (error) {
    logger('log', `Failed to resolve slug for market ${bet.marketId}`, error);
    cache.set(bet.marketId, null);
    return undefined;
  }
}

function createSseLogger(stream: any, warnings: string[]): Logger {
  return (level, message, meta) => {
    void stream.writeSSE({ data: formatLogPayload(level, message, meta) });

    if (level === 'warn' || level === 'error') {
      warnings.push(`${level}:${message}`);
    }

    logMessage(undefined, level, message, meta);
  };
}

dependenciesRouter.post('/', async (c: Context) => {
  const { success } = await c.env.RATE_LIMITER.limit({ key: "dependencies" }) // key can be any string of your choosing
  if (!success) {
  return new Response(`429 Failure – rate limit exceeded for dependencies`, { status: 429 })
  }
  return streamSSE(c, async (stream) => {
    let payload: DependenciesRequest;

    const warnings: string[] = [];
    const logger = createSseLogger(stream, warnings);

    try {
      payload = await c.req.json();
    } catch (error) {
      logger('error', 'Invalid JSON payload', error);
      c.status(400);
      await stream.writeSSE({
        data: formatFinalPayload({ error: 'Invalid JSON payload' }),
      });
      return;
    }

    const { url, visited, weight, decision, volatility, options } = payload;

    if (typeof url !== 'string' || url.trim().length === 0) {
      logger('warn', 'Missing url');
      c.status(400);
      await stream.writeSSE({
        data: formatFinalPayload({ error: 'url is required.' }),
      });
      return;
    }

    const trimmedUrl = url.trim();

    if (!extractSlugFromUrl(trimmedUrl)) {
      logger('warn', 'Invalid Polymarket event URL');
      c.status(400);
      await stream.writeSSE({
        data: formatFinalPayload({ error: 'url must be a Polymarket event URL.' }),
      });
      return;
    }

    if (!isWeight(weight)) {
      logger('warn', 'Invalid weight');
      c.status(400);
      await stream.writeSSE({
        data: formatFinalPayload({ error: 'weight must be a positive number.' }),
      });
      return;
    }

    if (volatility !== undefined && !isVolatility(volatility)) {
      logger('warn', 'Invalid volatility');
      c.status(400);
      await stream.writeSSE({
        data: formatFinalPayload({ error: 'volatility must be a non-negative number.' }),
      });
      return;
    }

    try {
      const visitedSlugs = extractVisitedSlugs(visited, warnings);

      logger('log', 'Resolving market from URL');
      const resolvedMarketId = await parseMarketInput(trimmedUrl, logger);

      logger('log', 'Fetching source market');
      const sourceMarket = await fetchMarket(resolvedMarketId, logger);
      const sourcePercentages = getMarketPercentages(sourceMarket, c, logger);
      const rootProbability = clampProbability(sourcePercentages.yes / 100);

      logger('log', 'Finding related bets');
      const desiredDependants = 4;
      const candidateLimit = Math.max(desiredDependants * 4, 12);
      const relatedBets: FoundRelatedBet[] = [];
      for await (const bet of findRelatedBets(sourceMarket, visitedSlugs, c, logger, {
        maxResults: candidateLimit,
      })) {
        relatedBets.push(bet);
        logger('log', 'related-bet-found', {
          marketId: bet.marketId,
          question: bet.market.question,
          relationship: bet.relationship,
        });
      }

      if (relatedBets.length === 0) {
        warnings.push('no_related_bets:No related bets found.');
      }

      const slugCache = new Map<string, string | null>();
      const dependantMeta: DependantMeta[] = await Promise.all(relatedBets.map(async (bet) => {
        const slug = await resolveBetSlug(bet, slugCache, logger);
        const id = slug || bet.marketId;
        if (!slug) {
          warnings.push(`missing_slug:${bet.marketId}:Using marketId as id.`);
        }

        const probability = clampProbability(bet.yesPercentage / 100);
        const urlValue = slug ? `https://polymarket.com/event/${slug}` : undefined;

        return {
          id,
          probability,
          relation: bet.relationship,
          explanation: bet.reasoning,
          question: bet.market.question,
          url: urlValue,
          yesPercentage: bet.yesPercentage,
          noPercentage: bet.noPercentage,
        };
      }));

      logger('log', 'Pricing dependant relations');
      const pricingInputs = dependantMeta.map(dep => ({
        id: dep.id,
        probability: dep.probability,
        relation: dep.relation,
      }));
      const baseEpsilon = options?.epsilon ?? 0.01;
      let usedEpsilon = baseEpsilon;
      let pricing = priceCompactDependants(
        {
          probability: rootProbability,
          weight,
          decision,
          id: sourceMarket.id,
        },
        pricingInputs,
        {
          volatility,
          epsilon: baseEpsilon,
        }
      );

      const metaById = new Map(dependantMeta.map(dep => [dep.id, dep]));

      let nonZeroDependants = pricing.dependants.filter(dep => dep.weight > 0);
      if (options?.epsilon === undefined && nonZeroDependants.length < desiredDependants) {
        const epsilonSteps = baseEpsilon > 0 ? [baseEpsilon / 2, baseEpsilon / 4, 0] : [0];
        for (const epsilon of epsilonSteps) {
          pricing = priceCompactDependants(
            {
              probability: rootProbability,
              weight,
              decision,
              id: sourceMarket.id,
            },
            pricingInputs,
            {
              volatility,
              epsilon,
            }
          );
          nonZeroDependants = pricing.dependants.filter(dep => dep.weight > 0);
          usedEpsilon = epsilon;
          if (nonZeroDependants.length >= desiredDependants || epsilon === 0) {
            break;
          }
        }

        if (usedEpsilon !== baseEpsilon) {
          logger('log', `Adjusted epsilon to ${usedEpsilon} to surface more dependants`);
        }
      }

      if (nonZeroDependants.length < pricing.dependants.length) {
        warnings.push('zero_weight_filtered:Removed zero-weight dependants.');
      }

      const finalDependants = nonZeroDependants.slice(0, desiredDependants);
      if (finalDependants.length < Math.min(desiredDependants, pricing.dependants.length)) {
        warnings.push('insufficient_nonzero_dependants:Not enough non-zero dependants found.');
      }

      const dependants = finalDependants.map(dep => {
        const meta = metaById.get(dep.id);
        return {
          id: dep.id,
          weight: dep.weight,
          decision: dep.decision,
          relation: dep.relation,
          explanation: meta?.explanation ?? '',
          question: meta?.question,
          url: meta?.url,
          probability: meta?.probability,
          yesPercentage: meta?.yesPercentage,
          noPercentage: meta?.noPercentage,
        };
      });

      await stream.writeSSE({
        data: formatFinalPayload({
          sourceMarket: {
            id: sourceMarket.id,
            slug: sourceMarket.market_slug,
            question: sourceMarket.question,
            yesPercentage: sourcePercentages.yes,
            noPercentage: sourcePercentages.no,
            probability: rootProbability,
            weight,
            decision: normalizeDecision(decision),
          },
          dependants,
          warnings: [...warnings, ...pricing.warnings],
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to build dependencies';
      logger('error', message, error);
      c.status(500);
      await stream.writeSSE({
        data: formatFinalPayload({ error: message }),
      });
    }
  });
});
