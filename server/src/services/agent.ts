// agent worker

import { questionQueue } from '../core/queue';
import { generateMarketProposal } from '../lib/openai';
import { broadcast } from '../core/sse';

let agentRunning = false;

export async function startAgent() {
  if (agentRunning) {
    console.log('Agent already running');
    return;
  }

  agentRunning = true;
  console.log('✓ Agent loop started');

  // Background loop
  while (agentRunning) {
    try {
      const question = questionQueue.getNext();

      if (question) {
        console.log(`Processing question: ${question.id}`);

        questionQueue.update(question.id, { status: 'processing' });
        broadcast({ type: 'question-processing', question });

        // Generate proposal using OpenAI
        const proposal = await generateMarketProposal(question.question);

        questionQueue.update(question.id, {
          status: 'completed',
          proposal,
        });

        broadcast({ type: 'question-completed', question: questionQueue.get(question.id) });

        console.log(`✓ Completed: ${question.id}`);
      }

      // Sleep before next iteration
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Agent error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

export function stopAgent() {
  agentRunning = false;
  console.log('Agent loop stopped');
}
