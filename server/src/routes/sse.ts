import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { addClient, removeClient } from '../core/sse';
import { questionQueue } from '../core/queue';

export const sseRouter = new Hono();

sseRouter.get('/', (c) => {
  return streamSSE(c, async (stream) => {
    const clientId = addClient(stream as any);

    // Send initial state
    await stream.writeSSE({
      data: JSON.stringify({
        type: 'connected',
        clientId,
        questions: questionQueue.getAll(),
      }),
    });

    // Keep connection alive
    const keepAlive = setInterval(async () => {
      await stream.writeSSE({
        data: '',
        event: 'keepalive',
      });
    }, 15000);

    // Wait for connection close
    c.req.raw.signal.addEventListener('abort', () => {
      clearInterval(keepAlive);
      removeClient(clientId);
    });
  });
});
