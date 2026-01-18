import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { healthRouter } from './routes/health';
import { relationsRouter } from './routes/relations';
import { relatedBetsRouter } from './routes/related-bets';
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
    },
  });
});

app.route('/health', healthRouter);
app.route('/api/relations', relationsRouter);
app.route('/api/related-bets', relatedBetsRouter);
app.route('/api/dependencies', dependenciesRouter);

export default app;
