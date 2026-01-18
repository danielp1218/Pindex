import 'dotenv/config';
import { initializeTracing, shutdownTracing } from './lib/phoenix';
initializeTracing();
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRouter } from './routes/health';
import { relationsRouter } from './routes/relations';
import { relatedBetsRouter } from './routes/related-bets';
import { phoenixRouter } from './routes/phoenix';
import { dependenciesRouter } from './routes/dependencies';

const app = new Hono();

app.use('/*', cors());

app.get('/', (c) => {
  return c.json({
    name: 'Pindex Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      relations: '/api/relations',
      relatedBets: '/api/related-bets',
      dependencies: '/api/dependencies',
      phoenix: '/api/phoenix',
    },
  });
});

app.route('/health', healthRouter);
app.route('/api/relations', relationsRouter);
app.route('/api/related-bets', relatedBetsRouter);
app.route('/api/dependencies', dependenciesRouter);
app.route('/api/phoenix', phoenixRouter);

const port = Number(process.env.PORT) || 8000;

serve({
  fetch: app.fetch,
  port,
});

console.log(`✓ Server running on http://localhost:${port}`);

const shutdown = async () => {
  console.log('\nShutting down...');
  await shutdownTracing();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
