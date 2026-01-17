import { Hono } from 'hono';
import { questionQueue } from '../core/queue';

export const healthRouter = new Hono();

healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    queue: questionQueue.getAll().length,
    processing: questionQueue.isProcessing(),
  });
});
