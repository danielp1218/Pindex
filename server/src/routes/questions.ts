import { Hono } from 'hono';
import { questionQueue } from '../core/queue';
import { broadcast } from '../core/sse';

export const questionsRouter = new Hono();

// Submit question
questionsRouter.post('/', async (c) => {
  const { question } = await c.req.json<{ question: string }>();

  if (!question) {
    return c.json({ error: 'Question required' }, 400);
  }

  const q = questionQueue.add(question);
  broadcast({ type: 'question-added', question: q });

  return c.json(q);
});

// Get all questions
questionsRouter.get('/', (c) => {
  return c.json(questionQueue.getAll());
});

// Get specific question
questionsRouter.get('/:id', (c) => {
  const id = c.req.param('id');
  const question = questionQueue.get(id);

  if (!question) {
    return c.json({ error: 'Question not found' }, 404);
  }

  return c.json(question);
});
