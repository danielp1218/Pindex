// Automatic Prompt Optimizer - uses resolved Polymarket data as ground truth
// Optimizes prompts by: few-shot injection, failure pattern analysis, prompt mutation

import OpenAI from 'openai';
import { registerPrompt, getPrompt, type PromptVersion } from './prompts';
import {
  fetchResolvedMarkets,
  validateRelationship,
  type ResolvedMarket,
} from './backtest';
import type { BetRelationship } from '../../types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// A scored example from historical data
export interface ScoredExample {
  sourceMarket: ResolvedMarket;
  relatedMarket: ResolvedMarket;
  relationship: BetRelationship;
  reasoning: string;
  // Scoring
  relationshipHeld: boolean;
  profitScore: number; // -1 to +1: how much money would you have made?
  explanation: string;
}

// Optimization result
export interface OptimizationResult {
  originalPrompt: string;
  optimizedPrompt: string;
  originalScore: number;
  optimizedScore: number;
  improvement: number;
  iterations: number;
  fewShotExamples: ScoredExample[];
  failurePatterns: FailurePattern[];
}

interface FailurePattern {
  type: string;
  count: number;
  examples: string[];
  suggestedFix: string;
}

// Calculate profit score based on relationship prediction accuracy
// If you predicted IMPLIES and bet accordingly, how much did you make?
function calculateProfitScore(
  source: ResolvedMarket,
  related: ResolvedMarket,
  relationship: BetRelationship,
): number {
  const validation = validateRelationship(source.outcome, related.outcome, relationship);

  if (!validation.held) {
    // Relationship didn't hold - you would have lost money
    // Penalize more for confident wrong predictions
    return -0.8;
  }

  // Relationship held - calculate profit based on odds
  // The more "surprising" the correct prediction, the more profit
  const sourcePrice = source.finalPrice;
  const relatedPrice = related.finalPrice;

  switch (relationship) {
    case 'IMPLIES':
      // If you correctly predicted implication, profit = edge on related
      // Best case: source was uncertain (0.5) but you knew related would follow
      return validation.held ? 0.5 + Math.abs(relatedPrice - 0.5) : -0.5;

    case 'CONTRADICTS':
      // Correctly predicting contradiction is valuable
      return validation.held ? 0.7 : -0.7;

    case 'SUBEVENT':
    case 'CONDITIONED_ON':
      // Causal relationships are valuable but harder to trade
      return validation.held ? 0.4 : -0.4;

    case 'WEAK_SIGNAL':
      // Weak signals give less edge
      return validation.held ? 0.2 : -0.3;

    case 'PARTITION_OF':
      // Partitions are obvious, less trading value
      return validation.held ? 0.1 : -0.2;

    default:
      return 0;
  }
}

// Run the prompt and score all predictions
async function scorePrompt(
  promptContent: string,
  testPairs: Array<{ source: ResolvedMarket; candidates: ResolvedMarket[] }>,
): Promise<{ score: number; examples: ScoredExample[] }> {
  const allExamples: ScoredExample[] = [];
  let totalScore = 0;

  for (const { source, candidates } of testPairs) {
    try {
      // Build prompt with source market
      const filledPrompt = promptContent
        .replace('{{sourceQuestion}}', source.question)
        .replace('{{sourceYes}}', Math.round(source.finalPrice * 100).toString())
        .replace('{{sourceNo}}', Math.round((1 - source.finalPrice) * 100).toString())
        .replace('{{sourceDescription}}', source.description || '');

      // Build candidates context
      const candidatesContext = candidates
        .map(c => `ID: ${c.id}\nQuestion: ${c.question}\nDescription: ${c.description || 'N/A'}\nOdds: ${Math.round(c.finalPrice * 100)}% YES`)
        .join('\n\n---\n\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: filledPrompt },
          { role: 'user', content: `Analyze these candidate markets:\n\n${candidatesContext}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = completion.choices[0].message.content;
      if (!content) continue;

      const result = JSON.parse(content) as {
        related: Array<{ marketId: string; relationship: BetRelationship; reasoning: string }>;
      };

      // Score each prediction
      for (const pred of result.related || []) {
        const relatedMarket = candidates.find(c => c.id === pred.marketId);
        if (!relatedMarket) continue;

        const validation = validateRelationship(
          source.outcome,
          relatedMarket.outcome,
          pred.relationship,
        );

        const profitScore = calculateProfitScore(source, relatedMarket, pred.relationship);
        totalScore += profitScore;

        allExamples.push({
          sourceMarket: source,
          relatedMarket,
          relationship: pred.relationship,
          reasoning: pred.reasoning,
          relationshipHeld: validation.held,
          profitScore,
          explanation: validation.explanation,
        });
      }
    } catch (error) {
      console.error(`[Optimizer] Error scoring prompt for ${source.id}:`, error);
    }
  }

  const avgScore = allExamples.length > 0 ? totalScore / allExamples.length : 0;
  return { score: avgScore, examples: allExamples };
}

// Extract successful examples for few-shot learning
function extractFewShotExamples(examples: ScoredExample[], count: number = 3): ScoredExample[] {
  // Sort by profit score, take top performers
  return examples
    .filter(e => e.profitScore > 0.3)
    .sort((a, b) => b.profitScore - a.profitScore)
    .slice(0, count);
}

// Analyze failure patterns
function analyzeFailures(examples: ScoredExample[]): FailurePattern[] {
  const failures = examples.filter(e => e.profitScore < 0);
  const patterns: Map<string, { count: number; examples: string[] }> = new Map();

  for (const fail of failures) {
    // Categorize failure
    let patternKey: string;
    if (fail.relationship === 'WEAK_SIGNAL') {
      patternKey = 'OVERUSE_WEAK_SIGNAL';
    } else if (!fail.relationshipHeld && fail.relationship === 'IMPLIES') {
      patternKey = 'FALSE_IMPLICATION';
    } else if (!fail.relationshipHeld && fail.relationship === 'CONTRADICTS') {
      patternKey = 'FALSE_CONTRADICTION';
    } else {
      patternKey = 'WRONG_RELATIONSHIP_TYPE';
    }

    const existing = patterns.get(patternKey) || { count: 0, examples: [] };
    existing.count++;
    if (existing.examples.length < 2) {
      existing.examples.push(
        `Source: "${fail.sourceMarket.question}" → Related: "${fail.relatedMarket.question}" (predicted ${fail.relationship})`,
      );
    }
    patterns.set(patternKey, existing);
  }

  // Generate fix suggestions
  const patternFixes: Record<string, string> = {
    OVERUSE_WEAK_SIGNAL: 'Only use WEAK_SIGNAL when there is clear correlation in odds movement. Prefer stronger relationship types.',
    FALSE_IMPLICATION: 'IMPLIES should only be used when the related market logically MUST follow from the source. Check for confounders.',
    FALSE_CONTRADICTION: 'CONTRADICTS requires inverse outcomes. Markets can be related without being contradictory.',
    WRONG_RELATIONSHIP_TYPE: 'Carefully match relationship type to the logical connection. Review type definitions.',
  };

  return Array.from(patterns.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    examples: data.examples,
    suggestedFix: patternFixes[type] || 'Review the relationship logic.',
  }));
}

// Generate few-shot examples section
function generateFewShotSection(examples: ScoredExample[]): string {
  if (examples.length === 0) return '';

  const exampleStrings = examples.map((ex, i) => `
Example ${i + 1}:
Source: "${ex.sourceMarket.question}"
Related: "${ex.relatedMarket.question}"
Relationship: ${ex.relationship}
Reasoning: ${ex.reasoning}
[This prediction was CORRECT - the ${ex.relationship} relationship held when markets resolved]`);

  return `
PROVEN EXAMPLES (these predictions were validated against real outcomes):
${exampleStrings.join('\n')}
`;
}

// Generate failure avoidance section
function generateFailureAvoidanceSection(patterns: FailurePattern[]): string {
  if (patterns.length === 0) return '';

  const warnings = patterns
    .filter(p => p.count >= 2)
    .map(p => `- ${p.suggestedFix} (${p.count} past failures)`);

  if (warnings.length === 0) return '';

  return `
AVOID THESE MISTAKES (learned from past prediction errors):
${warnings.join('\n')}
`;
}

// Mutate the prompt using LLM
async function mutatePrompt(
  currentPrompt: string,
  fewShotExamples: ScoredExample[],
  failurePatterns: FailurePattern[],
  currentScore: number,
): Promise<string> {
  const fewShotSection = generateFewShotSection(fewShotExamples);
  const failureSection = generateFailureAvoidanceSection(failurePatterns);

  // If we have good material, inject it into the prompt
  if (fewShotSection || failureSection) {
    // Find a good insertion point (before the JSON output section)
    const jsonIndex = currentPrompt.indexOf('Return JSON');
    if (jsonIndex > 0) {
      const before = currentPrompt.slice(0, jsonIndex);
      const after = currentPrompt.slice(jsonIndex);
      return before + fewShotSection + failureSection + after;
    }
    // Fallback: append before the end
    return currentPrompt + fewShotSection + failureSection;
  }

  // If no clear improvements, use LLM to suggest mutations
  try {
    const mutationPrompt = `You are optimizing a prompt for a prediction market relationship finder.
Current prompt performance: ${(currentScore * 100).toFixed(1)}% average profit score

CURRENT PROMPT:
${currentPrompt}

FAILURE PATTERNS:
${failurePatterns.map(p => `- ${p.type}: ${p.count} failures. ${p.suggestedFix}`).join('\n')}

Your task: Improve this prompt to reduce failures and increase profitable predictions.
Focus on:
1. Clearer definitions of relationship types
2. Better criteria for when to identify each relationship
3. Warnings about common mistakes

Return ONLY the improved prompt, no explanations.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a prompt optimization expert.' },
        { role: 'user', content: mutationPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    return completion.choices[0].message.content || currentPrompt;
  } catch (error) {
    console.error('[Optimizer] Mutation failed:', error);
    return currentPrompt;
  }
}

// Main optimization loop
export async function optimizePrompt(
  promptName: string,
  maxIterations: number = 3,
  testSetSize: number = 15,
): Promise<OptimizationResult> {
  console.log(`[Optimizer] Starting optimization for "${promptName}"`);

  // Get current prompt
  const currentPromptVersion = getPrompt(promptName);
  if (!currentPromptVersion) {
    throw new Error(`Prompt "${promptName}" not found`);
  }

  // Fetch resolved markets for testing
  console.log('[Optimizer] Fetching resolved markets...');
  const resolvedMarkets = await fetchResolvedMarkets(testSetSize * 3);
  const validMarkets = resolvedMarkets.filter(
    m => m.outcome === 'YES' || m.outcome === 'NO',
  );

  if (validMarkets.length < 10) {
    throw new Error('Not enough resolved markets for optimization');
  }

  // Create test pairs
  const testPairs = validMarkets.slice(0, testSetSize).map(source => ({
    source,
    candidates: validMarkets.filter(m => m.id !== source.id).slice(0, 15),
  }));

  console.log(`[Optimizer] Created ${testPairs.length} test pairs`);

  // Score original prompt
  console.log('[Optimizer] Scoring original prompt...');
  const originalResult = await scorePrompt(currentPromptVersion.content, testPairs);
  console.log(`[Optimizer] Original score: ${(originalResult.score * 100).toFixed(1)}%`);

  let bestPrompt = currentPromptVersion.content;
  let bestScore = originalResult.score;
  let allExamples = originalResult.examples;

  // Optimization loop
  for (let i = 0; i < maxIterations; i++) {
    console.log(`[Optimizer] Iteration ${i + 1}/${maxIterations}`);

    // Extract learnings
    const fewShotExamples = extractFewShotExamples(allExamples);
    const failurePatterns = analyzeFailures(allExamples);

    console.log(`[Optimizer] Found ${fewShotExamples.length} good examples, ${failurePatterns.length} failure patterns`);

    // Mutate prompt
    const mutatedPrompt = await mutatePrompt(bestPrompt, fewShotExamples, failurePatterns, bestScore);

    // Score mutated prompt
    const mutatedResult = await scorePrompt(mutatedPrompt, testPairs);
    console.log(`[Optimizer] Mutated score: ${(mutatedResult.score * 100).toFixed(1)}%`);

    // Keep if better
    if (mutatedResult.score > bestScore) {
      console.log(`[Optimizer] Improvement: +${((mutatedResult.score - bestScore) * 100).toFixed(1)}%`);
      bestPrompt = mutatedPrompt;
      bestScore = mutatedResult.score;
      allExamples = mutatedResult.examples;
    } else {
      console.log('[Optimizer] No improvement, trying different mutation...');
    }

    // Early stopping if score is good enough
    if (bestScore > 0.6) {
      console.log('[Optimizer] Score threshold reached, stopping early');
      break;
    }
  }

  // Register optimized prompt as new version
  const improvement = bestScore - originalResult.score;
  if (improvement > 0.05) {
    registerPrompt(
      promptName,
      bestPrompt,
      `Auto-optimized from v${currentPromptVersion.version}. Improvement: +${(improvement * 100).toFixed(1)}%`,
    );
  }

  return {
    originalPrompt: currentPromptVersion.content,
    optimizedPrompt: bestPrompt,
    originalScore: originalResult.score,
    optimizedScore: bestScore,
    improvement,
    iterations: maxIterations,
    fewShotExamples: extractFewShotExamples(allExamples),
    failurePatterns: analyzeFailures(allExamples),
  };
}

// Quick optimization - just add few-shot examples without full loop
export async function quickOptimize(promptName: string): Promise<string> {
  const currentPrompt = getPrompt(promptName);
  if (!currentPrompt) {
    throw new Error(`Prompt "${promptName}" not found`);
  }

  // Fetch a small set of resolved markets
  const resolvedMarkets = await fetchResolvedMarkets(30);
  const validMarkets = resolvedMarkets.filter(m => m.outcome === 'YES' || m.outcome === 'NO');

  // Create a few test pairs
  const testPairs = validMarkets.slice(0, 5).map(source => ({
    source,
    candidates: validMarkets.filter(m => m.id !== source.id).slice(0, 10),
  }));

  // Score current prompt
  const result = await scorePrompt(currentPrompt.content, testPairs);

  // Extract best examples
  const fewShotExamples = extractFewShotExamples(result.examples, 2);
  const failurePatterns = analyzeFailures(result.examples);

  // Inject into prompt
  const fewShotSection = generateFewShotSection(fewShotExamples);
  const failureSection = generateFailureAvoidanceSection(failurePatterns);

  if (!fewShotSection && !failureSection) {
    return currentPrompt.content; // No changes
  }

  const jsonIndex = currentPrompt.content.indexOf('Return JSON');
  if (jsonIndex > 0) {
    const before = currentPrompt.content.slice(0, jsonIndex);
    const after = currentPrompt.content.slice(jsonIndex);
    const optimized = before + fewShotSection + failureSection + after;

    registerPrompt(
      promptName,
      optimized,
      `Quick optimization with ${fewShotExamples.length} few-shot examples`,
    );

    return optimized;
  }

  return currentPrompt.content;
}
