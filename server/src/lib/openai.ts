// open ai layer

import OpenAI from 'openai';
import type { MarketProposal } from '../types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateMarketProposal(question: string): Promise<MarketProposal> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a prediction market expert. Generate a well-structured market proposal for Polymarket.

Return JSON with:
- question: Clear, unambiguous question
- description: Detailed context and background
- outcomes: Array of possible outcomes (usually ["Yes", "No"] for binary)
- resolutionCriteria: How the market will be resolved
- endDate: ISO date string for market end (reasonable future date)

Keep it deterministic and objective.`,
      },
      {
        role: 'user',
        content: question,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  return JSON.parse(content);
}
