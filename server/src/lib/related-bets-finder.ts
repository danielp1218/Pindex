import OpenAI from 'openai';
import type { PolymarketMarket, BetRelationship } from '../types';
import {
  fetchMarkets,
  searchEventsByKeywords,
  searchEventsByCategory,
  type PolymarketEvent,
} from './polymarket-api';
import { fetchEventMarkets } from './url-parser';
import { logMessage, type Logger } from './logger';
import { Context } from 'hono';

const openai = (c: Context) => {
  return new OpenAI({
    apiKey: c.env.OPENAI_API_KEY,
  });
}

/**
 * Generate search keywords from a market using LLM
 */
async function generateSearchKeywords(
  market: PolymarketMarket,
  c: Context,
  logger?: Logger
): Promise<string[]> {
  try {
    const completion = await openai(c).chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a search keyword generator for prediction markets. Extract 2-4 SHORT, SPECIFIC keywords for searching.

RULES:
- Each keyword should be 1-2 words maximum
- Focus on proper nouns (names, places, organizations)
- Include key identifiers (dates, numbers, specific events)
- NO generic words like "win", "election", "market"
- NO full phrases or questions

GOOD Examples:
- "Will Bitcoin hit $100k in 2026?" → ["Bitcoin", "2026", "100k"]
- "Will Trump win 2024 election?" → ["Trump", "2024"]
- "Lakers vs Warriors winner" → ["Lakers", "Warriors"]
- "Portugal presidential election" → ["Portugal", "presidential"]

BAD Examples:
- "election winner" (too generic)
- "will win the election" (full phrase)
- "cryptocurrency market" (too broad)

Return JSON array of 2-4 short keywords:
{"keywords": ["keyword1", "keyword2"]}`
        },
        {
          role: 'user',
          content: `Market: ${market.question}\n\nExtract short, specific keywords:`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 50,
    });

    const content = completion.choices[0].message.content?.trim() || '{}';
    const result = JSON.parse(content);
    const keywords = result.keywords || [];
    
    logMessage(
      logger,
      'log',
      `Generated keywords for "${market.question}": ${keywords.join(', ')}`
    );
    return keywords;
  } catch (error) {
    logMessage(logger, 'error', 'Error generating keywords', error);
    // Fallback: extract key terms from question
    const words = market.question
      .split(' ')
      .filter(w => w.length > 3 && !/^(will|the|and|or|for|in|on|at|to|by|win|lose)$/i.test(w))
      .slice(0, 3);
    return words;
  }
}

/**
 * Use LLM to select 8 most relevant events from search results, filtering out visitedSlugs
 */
async function selectRelevantEvents(
  market: PolymarketMarket,
  events: PolymarketEvent[],
  visitedSlugs: string[] = [],
  c: Context,
  logger?: Logger
): Promise<string[]> {
  // Filter out visited slugs first
  const unvisitedEvents = events.filter(e => !visitedSlugs.includes(e.slug));
  
  if (unvisitedEvents.length === 0) {
    logMessage(logger, 'log', 'No unvisited events found after filtering');
    return [];
  }

  try {
    const eventsContext = unvisitedEvents.map(e => 
      `Slug: ${e.slug}\nTitle: ${e.title}\nDescription: ${e.description?.substring(0, 150) || 'N/A'}`
    ).join('\n\n---\n\n');

    const completion = await openai(c).chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are selecting the most relevant events for a prediction market analysis.

Source Market: "${market.question}"
Description: ${market.description?.substring(0, 200) || 'N/A'}

Select 8 events that are MOST RELEVANT to finding related markets. Look for:
- Same topic/domain (politics, sports, crypto, etc.)
- Related outcomes or dependencies
- Similar timeframes
- Causal relationships

Return JSON with array of slugs:
{
  "slugs": ["slug-1", "slug-2", "slug-3", ...]
}`
        },
        {
          role: 'user',
          content: `Available events:\n\n${eventsContext}\n\nSelect up to 8 most relevant event slugs:`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content;
    if (!content) return [];

    const result = JSON.parse(content);
    const selectedSlugs = (result.slugs || []).slice(0, 8); // Cap at 8
    logMessage(
      logger,
      'log',
      `Selected ${selectedSlugs.length} relevant events`,
      selectedSlugs
    );
    return selectedSlugs;
  } catch (error) {
    logMessage(logger, 'error', 'Error selecting relevant events', error);
    // Fallback: return first 8 unvisited event slugs
    return unvisitedEvents.slice(0, 8).map(e => e.slug);
  }
}

/**
 * Infer market category using LLM for fallback search
 */
async function getMarketCategory(
  market: PolymarketMarket,
  c: Context,
  logger?: Logger
): Promise<string> {
  try {
    const completion = await openai(c).chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Classify this market into ONE category: Politics, Crypto, Sports, Science, Entertainment, or Other. Return ONLY the category name.'
        },
        {
          role: 'user',
          content: `Question: ${market.question}\nDescription: ${market.description?.substring(0, 200) || 'N/A'}`
        }
      ],
      temperature: 0.2,
      max_tokens: 10,
    });

    const category = completion.choices[0].message.content?.trim() || 'Other';
    logMessage(
      logger,
      'log',
      `Inferred category for "${market.question}": ${category}`
    );
    return category;
  } catch (error) {
    logMessage(logger, 'error', 'Error inferring category', error);
    return 'Other';
  }
}

export interface FoundRelatedBet {
  marketId: string;
  market: PolymarketMarket;
  eventSlug?: string; // Event slug for URL construction
  relationship: BetRelationship;
  reasoning: string;
  yesPercentage: number;
  noPercentage: number;
}


export function getMarketPercentages(
  market: any,
  c: Context,
  logger?: Logger
): { yes: number; no: number } {
  // Try tokens array first (CLOB format)
  if (market.tokens && market.tokens.length >= 2) {
    const yesToken = market.tokens.find((t: any) => t.outcome?.toLowerCase() === 'yes');
    const noToken = market.tokens.find((t: any) => t.outcome?.toLowerCase() === 'no');

    if (yesToken && noToken && yesToken.price !== undefined && noToken.price !== undefined) {
      return {
        yes: parseFloat((yesToken.price * 100).toFixed(2)),
        no: parseFloat((noToken.price * 100).toFixed(2))
      };
    }
  }

  // Try outcomePrices field (Gamma API format - JSON string or array)
  if (market.outcomePrices) {
    try {
      let prices = market.outcomePrices;
      
      // Parse if string
      if (typeof prices === 'string') {
        prices = JSON.parse(prices);
      }
      
      // Validate array
      if (Array.isArray(prices) && prices.length >= 2) {
        const price0 = parseFloat(String(prices[0]));
        const price1 = parseFloat(String(prices[1]));
        
        // Validate parsed numbers
        if (!isNaN(price0) && !isNaN(price1)) {
          // Check if prices are already in percentage form (0-100) or decimal form (0-1)
          const isPercentage = price0 > 1 || price1 > 1;
          
          if (isPercentage) {
            return {
              yes: parseFloat(price0.toFixed(2)),
              no: parseFloat(price1.toFixed(2))
            };
          } else {
            return {
              yes: parseFloat((price0 * 100).toFixed(2)),
              no: parseFloat((price1 * 100).toFixed(2))
            };
          }
        }
      }
    } catch (error) {
      logMessage(logger, 'warn', `Failed to parse outcomePrices for market ${market.id || market.conditionId}: ${error}`);
    }
  }

  // Try lastTradePrice field (some markets have this)
  if (market.lastTradePrice !== undefined) {
    const price = parseFloat(String(market.lastTradePrice));
    if (!isNaN(price)) {
      const isPercentage = price > 1;
      const yesPrice = isPercentage ? parseFloat(price.toFixed(2)) : parseFloat((price * 100).toFixed(2));
      return { yes: yesPrice, no: parseFloat((100 - yesPrice).toFixed(2)) };
    }
  }

  // Fallback: check for direct price fields
  if (market.price !== undefined) {
    const price = parseFloat(String(market.price));
    if (!isNaN(price)) {
      const isPercentage = price > 1;
      const yesPrice = isPercentage ? parseFloat(price.toFixed(2)) : parseFloat((price * 100).toFixed(2));
      return { yes: yesPrice, no: parseFloat((100 - yesPrice).toFixed(2)) };
    }
  }

  // Debug: log the actual outcomePrices value
  if (market.outcomePrices !== undefined) {
    logMessage(
      logger,
      'warn',
      `Could not extract prices for market ${market.id || market.conditionId}. outcomePrices value: ${JSON.stringify(market.outcomePrices)}`
    );
  } else {
    logMessage(
      logger,
      'warn',
      `Unable to extract prices for market ${market.id || market.conditionId}. No price fields found. Using 50-50 fallback.`
    );
  }
  
  return { yes: 50.0, no: 50.0 };
}

function getOutcomes(market: PolymarketMarket): string[] {
  // Try outcomes array first (legacy format)
  if (market.outcomes && Array.isArray(market.outcomes)) {
    return market.outcomes;
  }
  // Fall back to extracting from tokens array (CLOB format)
  if (market.tokens && Array.isArray(market.tokens)) {
    return market.tokens.map(t => t.outcome);
  }
  // Default fallback
  return ['Yes', 'No'];
}

export async function* findRelatedBets(
  sourceMarket: PolymarketMarket,
  visitedSlugs: string[] = [],
  c: Context,
  logger?: Logger
): AsyncGenerator<FoundRelatedBet> {
  const MAX_RESULTS = 4; // Maximum number of related bets to return
  const MIN_RESULTS = 3; // Minimum target - keep searching until we reach this
  let foundCount = 0;

  // New workflow: Generate keywords → Search events → LLM selects events → Fetch markets
  let eventMarkets: any[] = [];
  
  try {
    logMessage(logger, 'log', 'Starting keyword-based event search...');
    
    // Step 1: Generate search keywords using LLM (returns array)
    const keywords = await generateSearchKeywords(sourceMarket, c, logger);
    
    // Step 2: Search for events using each keyword individually and combine results
    const allEvents: PolymarketEvent[] = [];
    const seenEventSlugs = new Set<string>();
    
    for (const keyword of keywords) {
      const keywordEvents = await searchEventsByKeywords(keyword, logger);
      logMessage(
        logger,
        'log',
        `Found ${keywordEvents.length} events for keyword "${keyword}"`
      );
      
      // Deduplicate by slug
      for (const event of keywordEvents) {
        if (!seenEventSlugs.has(event.slug)) {
          seenEventSlugs.add(event.slug);
          allEvents.push(event);
        }
      }
    }
    
    logMessage(
      logger,
      'log',
      `Total unique events from all keywords: ${allEvents.length}`
    );
    
    let events = allEvents;
    
    // Step 3: Fallback to category-based search if no results
    if (events.length === 0) {
      logMessage(logger, 'log', 'No events found, trying category-based fallback...');
      const category = await getMarketCategory(sourceMarket, c, logger);
      events = await searchEventsByCategory(category, logger);
      logMessage(
        logger,
        'log',
        `Found ${events.length} events from category search (${category})`
      );
    }
    
    // Step 4: LLM selects 8 most relevant events, filtering out visited slugs
    if (events.length > 0) {
      const selectedSlugs = await selectRelevantEvents(
        sourceMarket,
        events,
        visitedSlugs,
        c,
        logger
      );
      logMessage(
        logger,
        'log',
        `LLM selected ${selectedSlugs.length} relevant events`
      );
      
      // Step 5: Fetch markets from selected events and tag with event slug
      for (const slug of selectedSlugs) {
        const markets = await fetchEventMarkets(slug, logger);
        // Tag each market with its event slug for URL construction
        const taggedMarkets = markets.map(m => ({ ...m, _eventSlug: slug }));
        eventMarkets.push(...taggedMarkets);
      }
      logMessage(
        logger,
        'log',
        `Fetched ${eventMarkets.length} markets from ${selectedSlugs.length} selected events`
      );
    }
  } catch (error) {
    logMessage(logger, 'error', 'Error in keyword-based event search', error);
    // Continue with empty eventMarkets on error
  }

  // Always fetch general markets if we have fewer than 20 event markets to ensure enough candidates
  let allMarkets: any[] = [];
  
  if (eventMarkets.length < 20) {
    allMarkets = await fetchMarkets(logger);
    logMessage(
      logger,
      'log',
      `Fetched ${allMarkets.length} general markets to supplement ${eventMarkets.length} event markets`
    );
  } else {
    logMessage(
      logger,
      'log',
      `Using ${eventMarkets.length} event markets (sufficient, skipping general fetch)`
    );
  }

  // Combine: event markets first (highest priority), then general markets
  const combinedMarkets = [...eventMarkets, ...allMarkets];

  // Filter out source market and remove duplicates
  const seenIds = new Set<string>();
  const candidateMarkets = combinedMarkets
    .filter(m => {
      const sourceId = sourceMarket.condition_id || sourceMarket.id;
      const candidateId = m.conditionId || m.condition_id || m.id;

      if (sourceId === candidateId) return false;
      if (seenIds.has(candidateId)) return false;

      seenIds.add(candidateId);
      return true;
    })
    .slice(0, 50); // Only analyze first 50 markets max

  logMessage(
    logger,
    'log',
    `Analyzing ${candidateMarkets.length} candidate markets (stopping after ${MAX_RESULTS} found)`
  );

  const seenMarketIds = new Set<string>();

  // Get source market probabilities for context
  const sourcePercentages = getMarketPercentages(sourceMarket, c, logger);

  // Multi-layer AI reasoning system
  const systemPrompt = `You are a strategic prediction market analyst finding ACTIONABLE related bets.

Source Market:
- Question: ${sourceMarket.question}
- Current Odds: ${sourcePercentages.yes}% YES / ${sourcePercentages.no}% NO
- Description: ${sourceMarket.description?.substring(0, 300)}...

YOUR GOAL: Find markets where betting strategy changes based on beliefs about the source market.

GOOD Related Markets:
✓ Markets with hedging opportunities (opposite positions reduce risk)
✓ Markets with arbitrage potential (related but mispriced)
✓ Markets with causal relationships (one outcome affects another)
✓ Markets with competitive odds (10-90% range, not extreme long shots)
✓ Markets where information advantage transfers

BAD Related Markets:
✗ Extreme long shots (<5% or >95%) - no trading opportunity
✗ Same exact market in different words (redundant)
✗ Weak correlations without clear reasoning
✗ Markets from the same multi-outcome event (just partitions)

Relationship Types:
- IMPLIES: If this market YES → source YES (this market implies the source)
- CONTRADICTS: If source YES → this market NO more likely (inverse hedge)
- SUBEVENT: This event directly causes/prevents source outcome (risk factor)
- CONDITIONED_ON: Source outcome is prerequisite for this market
- WEAK_SIGNAL: Correlated indicator (only if odds are interesting)

DO NOT return PARTITION_OF relationships - those are just different options in the same event.

Return JSON with "related" array:
{
  "related": [
    {
      "marketId": "condition_id or id",
      "relationship": "IMPLIES|CONTRADICTS|SUBEVENT|CONDITIONED_ON|WEAK_SIGNAL",
      "reasoning": "Brief explanation of the strategic relationship and why odds matter"
    }
  ]
}

IMPORTANT: 
- Return ALL markets that have strong strategic relationships
- Ignore markets with extreme odds (<5% or >95%) unless exceptional reasoning
- Prioritize IMPLIES, CONTRADICTS, SUBEVENT over WEAK_SIGNAL
- Focus on markets where position in source market informs trading strategy
- Return empty array only if NO good opportunities exist: {"related": []}`;

  // Process in batches - stop early when we have enough results
  const batchSize = 10; // Smaller batches for faster initial results
  for (let i = 0; i < candidateMarkets.length; i += batchSize) {
    // Early exit only if we've found at least MIN_RESULTS AND reached MAX_RESULTS
    if (foundCount >= MAX_RESULTS) {
      logMessage(
        logger,
        'log',
        `Reached maximum of ${MAX_RESULTS} related bets - stopping search`
      );
      break;
    }
    
    // Log progress if we haven't reached minimum yet
    if (foundCount < MIN_RESULTS) {
      logMessage(
        logger,
        'log',
        `Found ${foundCount}/${MIN_RESULTS} (minimum) related bets so far, continuing search...`
      );
    }

    const batch = candidateMarkets.slice(i, i + batchSize);

    const batchContext = batch.map((m) => {
      const marketId = m.conditionId || m.condition_id || m.id;
      const percentages = getMarketPercentages(m, c, logger);
      return `ID: ${marketId}
Question: ${m.question}
Odds: ${percentages.yes}% YES / ${percentages.no}% NO
Description: ${m.description?.substring(0, 150)}...`;
    }).join('\n\n---\n\n');

    try {
      const completion = await openai(c).chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze these candidate markets:\n\n${batchContext}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent results
      });

      const content = completion.choices[0].message.content;
      if (!content) continue;

      const result = JSON.parse(content);
      const relatedBets = result.related || [];

      // Yield each found related bet
      for (const bet of relatedBets) {
        // Find the actual market
        const market = batch.find(m => {
          const marketId = m.conditionId || m.condition_id || m.id;
          return marketId === bet.marketId;
        });

        if (!market) continue;

        const marketId = market.conditionId || market.condition_id || market.id;

        // Skip if already seen
        if (seenMarketIds.has(marketId)) {
          continue;
        }

        seenMarketIds.add(marketId);

        // Validate relationship type
        const validRelationships: BetRelationship[] = [
          'IMPLIES', 'CONTRADICTS', 'PARTITION_OF', 'SUBEVENT', 'CONDITIONED_ON', 'WEAK_SIGNAL'
        ];
        const relationship = validRelationships.includes(bet.relationship)
          ? bet.relationship
          : 'WEAK_SIGNAL';

        // Get percentages
        const percentages = getMarketPercentages(market, c, logger);

        yield {
          marketId,
          market: {
            id: marketId,
            condition_id: market.condition_id || marketId,
            market_slug: market.market_slug,
            question: market.question,
            description: market.description,
            outcomes: getOutcomes(market),
            tokens: market.tokens,
            volume: market.volume,
            liquidity: market.liquidity,
          },
          eventSlug: (market as any)._eventSlug, // Get event slug if available
          relationship: relationship as BetRelationship,
          reasoning: bet.reasoning || 'Related market',
          yesPercentage: percentages.yes,
          noPercentage: percentages.no,
        };

        foundCount++;

        // Stop if we've found enough
        if (foundCount >= MAX_RESULTS) {
          logMessage(
            logger,
            'log',
            `Reached ${MAX_RESULTS} related bets - stopping search`
          );
          return;
        }
      }
    } catch (error) {
      logMessage(
        logger,
        'error',
        `Error processing batch ${i}-${i + batchSize}`,
        error
      );
      // Continue with next batch even if this one fails
    }
  }
}
