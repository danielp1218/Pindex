import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { parseMarketInput } from '../lib/url-parser';
import { findRelatedBets } from '../lib/related-bets-finder';
import { fetchMarket } from '../lib/polymarket-api';
import type { Logger, LogLevel } from '../lib/logger';

export const relatedBetsRouter = new Hono();

function formatLogPayload(level: LogLevel, message: string, meta?: unknown): string {
  const payload = meta === undefined ? { level, message } : { level, message, meta };
  return `log - ${JSON.stringify(payload)}`;
}

function formatFinalPayload(payload: unknown): string {
  return `final - ${JSON.stringify(payload)}`;
}

function createSseLogger(stream: any): Logger {
  return (level, message, meta) => {
    const data = formatLogPayload(level, message, meta);
    void stream.writeSSE({ data });

    const consoleFn =
      level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    if (meta !== undefined) {
      consoleFn(message, meta);
    } else {
      consoleFn(message);
    }
  };
}

// Takes either a Polymarket URL or CLOB market ID (condition_id)
// Streams logs and a final response over SSE
relatedBetsRouter.post('/', (c) => {
  return streamSSE(c, async (stream) => {
    const logger = createSseLogger(stream);

    let payload: {
      marketId?: string;
      url?: string;
      visitedSlugs?: string[];
    };

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

    const { marketId, url, visitedSlugs } = payload;

    // Accept either marketId or url
    const input = marketId || url;

    if (!input) {
      logger('warn', 'Missing marketId or url');
      c.status(400);
      await stream.writeSSE({
        data: formatFinalPayload({ error: 'Either marketId or url is required' }),
      });
      return;
    }

    try {
      logger('log', 'Resolving market input');
      // Parse the input - handles both URLs and direct market IDs
      const resolvedMarketId = await parseMarketInput(input, logger);

      // Fetch the source market
      const sourceMarket = await fetchMarket(resolvedMarketId, logger);

      // Find related bets (this streams results but we'll collect them all)
      const relatedBets = [];
      for await (const bet of findRelatedBets(sourceMarket, visitedSlugs || [], c, logger)) {
        relatedBets.push(bet);
        logger('log', 'related-bet-found', {
          marketId: bet.marketId,
          question: bet.market.question,
          relationship: bet.relationship,
        });
      }

      // Cut down to 4 if there are more than 4
      const finalRelatedBets = relatedBets.length > 4 ? relatedBets.slice(0, 4) : relatedBets;
      
      if (relatedBets.length > 4) {
        logger('log', `Cut down from ${relatedBets.length} to 4 related bets`);
      }

      // Stream final results in clean format
      await stream.writeSSE({
        data: formatFinalPayload({
          sourceMarket: {
            id: sourceMarket.id,
            question: sourceMarket.question,
            slug: sourceMarket.market_slug,
          },
          relatedBets: finalRelatedBets.map(bet => {
            // Use event slug if available (for markets from events), otherwise market slug
            const slug = bet.eventSlug || bet.market.market_slug;
            const url = slug ? `https://polymarket.com/event/${slug}` : undefined;

            if (!url) {
              logger('warn', `No URL for market ${bet.marketId}: ${bet.market.question}`);
            }

            return {
              marketId: bet.marketId,
              question: bet.market.question,
              slug,
              url,
              relationship: bet.relationship,
              reasoning: bet.reasoning,
              yesPercentage: bet.yesPercentage,
              noPercentage: bet.noPercentage,
            };
          }),
        }),
      });
    } catch (error) {
      logger('error', 'Error finding related bets', error);
      await stream.writeSSE({
        data: formatFinalPayload({
          error: error instanceof Error ? error.message : 'Failed to find related bets',
        }),
      });
    }
  });
});
