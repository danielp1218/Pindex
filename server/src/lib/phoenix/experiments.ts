// Experiment Runner - test prompts against datasets, collect structured feedback

import OpenAI from 'openai';
import { getPromptVersion, updatePromptMetrics } from './prompts';
import { getCollectedDataset, DatasetEntry } from './tracing';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExperimentRun {
  id: string;
  promptName: string;
  promptVersion: number;
  datasetSize: number;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'failed';
  results: ExperimentResult[];
  aggregateMetrics?: AggregateMetrics;
}

export interface ExperimentResult {
  datasetEntryId: string;
  input: DatasetEntry['input'];
  expectedOutput: DatasetEntry['output'];
  actualOutput: any;
  latencyMs: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  evaluation: EvaluationFeedback;
}

export interface EvaluationFeedback {
  // Core metrics
  correctness: number; // 0-1 score
  isCorrect: boolean;
  explanation: string;
  errorType?: 'MISSED_RELATIONSHIP' | 'WRONG_TYPE' | 'WEAK_REASONING' | 'FALSE_POSITIVE' | 'NONE';
  confusionReason?: string;
  evidenceSpan?: string;
  promptFixSuggestion?: string;
}

export interface AggregateMetrics {
  accuracy: number;
  avgLatencyMs: number;
  avgTokenUsage: number;
  avgRelationshipsFound: number;
  errorTypeDistribution: Record<string, number>;
  totalRuns: number;
}

const experiments: Map<string, ExperimentRun> = new Map();

// Ground truth evaluator - compares actual vs expected output
function evaluateGroundTruth(
  expected: DatasetEntry['output'],
  actual: any
): { correctness: number; isCorrect: boolean } {
  const expectedIds = new Set(expected.relationships.map(r => r.marketId));
  const actualIds = new Set((actual.related || []).map((r: { marketId: string }) => r.marketId));

  // Calculate overlap
  let matches = 0;
  for (const id of expectedIds) {
    if (actualIds.has(id)) matches++;
  }

  const precision = actualIds.size > 0 ? matches / actualIds.size : 0;
  const recall = expectedIds.size > 0 ? matches / expectedIds.size : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    correctness: f1,
    isCorrect: f1 >= 0.5, // Consider correct if F1 >= 0.5
  };
}

// LLM-as-judge evaluator - structured feedback for prompt optimization
async function evaluateWithLLM(
  input: DatasetEntry['input'],
  expected: DatasetEntry['output'],
  actual: any
): Promise<Partial<EvaluationFeedback>> {
  const evalPrompt = `You are evaluating a prediction market relationship finder.
SOURCE MARKET:
Question: ${input.sourceMarket.question}
Description: ${input.sourceMarket.description}
EXPECTED OUTPUT (ground truth):
${JSON.stringify(expected.relationships, null, 2)}
ACTUAL OUTPUT (model response):
${JSON.stringify(actual.related || [], null, 2)}
Evaluate the model's performance and provide STRUCTURED FEEDBACK for prompt improvement.
Return JSON:
{
  "explanation": "Brief explanation of what the model did well or poorly",
  "error_type": "MISSED_RELATIONSHIP|WRONG_TYPE|WEAK_REASONING|FALSE_POSITIVE|NONE",
  "confusion_reason": "Why the model made this mistake (if applicable)",
  "evidence_span": "Quote from input that should have led to correct answer",
  "prompt_fix_suggestion": "Specific suggestion to improve the prompt"
}
Error types:
- MISSED_RELATIONSHIP: Failed to find an important related market
- WRONG_TYPE: Found the market but classified relationship incorrectly
- WEAK_REASONING: Reasoning was vague or unconvincing
- FALSE_POSITIVE: Identified a market that isn't actually related
- NONE: Output was correct`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: evalPrompt },
        { role: 'user', content: 'Evaluate and provide structured feedback:' },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = completion.choices[0].message.content;
    if (!content) return {};

    const result = JSON.parse(content);
    return {
      explanation: result.explanation || '',
      errorType: result.error_type as EvaluationFeedback['errorType'],
      confusionReason: result.confusion_reason,
      evidenceSpan: result.evidence_span,
      promptFixSuggestion: result.prompt_fix_suggestion,
    };
  } catch (error) {
    console.error('[Experiment] LLM evaluation failed:', error);
    return {
      explanation: 'Evaluation failed',
      errorType: undefined,
    };
  }
}

// Run an experiment: test a prompt against a dataset
export async function runExperiment(
  promptName: string,
  promptVersion: number,
  dataset?: DatasetEntry[]
): Promise<ExperimentRun> {
  const prompt = getPromptVersion(promptName, promptVersion);
  if (!prompt) {
    throw new Error(`Prompt ${promptName} v${promptVersion} not found`);
  }

  // Use provided dataset or get from collected traces
  const data = dataset || getCollectedDataset();
  if (data.length === 0) {
    throw new Error('No dataset entries available. Run some jobs first to collect data.');
  }

  const experimentId = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const experiment: ExperimentRun = {
    id: experimentId,
    promptName,
    promptVersion,
    datasetSize: data.length,
    startedAt: Date.now(),
    status: 'running',
    results: [],
  };

  experiments.set(experimentId, experiment);
  console.log(`[Experiment] Starting ${experimentId} with ${data.length} examples`);

  // Run prompt against each dataset entry
  for (const entry of data) {
    const startTime = Date.now();

    try {
      // Build the prompt with variables
      const filledPrompt = prompt.content
        .replace('{{sourceQuestion}}', entry.input.sourceMarket.question)
        .replace('{{sourceYes}}', '50') // We don't have this in dataset yet
        .replace('{{sourceNo}}', '50')
        .replace('{{sourceDescription}}', entry.input.sourceMarket.description || '');

      // Build candidate markets context
      const candidatesContext = entry.input.candidateMarkets
        .map((m: { id: string; question: string; description: string }) => `ID: ${m.id}\nQuestion: ${m.question}\nDescription: ${m.description}`)
        .join('\n\n---\n\n');

      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: filledPrompt },
          { role: 'user', content: `Analyze these candidate markets:\n\n${candidatesContext}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const latencyMs = Date.now() - startTime;
      const content = completion.choices[0].message.content;
      const actualOutput = content ? JSON.parse(content) : { related: [] };

      // Run evaluations
      const groundTruth = evaluateGroundTruth(entry.output, actualOutput);
      const llmFeedback = await evaluateWithLLM(entry.input, entry.output, actualOutput);

      const result: ExperimentResult = {
        datasetEntryId: entry.metadata.jobId,
        input: entry.input,
        expectedOutput: entry.output,
        actualOutput,
        latencyMs,
        tokenUsage: {
          prompt: completion.usage?.prompt_tokens || 0,
          completion: completion.usage?.completion_tokens || 0,
          total: completion.usage?.total_tokens || 0,
        },
        evaluation: {
          correctness: groundTruth.correctness,
          isCorrect: groundTruth.isCorrect,
          explanation: llmFeedback.explanation || 'No explanation provided',
          errorType: llmFeedback.errorType,
          confusionReason: llmFeedback.confusionReason,
          evidenceSpan: llmFeedback.evidenceSpan,
          promptFixSuggestion: llmFeedback.promptFixSuggestion,
        },
      };

      experiment.results.push(result);
      console.log(`[Experiment] Processed ${experiment.results.length}/${data.length}`);
    } catch (error) {
      console.error(`[Experiment] Error processing entry:`, error);
    }
  }

  // Calculate aggregate metrics
  experiment.aggregateMetrics = calculateAggregateMetrics(experiment.results);
  experiment.completedAt = Date.now();
  experiment.status = 'completed';

  // Update prompt metrics
  updatePromptMetrics(promptName, promptVersion, {
    accuracy: experiment.aggregateMetrics.accuracy,
    avgRelationshipsFound: experiment.aggregateMetrics.avgRelationshipsFound,
    avgLatencyMs: experiment.aggregateMetrics.avgLatencyMs,
    tokenUsage: experiment.aggregateMetrics.avgTokenUsage,
  });

  console.log(`[Experiment] Completed ${experimentId}:`, experiment.aggregateMetrics);

  return experiment;
}

function calculateAggregateMetrics(results: ExperimentResult[]): AggregateMetrics {
  if (results.length === 0) {
    return {
      accuracy: 0,
      avgLatencyMs: 0,
      avgTokenUsage: 0,
      avgRelationshipsFound: 0,
      errorTypeDistribution: {},
      totalRuns: 0,
    };
  }

  const correctCount = results.filter(r => r.evaluation.isCorrect).length;
  const totalLatency = results.reduce((sum, r) => sum + r.latencyMs, 0);
  const totalTokens = results.reduce((sum, r) => sum + r.tokenUsage.total, 0);
  const totalRelationships = results.reduce(
    (sum, r) => sum + (r.actualOutput.related?.length || 0),
    0
  );

  // Count error types
  const errorTypeDistribution: Record<string, number> = {};
  for (const result of results) {
    const errorType = result.evaluation.errorType || 'NONE';
    errorTypeDistribution[errorType] = (errorTypeDistribution[errorType] || 0) + 1;
  }

  return {
    accuracy: correctCount / results.length,
    avgLatencyMs: totalLatency / results.length,
    avgTokenUsage: totalTokens / results.length,
    avgRelationshipsFound: totalRelationships / results.length,
    errorTypeDistribution,
    totalRuns: results.length,
  };
}

export function getExperiment(id: string): ExperimentRun | undefined {
  return experiments.get(id);
}

export function getAllExperiments(): ExperimentRun[] {
  return Array.from(experiments.values());
}

export function exportForPromptLearning(experimentId: string): object[] {
  const experiment = experiments.get(experimentId);
  if (!experiment) return [];

  return experiment.results.map(r => ({
    input: JSON.stringify(r.input),
    output: JSON.stringify(r.actualOutput),
    correctness: r.evaluation.correctness,
    explanation: r.evaluation.explanation,
    confusion_reason: r.evaluation.confusionReason,
    error_type: r.evaluation.errorType,
    evidence_span: r.evaluation.evidenceSpan,
    prompt_fix_suggestion: r.evaluation.promptFixSuggestion,
  }));
}

export async function syncExperimentToPhoenix(experimentId: string): Promise<void> {
  const experiment = experiments.get(experimentId);
  if (!experiment) {
    throw new Error(`Experiment ${experimentId} not found`);
  }

  // Log experiment summary - full Phoenix sync requires dataset ID
  console.log(`[Experiment] Syncing ${experimentId} to Phoenix...`);
  console.log(`[Experiment] Experiment data ready for Phoenix sync`);
  console.log(`[Experiment] Results: ${experiment.results.length}`);
  console.log(`[Experiment] Accuracy: ${(experiment.aggregateMetrics?.accuracy || 0) * 100}%`);

  // Note: To fully sync to Phoenix, use the Phoenix UI to create a dataset
  // then run experiments against it using the Phoenix experiments API
}