import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { relationsRouter } from './routes/relations';
import { relatedBetsRouter } from './routes/related-bets';
import { dependenciesRouter } from './routes/dependencies';
import type { Context } from 'hono';

const app = new Hono();

// Validate required environment variables on startup
app.use('*', async (c: Context, next) => {
  if (!c.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is not set');
    return c.json({ error: 'Server misconfiguration: api key not set' }, 500);
  }
  await next();
});

app.use('/*', cors());

// Type assertion fixes "Type instantiation is excessively deep" error
app.get('/', (c) => c.json({
  name: 'Pindex Server',
  version: '1.0.0',
  endpoints: {
    relations: '/api/relations',
    relationsPricing: '/api/relations/price',
    relationsGraph: '/api/relations/graph',
    relationsGraphPricing: '/api/relations/graph/price',
    relatedBets: '/api/related-bets',
    dependencies: '/api/dependencies',
  },
} as const));

app.route('/api/relations', relationsRouter);
app.route('/api/related-bets', relatedBetsRouter);
app.route('/api/dependencies', dependenciesRouter);

export default app;
