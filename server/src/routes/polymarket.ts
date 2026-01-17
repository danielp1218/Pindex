import { Hono } from 'hono';
import { fetchMarkets, searchMarkets } from '../lib/polymarket-api';

export const polymarketRouter = new Hono();

// Fetch all markets
polymarketRouter.get('/markets', async (c) => {
  try {
    const markets = await fetchMarkets();
    return c.json(markets);
  } catch (error) {
    return c.json({ error: 'Failed to fetch markets' }, 500);
  }
});

// Search markets
polymarketRouter.get('/search', async (c) => {
  const query = c.req.query('q');
  if (!query) {
    return c.json({ error: 'Query required' }, 400);
  }

  try {
    const markets = await searchMarkets(query);
    return c.json(markets);
  } catch (error) {
    return c.json({ error: 'Failed to search markets' }, 500);
  }
});
