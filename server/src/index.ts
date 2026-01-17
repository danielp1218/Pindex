import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { setupTracing } from './lib/phoenix';
import { startAgent } from './services/agent';
import { healthRouter } from './routes/health';
import { sseRouter } from './routes/sse';
import { questionsRouter } from './routes/questions';
import { polymarketRouter } from './routes/polymarket';

// Setup tracing
setupTracing();

const app = new Hono();

// CORS middleware
app.use('/*', cors());

// Root route
app.get('/', (c) => {
  return c.json({
    name: 'Polyindex Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      events: '/events (SSE)',
      questions: '/api/questions',
      polymarket: '/api/polymarket',
    },
  });
});

app.route('/health', healthRouter);
app.route('/events', sseRouter);
app.route('/api/questions', questionsRouter);
app.route('/api/polymarket', polymarketRouter);

const port = Number(process.env.PORT) || 8000;

console.log(`Server starting on port ${port}...`);

// Start background agent loop
startAgent();

serve({
  fetch: app.fetch,
  port,
});

console.log(`✓ Server running on http://localhost:${port}`);
